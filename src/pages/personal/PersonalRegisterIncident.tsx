import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FilePlus2, Loader2, Search, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffDataPanel, StaffDataPanelHeader, StaffWorkflowSteps } from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { authService } from '@/lib/services';
import { personalService } from '@/lib/services/personalService';
import { personalIncidentsService } from '@/lib/services/personalIncidentsService';
import { useFaultsQuery } from '@/hooks/queries/useFaultsQuery';
import { formatScheduleSummary } from '@/lib/utils/personalSchedule';
import type { Personal } from '@/types/personal';

export const PersonalRegisterIncident = () => {
  const { data: faults = [], isLoading: loadingFaults } = useFaultsQuery(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Personal[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Personal | null>(null);
  const [faultId, setFaultId] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const digits = q.replace(/\D/g, '');
      const res =
        digits.length >= 7 && digits.length === q.length
          ? await personalService.getByBarcode(q).then((r) => ({ personal: r.personal ? [r.personal] : [], error: r.error }))
          : await personalService.searchByName(q, 10);
      if (cancelled) return;
      if (res.error) toast.error(res.error);
      setResults(res.personal);
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const step = !selected ? 0 : !faultId ? 1 : 2;

  const reset = () => {
    setSelected(null);
    setFaultId('');
    setObservations('');
    setQuery('');
    setResults([]);
  };

  const submit = async () => {
    const user = authService.getCurrentUser();
    if (!selected || !faultId || !user) return;
    setSaving(true);
    const { error } = await personalIncidentsService.create({
      personalId: selected.id,
      faultId: Number(faultId),
      userId: user.id,
      observations,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Incidencia registrada para ${selected.fullName}`);
    reset();
  };

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={FilePlus2}
        eyebrow="Personal"
        title="Registrar Incidencia del Personal"
        description="Busque al empleado, elija la falta del catálogo y agregue una observación"
        accent="accent"
      />

      <StaffWorkflowSteps
        steps={[
          { id: 'empleado', label: 'Empleado', description: 'Nombre o DNI' },
          { id: 'falta', label: 'Falta', description: 'Del catálogo' },
          { id: 'registrar', label: 'Registrar', description: 'Observación opcional' },
        ]}
        currentStep={['empleado', 'falta', 'registrar'][step]}
      />

      <StaffDataPanel>
        <StaffDataPanelHeader title="1. Empleado" description="Escriba nombre, apellido o DNI" />
        <div className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          {selected ? (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <StudentPhoto src={selected.profilePhoto} name={selected.fullName} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{selected.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.category} · DNI {selected.barcode} · {formatScheduleSummary(selected.schedule)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Cambiar empleado">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nombre o DNI del empleado..."
                  className="pl-10"
                  aria-label="Buscar empleado"
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {results.length > 0 && (
                <div className="divide-y rounded-lg border" role="listbox">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/60"
                      onClick={() => {
                        setSelected(p);
                        setResults([]);
                      }}
                    >
                      <StudentPhoto src={p.profilePhoto} name={p.fullName} className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.category} · DNI {p.barcode}
                        </span>
                      </span>
                      <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </StaffDataPanel>

      {selected && (
        <StaffDataPanel>
          <StaffDataPanelHeader title="2. Falta y observación" description="Mismo catálogo de faltas que estudiantes" />
          <div className="grid gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="space-y-2">
              <Label>Falta</Label>
              <Select value={faultId} onValueChange={setFaultId} disabled={loadingFaults}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingFaults ? 'Cargando…' : 'Elegir falta'} />
                </SelectTrigger>
                <SelectContent>
                  {faults.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name} {f.severity === 'Grave' ? '· Grave' : ''} ({f.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {faultId && faults.find((f) => String(f.id) === faultId)?.severity === 'Grave' && (
                <Badge variant="destructive">Falta grave</Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pi-obs">Observación</Label>
              <Textarea
                id="pi-obs"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Detalle de lo ocurrido (opcional)"
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => void submit()} disabled={!faultId || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar incidencia
              </Button>
            </div>
          </div>
        </StaffDataPanel>
      )}
    </div>
  );
};

export default PersonalRegisterIncident;
