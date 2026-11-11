import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileDown, FileText, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { evidenceMimeOf, personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { exportPersonalJustificationPdf } from '@/lib/utils/exportPersonalJustificationPdf';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

const MAX_BYTES = 5 * 1024 * 1024;

/** Elegir una evidencia (foto JPG/PNG o PDF, máx. 5 MB) con vista previa. */
export function JustificationEvidencePicker({
  file,
  onChange,
  disabled,
  label = 'Evidencia (opcional)',
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || evidenceMimeOf(file) === 'application/pdf') {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!picked) return;
    if (!evidenceMimeOf(picked)) {
      toast.error('Solo fotos (JPG o PNG) o PDF');
      return;
    }
    if (evidenceMimeOf(picked) === 'application/pdf' && picked.size > MAX_BYTES) {
      toast.error('El PDF no puede superar los 5 MB');
      return;
    }
    onChange(picked);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border p-3">
          {preview ? (
            <img src={preview} alt="Vista previa de la evidencia" className="h-16 w-16 rounded-md border object-cover" />
          ) : (
            <FileText className="h-10 w-10 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <p className="min-w-0 flex-1 truncate text-sm">{file.name}</p>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} disabled={disabled} aria-label="Quitar evidencia">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-4 text-center transition-colors hover:bg-muted/50">
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={pick} className="hidden" disabled={disabled} />
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Foto (JPG/PNG) o PDF, máx. 5 MB</p>
        </label>
      )}
    </div>
  );
}

/** Botones de una justificación ya hecha: ver/descargar evidencia y PDF de la justificación. */
export function JustificationRowActions({ record, personal }: { record: PersonalArrivalRecord; personal: Personal }) {
  const [busy, setBusy] = useState<'pdf' | 'ev' | null>(null);

  const openEvidence = async () => {
    if (!record.evidence) return;
    setBusy('ev');
    try {
      const url = await personalAttendanceService.evidenceUrl(record.evidence.path);
      window.open(url, '_blank', 'noopener');
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const url = record.evidence ? await personalAttendanceService.evidenceUrl(record.evidence.path) : null;
      await exportPersonalJustificationPdf(record, personal, url);
    } catch {
      toast.error('No se pudo generar el PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {record.evidence && (
        <Button variant="outline" size="sm" onClick={() => void openEvidence()} disabled={busy !== null} title={record.evidence.fileName}>
          {busy === 'ev' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-1 h-3.5 w-3.5" />}
          Evidencia
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => void downloadPdf()} disabled={busy !== null}>
        {busy === 'pdf' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1 h-3.5 w-3.5" />}
        PDF
      </Button>
    </div>
  );
}
