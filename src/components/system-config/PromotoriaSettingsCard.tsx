import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StaffDataPanel, StaffDataPanelHeader, StaffDataPanelBody } from '@/components/staff';
import { sessionService } from '@/lib/services/sessionService';
import { supabase } from '@/lib/supabaseClient';

type PromotoriaConfig = { error: string | null; telefono: string; personal_activo: number };

/**
 * Celular de la Promotoría: queda vinculado en la app Asiscole a todo el
 * personal activo, igual que un apoderado con sus hijos. Inicia sesión con ese
 * celular y el DNI de cualquier empleado, y recibe sus llegadas, salidas,
 * inasistencias e incidencias.
 */
export function PromotoriaSettingsCard() {
  const [telefono, setTelefono] = useState('');
  const [guardado, setGuardado] = useState('');
  const [personalActivo, setPersonalActivo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc('sie_promotoria_config', { p_token: sessionService.getApiToken() });
      const cfg = data as PromotoriaConfig | null;
      if (error || cfg?.error) toast.error(error?.message ?? cfg?.error ?? 'No se pudo cargar la Promotoría');
      setTelefono(cfg?.telefono ?? '');
      setGuardado(cfg?.telefono ?? '');
      setPersonalActivo(cfg?.personal_activo ?? 0);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc('sie_promotoria_guardar_telefono', {
      p_token: sessionService.getApiToken(),
      p_telefono: telefono,
    });
    setSaving(false);
    const res = data as { ok: boolean; error: string | null; telefono?: string } | null;
    if (error || !res?.ok) {
      toast.error(error?.message ?? res?.error ?? 'No se pudo guardar');
      return;
    }
    setTelefono(res.telefono ?? '');
    setGuardado(res.telefono ?? '');
    toast.success('Celular de Promotoría guardado. La app se actualiza en unos minutos.');
  };

  const primero = guardado.split(',')[0]?.trim();

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        title="Celular de la Promotoría"
        description="Ese número queda vinculado en la app Asiscole a todo el personal activo, como un padre con sus hijos."
      />
      <StaffDataPanelBody>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="promotoria-tel">Celular (9 dígitos; varios separados por coma)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="promotoria-tel"
                  inputMode="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="963852741"
                />
                <Button variant="info" onClick={() => void save()} disabled={saving || telefono === guardado}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                Cómo entra la Promotoría a la app
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Abrir la app Asiscole e iniciar sesión.</li>
                <li>
                  Celular: <strong className="text-foreground">{primero || '—'}</strong>.
                </li>
                <li>
                  Documento: el <strong className="text-foreground">DNI de cualquier empleado</strong> activo (
                  {personalActivo} vinculados).
                </li>
                <li>Verá a cada empleado como un "hijo" (grado Personal) y recibirá sus avisos.</li>
              </ol>
            </div>
          </div>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
