import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, Upload, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffDataPanel, StaffDataPanelHeader, StaffWorkflowSteps } from '@/components/staff';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { authService } from '@/lib/services';
import { personalService } from '@/lib/services/personalService';
import { personalIncidentsService } from '@/lib/services/personalIncidentsService';
import { useFaultsQuery } from '@/hooks/queries/useFaultsQuery';
import { formatScheduleSummary } from '@/lib/utils/personalSchedule';
import type { Personal } from '@/types/personal';

interface PersonalIncidentFormProps {
  /** Empleado ya elegido (por ejemplo, el recién escaneado). */
  initialPersonal?: Personal | null;
  onDone?: () => void;
  onCancel?: () => void;
}

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

/** Registrar una incidencia del personal: lo usan RR.HH., Admin y Tutor. */
export const PersonalIncidentForm = ({ initialPersonal = null, onDone, onCancel }: PersonalIncidentFormProps) => {
  const { data: faults = [], isLoading: loadingFaults } = useFaultsQuery(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Personal[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Personal | null>(initialPersonal);
  const [faultId, setFaultId] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

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

  const clearEvidence = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setEvidenceFiles([]);
    setEvidencePreviews([]);
  };

  const reset = () => {
    setSelected(null);
    setFaultId('');
    setObservations('');
    setQuery('');
    setResults([]);
    clearEvidence();
  };

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (evidenceFiles.length + files.length > MAX_PHOTOS) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos permitidas`);
      return;
    }
    const valid = files.filter((file) => {
      if (!file.type.match(/^image\/(jpeg|png)$/)) {
        toast.error(`${file.name}: Solo se permiten archivos JPG o PNG`);
        return false;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: El archivo no puede superar los 5MB`);
        return false;
      }
      return true;
    });
    setEvidenceFiles((prev) => [...prev, ...valid]);
    valid.forEach((file) => {
      const url = URL.createObjectURL(file);
      previewUrlsRef.current.push(url);
      setEvidencePreviews((prev) => [...prev, url]);
    });
  };

  const removeEvidence = (index: number) => {
    const url = evidencePreviews[index];
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== url);
    }
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setEvidencePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    const user = authService.getCurrentUser();
    if (!selected || !faultId || !user) return;
    setSaving(true);
    const { id, error } = await personalIncidentsService.create({
      personalId: selected.id,
      faultId: Number(faultId),
      userId: user.id,
      observations,
    });
    if (error || !id) {
      setSaving(false);
      toast.error(error ?? 'No se pudo registrar la incidencia');
      return;
    }
    if (evidenceFiles.length > 0) {
      const results = await Promise.all(
        evidenceFiles.map((file) => personalIncidentsService.uploadEvidence(id, file, user.id)),
      );
      const failed = results.filter((r) => r.error).length;
      if (failed > 0) {
        toast.warning(`Incidencia Nº ${id} guardada, pero ${failed} de ${evidenceFiles.length} fotos no se subieron`);
      } else {
        toast.success(`Incidencia Nº ${id} registrada para ${selected.fullName} · ${evidenceFiles.length} foto(s)`);
      }
    } else {
      toast.success(`Incidencia Nº ${id} registrada para ${selected.fullName}`);
    }
    setSaving(false);
    reset();
    onDone?.();
  };

  return (
    <>
      <StaffWorkflowSteps
        steps={[
          { id: 'empleado', label: 'Empleado', description: 'Nombre o DNI' },
          { id: 'falta', label: 'Falta', description: 'Del catálogo' },
          { id: 'registrar', label: 'Registrar', description: 'Evidencia opcional' },
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
          <StaffDataPanelHeader
            title="2. Falta y evidencia"
            description="Mismo catálogo de faltas que estudiantes. La foto es opcional."
          />
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
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Evidencia fotográfica (opcional)</Label>
              <label className="block cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:bg-muted/50">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  onChange={handleEvidenceChange}
                  className="hidden"
                  disabled={saving || evidenceFiles.length >= MAX_PHOTOS}
                />
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Hasta {MAX_PHOTOS} fotos (JPG/PNG, máx. 5 MB)
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {evidenceFiles.length} de {MAX_PHOTOS} seleccionadas
                </p>
              </label>
              {evidencePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {evidencePreviews.map((preview, index) => (
                    <div key={preview} className="group relative">
                      <img
                        src={preview}
                        alt={`Evidencia ${index + 1}`}
                        className="h-32 w-full rounded-lg border object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => removeEvidence(index)}
                        disabled={saving}
                        aria-label={`Quitar evidencia ${index + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  onCancel?.();
                }}
                disabled={saving}
              >
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
    </>
  );
};
