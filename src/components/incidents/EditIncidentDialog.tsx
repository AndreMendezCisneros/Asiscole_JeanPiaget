import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFaultsQuery } from '@/hooks/queries/useFaultsQuery';
import type { IncidentEvidence } from '@/types';

type Result = { error: string | null };

export interface EditIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ej.: nombre del alumno/empleado · fecha. */
  subtitle: string;
  faultId: number;
  /** Nota editable de la observación. */
  observation: string;
  /** Parte fija de la observación (incidencias automáticas); se muestra pero no se edita. */
  fixedPrefix?: string;
  /** Nombre a mostrar de cada falta del catálogo (Personal muestra «Falta» como «Inasistencia»). */
  faultLabel?: (name: string) => string;
  loadEvidences: () => Promise<{ evidences: IncidentEvidence[]; error: string | null }>;
  onUpload: (file: File) => Promise<Result>;
  onDeleteEvidence: (evidenceId: number) => Promise<Result>;
  onSave: (input: { faultId: number; observation: string }) => Promise<Result>;
  /** Se llama tras guardar o cambiar fotos, para recargar la lista. */
  onChanged: () => void;
}

export function EditIncidentDialog({
  open,
  onOpenChange,
  subtitle,
  faultId: initialFaultId,
  observation: initialObservation,
  fixedPrefix,
  faultLabel = (n) => n,
  loadEvidences,
  onUpload,
  onDeleteEvidence,
  onSave,
  onChanged,
}: EditIncidentDialogProps) {
  const { data: faults = [], isLoading: loadingFaults } = useFaultsQuery(true);
  const [faultId, setFaultId] = useState(String(initialFaultId));
  const [observation, setObservation] = useState(initialObservation);
  const [evidences, setEvidences] = useState<IncidentEvidence[]>([]);
  const [loadingEv, setLoadingEv] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reloadEvidences = async () => {
    setLoadingEv(true);
    const { evidences: rows, error } = await loadEvidences();
    if (error) toast.error('No se pudieron cargar las fotos de evidencia');
    setEvidences(rows);
    setLoadingEv(false);
  };

  useEffect(() => {
    if (!open) return;
    setFaultId(String(initialFaultId));
    setObservation(initialObservation);
    setConfirmDeleteId(null);
    void reloadEvidences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFaultId, initialObservation]);

  // La falta actual puede estar inactiva en el catálogo: se agrega para no perderla.
  const currentMissing = !faults.some((f) => f.id === initialFaultId);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      const { error } = await onUpload(file);
      if (error) toast.error(`${file.name}: ${error}`);
      else ok += 1;
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (ok > 0) {
      toast.success(ok === 1 ? 'Foto agregada' : `${ok} fotos agregadas`);
      await reloadEvidences();
      onChanged();
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    const { error } = await onDeleteEvidence(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Foto quitada');
    setEvidences((prev) => prev.filter((e) => e.id !== id));
    onChanged();
  };

  const handleSave = async () => {
    const id = Number(faultId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Elija la falta');
      return;
    }
    setSaving(true);
    const { error } = await onSave({ faultId: id, observation });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Incidencia actualizada');
    onChanged();
    onOpenChange(false);
  };

  const selectedFault = faults.find((f) => String(f.id) === faultId);
  const busy = saving || uploading || deletingId !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar incidencia</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Falta</Label>
            <Select value={faultId} onValueChange={setFaultId} disabled={loadingFaults || busy}>
              <SelectTrigger>
                <SelectValue placeholder={loadingFaults ? 'Cargando…' : 'Elegir falta'} />
              </SelectTrigger>
              <SelectContent>
                {currentMissing && (
                  <SelectItem value={String(initialFaultId)}>Falta actual (#{initialFaultId})</SelectItem>
                )}
                {faults.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {faultLabel(f.name)} {f.severity === 'Grave' ? '· Grave' : ''} ({f.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFault?.severity === 'Grave' && <Badge variant="destructive">Falta grave</Badge>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-inc-obs">Observación</Label>
            {fixedPrefix && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{fixedPrefix}</p>
            )}
            <Textarea
              id="edit-inc-obs"
              rows={3}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder={fixedPrefix ? 'Nota adicional (opcional)' : 'Observación'}
              disabled={busy}
            />
          </div>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Fotos de evidencia</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                Agregar foto
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Las fotos se agregan o quitan al momento (JPG o PNG, hasta 5 MB).</p>
            {loadingEv ? (
              <p className="text-sm text-muted-foreground">Cargando fotos…</p>
            ) : evidences.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin evidencia</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {evidences.map((ev) => (
                  <div key={ev.id} className="relative">
                    <a href={ev.url} target="_blank" rel="noreferrer" className="block">
                      <img src={ev.url} alt={ev.filename} className="h-24 w-full rounded-md border object-cover" />
                    </a>
                    {confirmDeleteId === ev.id ? (
                      <div className="mt-1 flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 flex-1 px-2 text-xs"
                          onClick={() => void handleDelete(ev.id)}
                          disabled={deletingId !== null}
                        >
                          {deletingId === ev.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Quitar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 px-2 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId !== null}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1 h-7 w-full px-2 text-xs"
                        onClick={() => setConfirmDeleteId(ev.id)}
                        disabled={busy}
                        aria-label={`Quitar foto ${ev.filename}`}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Quitar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cerrar
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || !faultId}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditIncidentDialog;
