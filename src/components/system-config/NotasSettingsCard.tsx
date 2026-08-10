import { useEffect, useState } from 'react';
import { Save, AlertCircle, RefreshCw, GraduationCap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
} from '@/components/staff';
import { isNotasEnabled } from '@/config/features';
import { notasService } from '@/lib/services';
import type { NotasSemana } from '@/types/notas';
import { toast } from 'sonner';

export function NotasSettingsCard() {
  const enabled = isNotasEnabled();
  const [semanas, setSemanas] = useState<NotasSemana[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const load = async () => {
    setLoading(true);
    setError(false);
    const { semanas: list, error: err } = await notasService.listSemanas(false);
    if (err) {
      setError(true);
      setSemanas([]);
    } else {
      setSemanas(list);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (enabled) void load();
    else setLoading(false);
  }, [enabled]);

  if (!enabled) return null;

  const handleCreate = async () => {
    if (!codigo.trim() || !etiqueta.trim() || !fechaInicio || !fechaFin) {
      toast.error('Complete código, etiqueta y fechas');
      return;
    }
    setSaving(true);
    try {
      const { error: err } = await notasService.upsertSemana({
        codigo: codigo.trim(),
        etiqueta: etiqueta.trim(),
        fechaInicio,
        fechaFin,
        abiertaDeclaracion: true,
        abiertaCargaNotas: true,
        activo: true,
      });
      if (err) {
        toast.error(err);
        return;
      }
      toast.success('Semana creada');
      setCodigo('');
      setEtiqueta('');
      setFechaInicio('');
      setFechaFin('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (
    s: NotasSemana,
    patch: Partial<Pick<NotasSemana, 'abiertaDeclaracion' | 'abiertaCargaNotas' | 'activo'>>,
  ) => {
    const { error: err } = await notasService.upsertSemana({
      id: s.id,
      abiertaDeclaracion: patch.abiertaDeclaracion,
      abiertaCargaNotas: patch.abiertaCargaNotas,
      activo: patch.activo,
    });
    if (err) toast.error(err);
    else {
      toast.success('Semana actualizada');
      await load();
    }
  };

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        accent="secondary"
        title="Notas por área"
        description="Semanas de examen configurables. Solo semanas abiertas permiten declarar área y cargar notas."
      />
      <StaffDataPanelBody className="space-y-5">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">No se pudo cargar semanas de notas</p>
            <p className="text-xs text-muted-foreground">
              ¿Aplicaste scripts/asisacademy/05_NOTAS_AREAS.sql en la BD?
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input placeholder="2026-W33" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Etiqueta</Label>
                <Input
                  placeholder="Semana 33 — agosto"
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Inicio</Label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
            </div>
            <Button onClick={() => void handleCreate()} disabled={saving || loading}>
              <Plus className="mr-2 h-4 w-4" />
              Crear semana
            </Button>

            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : semanas.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Aún no hay semanas configuradas.
                </p>
              ) : (
                semanas.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{s.etiqueta}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.codigo} · {s.fechaInicio} → {s.fechaFin}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={s.abiertaDeclaracion}
                          onCheckedChange={(v) => void toggle(s, { abiertaDeclaracion: v })}
                        />
                        Declaración
                      </label>
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={s.abiertaCargaNotas}
                          onCheckedChange={(v) => void toggle(s, { abiertaCargaNotas: v })}
                        />
                        Carga notas
                      </label>
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={s.activo}
                          onCheckedChange={(v) => void toggle(s, { activo: v })}
                        />
                        Activa
                      </label>
                      <Save className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
