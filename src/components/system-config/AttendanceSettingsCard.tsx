import { useEffect, useState } from 'react';
import { Save, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
} from '@/components/staff';
import {
  SYSTEM_SETTINGS,
  normalizeTimeValue,
  toStorageTimeValue,
} from '@/config/systemSettings';
import { configService } from '@/lib/services';
import { toast } from 'sonner';
import { invalidateCache } from '@/lib/utils/memoryCache';
import {
  useAttendanceSettingsQuery,
  useInvalidateSystemConfig,
  type AttendanceSettingsValues,
} from '@/hooks/queries/useSystemConfigQuery';

export function AttendanceSettingsCard() {
  const { data: loadedValues, isLoading, isError, refetch } = useAttendanceSettingsQuery();
  const invalidateSystemConfig = useInvalidateSystemConfig();
  const [values, setValues] = useState<AttendanceSettingsValues | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadedValues) {
      setValues(loadedValues);
    }
  }, [loadedValues]);

  useEffect(() => {
    if (isError) {
      toast.error('Error al cargar horarios de asistencia');
    }
  }, [isError]);

  const handleSave = async () => {
    if (!values) return;

    setSaving(true);
    try {
      for (const def of SYSTEM_SETTINGS) {
        const raw = values[def.key] ?? def.defaultValue;
        const { error } = await configService.upsertByKey({
          key: def.key,
          value: toStorageTimeValue(raw),
          description: def.description,
        });
        if (error) {
          toast.error(`No se pudo guardar «${def.label}»: ${error}`);
          setSaving(false);
          return;
        }
      }
      toast.success('Horarios de asistencia actualizados');
      for (const def of SYSTEM_SETTINGS) {
        invalidateCache(`config:${def.key}`);
      }
      invalidateCache('config:hora_limite_llegada');
      invalidateCache('config:arrival-limits-bundle');
      invalidateSystemConfig();
    } catch {
      toast.error('Error al guardar horarios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        accent="info"
        title="Asistencia y horarios"
        description="Reglas de puntualidad para el control de llegadas y alertas de salida sin registrar."
      />
      <StaffDataPanelBody className="space-y-5">
        {isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">No se pudieron cargar los horarios</p>
            <p className="text-xs text-muted-foreground">Verifica la conexión e intenta de nuevo.</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : isLoading || !values ? (
          <p className="text-sm text-muted-foreground">Cargando horarios…</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {SYSTEM_SETTINGS.map((def) => (
                <div
                  key={def.key}
                  className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4"
                >
                  <div>
                    <Label htmlFor={def.key} className="text-sm font-semibold text-foreground">
                      {def.label}
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>
                  </div>
                  <Input
                    id={def.key}
                    type="time"
                    value={values[def.key] ?? def.defaultValue}
                    onChange={(e) =>
                      setValues((prev) =>
                        prev
                          ? {
                              ...prev,
                              [def.key]: normalizeTimeValue(e.target.value, def.defaultValue),
                            }
                          : prev,
                      )
                    }
                    className="max-w-[10rem] font-mono tabular-nums"
                  />
                  <p className="text-[11px] text-muted-foreground/90">
                    Usado en: {def.usedIn}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-border/60 pt-4">
              <Button type="button" onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Guardando…' : 'Guardar horarios'}
              </Button>
            </div>
          </>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
