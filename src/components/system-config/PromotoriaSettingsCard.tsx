import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { StaffDataPanel, StaffDataPanelHeader, StaffDataPanelBody } from '@/components/staff';
import { configService } from '@/lib/services';
import { sessionService } from '@/lib/services/sessionService';
import { supabase } from '@/lib/supabaseClient';

/** Clave en configuracion_sistema que lee el canal para avisar a la Promotoría. */
export const PROMOTORIA_KEY = 'promotoria_usuarios';

type Candidate = { id: number; username: string; nombre: string; rol: string };

/**
 * Quiénes reciben en la app Asiscole (modo administración) los avisos del
 * personal: llegadas, tardanzas, inasistencias, salidas e incidencias.
 */
export function PromotoriaSettingsCard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [{ data, error }, cfg] = await Promise.all([
        supabase.rpc('sie_promotoria_candidatos', { p_token: sessionService.getApiToken() }),
        configService.getByKeys([PROMOTORIA_KEY]),
      ]);
      const payload = data as { error: string | null; usuarios: Candidate[] } | null;
      if (error || payload?.error) toast.error(error?.message ?? payload?.error ?? 'No se pudo cargar usuarios');
      setCandidates(payload?.usuarios ?? []);
      const raw = cfg.configs[PROMOTORIA_KEY]?.value ?? '';
      setSelected(new Set(raw.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0)));
      setLoading(false);
    })();
  }, []);

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc('sie_promotoria_guardar', {
      p_token: sessionService.getApiToken(),
      p_ids: [...selected].sort((a, b) => a - b),
    });
    setSaving(false);
    const payload = data as { ok: boolean; error: string | null } | null;
    if (error || !payload?.ok) {
      toast.error(error?.message ?? payload?.error ?? 'No se pudo guardar');
      return;
    }
    toast.success('Promotoría guardada');
  };

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        title="Promotoría — avisos del personal"
        description="Reciben en la app Asiscole cada llegada, tardanza, inasistencia, salida e incidencia del personal. Deben iniciar sesión en la app con su usuario del SIE."
      />
      <StaffDataPanelBody>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay usuarios Admin, Director o Supervisor activos.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((c) => (
                <label key={c.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(on) => toggle(c.id, Boolean(on))} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.nombre}</span>
                    <span className="text-xs text-muted-foreground">{c.username}</span>
                  </span>
                  <Badge variant="outline">{c.rol}</Badge>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <BellRing className="h-4 w-4" aria-hidden="true" />
                {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
              </span>
              <Button variant="info" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
