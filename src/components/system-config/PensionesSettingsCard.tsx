import { useEffect, useState } from 'react';
import { Save, AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
} from '@/components/staff';
import { isPensionesEnabled } from '@/config/features';
import { pensionesService } from '@/lib/services';
import type { PensionConfig } from '@/types';
import { toast } from 'sonner';

export function PensionesSettingsCard() {
  const enabled = isPensionesEnabled();
  const [config, setConfig] = useState<PensionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    const { config: cfg, error: err } = await pensionesService.getConfig();
    if (err || !cfg) {
      setError(true);
      setConfig(null);
    } else {
      setConfig(cfg);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (enabled) void load();
    else setLoading(false);
  }, [enabled]);

  if (!enabled) return null;

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const dia = Math.min(28, Math.max(1, Number(config.diaVencimiento) || 10));
      const { error: err } = await pensionesService.setConfig({
        diaVencimiento: dia,
        montoMensual: config.montoMensual,
        avisoSonoroActivo: config.avisoSonoroActivo,
        activo: config.activo,
      });
      if (err) {
        toast.error(err);
        return;
      }
      toast.success('Configuración de pensiones guardada');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        accent="secondary"
        title="Pensiones"
        description="Día de vencimiento mensual, monto referencial del colegio y aviso sonoro en el escáner tutor."
      />
      <StaffDataPanelBody className="space-y-5">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">No se pudo cargar la config de pensiones</p>
            <p className="text-xs text-muted-foreground">
              ¿Aplicaste el script scripts/PENSIONES_JP.sql en la BD?
            </p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : loading || !config ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pension-dia">Día de vencimiento (1–28)</Label>
                <Input
                  id="pension-dia"
                  type="number"
                  min={1}
                  max={28}
                  value={config.diaVencimiento}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      diaVencimiento: Number(e.target.value) || 1,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Mora el día siguiente a esta fecha si pagado=0.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pension-monto">Monto mensual (PEN, opcional)</Label>
                <Input
                  id="pension-monto"
                  type="number"
                  min={0}
                  step="0.01"
                  value={config.montoMensual ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setConfig({
                      ...config,
                      montoMensual: v === '' ? null : Number(v),
                    });
                  }}
                  placeholder="Ej. 350"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.avisoSonoroActivo}
                  onCheckedChange={(v) => setConfig({ ...config, avisoSonoroActivo: v })}
                />
                <div>
                  <p className="text-sm font-medium">Aviso sonoro en escáner</p>
                  <p className="text-xs text-muted-foreground">No bloquea asistencia ni talleres</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.activo}
                  onCheckedChange={(v) => setConfig({ ...config, activo: v })}
                />
                <div>
                  <p className="text-sm font-medium">Módulo aplicable</p>
                  <p className="text-xs text-muted-foreground">Flag de negocio en BD</p>
                </div>
              </div>
            </div>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar pensiones
            </Button>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              La importación Excel está en el menú Pensiones (Admin/Director).
            </p>
          </>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
