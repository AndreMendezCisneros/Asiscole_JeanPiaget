import { useEffect, useState } from 'react';
import { Save, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
} from '@/components/staff';
import { reincidenceConfigService } from '@/lib/services';
import type { ReincidenceLevel, ReincidenceSettings } from '@/types';
import { toast } from 'sonner';
import { getReincidenceLevelSummaryLabel } from '@/lib/utils/reincidenceUtils';
import {
  useInvalidateSystemConfig,
  useReincidenceSettingsQuery,
} from '@/hooks/queries/useSystemConfigQuery';

const THRESHOLD_FIELDS = [
  { key: 'level1' as const, level: 1 as ReincidenceLevel, label: 'Nivel 1' },
  { key: 'level2' as const, level: 2 as ReincidenceLevel, label: 'Nivel 2' },
  { key: 'level3' as const, level: 3 as ReincidenceLevel, label: 'Nivel 3' },
  { key: 'level4' as const, level: 4 as ReincidenceLevel, label: 'Nivel 4' },
  { key: 'level5' as const, level: 5 as ReincidenceLevel, label: 'Nivel 5' },
];

type ThresholdForm = ReincidenceSettings['thresholds'];

export function ReincidenceSettingsCard() {
  const { data: loadedSettings, isLoading, isError, refetch } = useReincidenceSettingsQuery();
  const invalidateSystemConfig = useInvalidateSystemConfig();
  const [saving, setSaving] = useState(false);
  const [windowDays, setWindowDays] = useState('60');
  const [thresholds, setThresholds] = useState<ThresholdForm>({
    level1: 1,
    level2: 3,
    level3: 5,
    level4: 8,
    level5: 12,
  });

  useEffect(() => {
    if (loadedSettings) {
      setWindowDays(String(loadedSettings.windowDays));
      setThresholds(loadedSettings.thresholds);
    }
  }, [loadedSettings]);

  useEffect(() => {
    if (isError) {
      toast.error('Error al cargar configuración de reincidencia');
    }
  }, [isError]);

  const handleSave = async () => {
    const days = parseInt(windowDays, 10);
    if (Number.isNaN(days)) {
      toast.error('Ingrese un número válido de días');
      return;
    }

    const parsed: ThresholdForm = {
      level1: parseInt(String(thresholds.level1), 10),
      level2: parseInt(String(thresholds.level2), 10),
      level3: parseInt(String(thresholds.level3), 10),
      level4: parseInt(String(thresholds.level4), 10),
      level5: parseInt(String(thresholds.level5), 10),
    };

    setSaving(true);
    const { settings, error } = await reincidenceConfigService.updateSettings({
      windowDays: days,
      thresholds: parsed,
    });

    if (error) {
      toast.error(error);
    } else if (settings) {
      setWindowDays(String(settings.windowDays));
      setThresholds(settings.thresholds);
      toast.success('Reglas de reincidencia actualizadas');
      invalidateSystemConfig();
    }
    setSaving(false);
  };

  const level0Max = Math.max(0, (thresholds.level1 || 1) - 1);

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        accent="warning"
        title="Reincidencia"
        description="Suma los puntos de las faltas activas del catálogo dentro de la ventana de días y asigna el nivel de comportamiento (0–5) del estudiante."
      />
      <StaffDataPanelBody className="space-y-6">
        {isError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">No se pudo cargar la configuración de reincidencia</p>
            <p className="text-xs text-muted-foreground">Verifica la conexión e intenta de nuevo.</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando reglas de reincidencia…</p>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <p>
                Solo cuentan incidencias con estado <strong>Activa</strong>. Los puntos de cada falta
                se definen en el <strong>Catálogo de faltas</strong>. Al registrar una nueva
                incidencia, la base de datos recalcula el nivel automáticamente.
              </p>
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="ventana-dias" className="app-toolbar-label">
                Ventana de análisis (días)
              </Label>
              <Input
                id="ventana-dias"
                type="number"
                min={7}
                max={365}
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                className="font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Faltas más antiguas que este período no suman para el nivel actual.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Umbrales por nivel</p>
                <p className="text-xs text-muted-foreground">
                  Puntos mínimos acumulados en la ventana para alcanzar cada nivel.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/15 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Nivel 0</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      0 – {level0Max} pts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getReincidenceLevelSummaryLabel(0)}
                  </p>
                </div>
                {THRESHOLD_FIELDS.map(({ key, level, label }) => (
                  <div
                    key={key}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`umbral-${key}`} className="text-sm font-medium">
                        {label}
                      </Label>
                      <span className="text-[11px] text-muted-foreground">mín. puntos</span>
                    </div>
                    <Input
                      id={`umbral-${key}`}
                      type="number"
                      min={1}
                      max={999}
                      value={thresholds[key]}
                      onChange={(e) =>
                        setThresholds((prev) => ({
                          ...prev,
                          [key]: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      className="font-mono tabular-nums"
                    />
                    <p className="text-xs text-muted-foreground">
                      {getReincidenceLevelSummaryLabel(level)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-border/60 pt-4">
              <Button type="button" onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Guardando…' : 'Guardar reincidencia'}
              </Button>
            </div>
          </>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
