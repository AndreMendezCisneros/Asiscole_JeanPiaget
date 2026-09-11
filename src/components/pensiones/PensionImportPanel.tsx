import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { PensionImportModo, PensionImportPreviewRow, Student } from '@/types';
import { pensionesService, studentsService, whatsappService } from '@/lib/services';
import {
  parsePensionesExcelBuffer,
  PENSIONES_EXCEL_MAX_BYTES,
} from '@/lib/utils/pensionesExcelParser';
import { matchPensionCandidate } from '@/lib/utils/pensionesMatch';
import { fechaVencimientoForPeriodo, resolveEstadoPension } from '@/lib/utils/pensionPeriod';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';

type Props = {
  periodo: string;
  diaVencimiento: number;
  montoMensual: number | null;
  onImported: () => void;
};

async function loadAllActiveStudents(): Promise<{ students: Student[]; error: string | null }> {
  const lite = await studentsService.listLite({ active: true });
  if (!lite.error && lite.students.length >= 20) {
    return { students: lite.students, error: null };
  }
  if (!lite.error && lite.students.length > 0) {
    // Menos de 20 activos: aún así lo aceptamos, no hace falta paginar.
    return { students: lite.students, error: null };
  }

  const pageSize = 100;
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  const all: Student[] = [];
  let lastError: string | null = lite.error;

  while (all.length < total && page <= 50) {
    const res = await studentsService.getAll({ active: true, page, pageSize });
    if (res.error) {
      lastError = res.error;
      break;
    }
    all.push(...res.students);
    total = res.total || all.length;
    if (res.students.length === 0) break;
    page += 1;
  }

  if (all.length > 0) return { students: all, error: null };
  return { students: [], error: lastError || 'Nómina vacía' };
}

export function PensionImportPanel({
  periodo,
  diaVencimiento,
  montoMensual,
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<PensionImportModo>('pagaron');
  const [preview, setPreview] = useState<PensionImportPreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notifyOnImport, setNotifyOnImport] = useState(true);

  const resetFile = () => {
    setPreview([]);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > PENSIONES_EXCEL_MAX_BYTES) {
      toast.error('El archivo supera 8 MB');
      return;
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error('Solo se admiten .xlsx o .xls');
      return;
    }

    setParsing(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parsePensionesExcelBuffer(buffer);
      if (!parsed.rows.length) {
        toast.error('No se detectaron filas con DNI/nombre en el Excel');
        resetFile();
        return;
      }

      const { students: indexStudents, error } = await loadAllActiveStudents();
      if (error) {
        toast.error(error);
        resetFile();
        return;
      }

      if (indexStudents.length === 0) {
        toast.error('No se pudo cargar la nómina de estudiantes para hacer match');
        resetFile();
        return;
      }

      const index = indexStudents.map((s) => ({
        id: s.id,
        barcode: s.barcode,
        fullName: s.fullName,
      }));

      const rows: PensionImportPreviewRow[] = parsed.rows.map((row) => {
        const match = matchPensionCandidate(
          { rawDni: row.rawDni, rawNombre: row.rawNombre },
          index,
        );
        return {
          rowIndex: row.rowIndex,
          rawDni: row.rawDni,
          rawNombre: row.rawNombre,
          monto: row.monto,
          fechaPago: row.fechaPago,
          matchStatus: match.status,
          idEstudiante: match.idEstudiante,
          nombreMatched: match.nombreMatched,
        };
      });

      setPreview(rows);
      const ok = rows.filter((r) => r.matchStatus === 'ok').length;
      const sin = rows.length - ok;
      if (ok === 0) {
        toast.error(
          `El Excel se leyó (${rows.length} filas), pero ningún DNI/nombre coincide con los ${indexStudents.length} alumnos de SIE. Revisa que sean alumnos de este colegio.`,
        );
      } else if (sin > 0) {
        toast.success(
          `Vista previa: ${ok} listos para importar · ${sin} sin match (se omiten al confirmar)`,
        );
      } else {
        toast.success(`Vista previa: ${rows.length} filas · todas coinciden`);
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudo leer el Excel');
      resetFile();
    } finally {
      setParsing(false);
    }
  };

  const counts = {
    ok: preview.filter((r) => r.matchStatus === 'ok').length,
    sin: preview.filter((r) => r.matchStatus === 'sin_match').length,
    amb: preview.filter((r) => r.matchStatus === 'ambiguo').length,
  };

  const confirmImport = async () => {
    const okRows = preview.filter((r) => r.matchStatus === 'ok' && r.idEstudiante != null);
    if (!okRows.length) {
      toast.error('No hay filas con match para importar');
      return;
    }

    setImporting(true);
    try {
      const hoy = getLimaTodayDate();
      const venc = fechaVencimientoForPeriodo(periodo, diaVencimiento);
      const filas = okRows.map((r) => {
        if (modo === 'pagaron') {
          return {
            id_estudiante: r.idEstudiante!,
            pagado: 1 as const,
            estado: 'pagado' as const,
            monto: r.monto ?? montoMensual,
            fecha_pago: r.fechaPago,
          };
        }
        const estado = resolveEstadoPension({ pagado: 0, fechaVencimiento: venc, hoyLima: hoy });
        return {
          id_estudiante: r.idEstudiante!,
          pagado: 0 as const,
          estado,
          monto: r.monto ?? montoMensual,
          fecha_pago: null as string | null,
        };
      });

      const result = await pensionesService.importLote({
        periodo,
        modo,
        nombreArchivo: fileName,
        filas,
        filasSinMatch: counts.sin,
        filasAmbiguas: counts.amb,
      });

      if (!result.ok) {
        toast.error(result.error || 'Error al importar');
        return;
      }

      toast.success(`Importadas ${result.filasOk ?? okRows.length} filas (archivo descartado)`);

      if (modo === 'no_pagaron' && notifyOnImport) {
        if (!whatsappService.isAppNotificationsEnabled()) {
          toast.message('Avisos por aplicación no habilitados en este entorno');
        } else {
          let sent = 0;
          let failed = 0;
          for (const r of okRows) {
            const { student: full } = await studentsService.getById(r.idEstudiante!);
            const target =
              full ||
              ({
                id: r.idEstudiante!,
                fullName: r.nombreMatched || r.rawNombre || 'Estudiante',
                grade: '',
                section: '',
                level: 'Secundaria' as const,
                barcode: r.rawDni || '',
                active: true,
                contactPhone: null,
                emergencyPhone: null,
              } satisfies Student);
            const app = await whatsappService.notifyParentPensionPending(target, {
              periodo,
              monto: r.monto ?? montoMensual,
            });
            if (app.ok && !app.skipped) sent += 1;
            else if (!app.ok) failed += 1;
          }
          if (sent > 0) {
            toast.success(`Aplicación: ${sent} avisos de pensión enviados`);
          } else if (failed > 0) {
            toast.error(`No se pudieron enviar ${failed} avisos por la aplicación`);
          } else {
            toast.message('Sin avisos nuevos por la aplicación (ya notificados o sin destino)');
          }
        }
      }

      resetFile();
      onImported();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label>Modo de importación</Label>
        <RadioGroup
          value={modo}
          onValueChange={(v) => setModo(v as PensionImportModo)}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="pagaron" id="modo-pagaron" />
            <Label htmlFor="modo-pagaron">Pagaron</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no_pagaron" id="modo-no" />
            <Label htmlFor="modo-no">No pagaron</Label>
          </div>
        </RadioGroup>
      </div>

      {modo === 'no_pagaron' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notifyOnImport}
            onChange={(e) => setNotifyOnImport(e.target.checked)}
          />
          Notificar por la aplicación a padres (tras confirmar)
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={parsing}
          onClick={() => inputRef.current?.click()}
        >
          {parsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Elegir Excel
        </Button>
        <Button type="button" variant="ghost" disabled title="Fase 2">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          PDF (próximamente)
        </Button>
        {fileName && (
          <span className="text-sm text-muted-foreground">
            {fileName} — solo en memoria, no se sube a Storage
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Sube el Excel del banco (pagaron o no pagaron). El sistema detecta columnas (DNI, nombre,
        monto, fecha) y cruza cada fila con la nómina de SIE. Solo se importan las filas con match;
        las «Sin match» se omiten.
      </p>

      {preview.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="default">OK: {counts.ok}</Badge>
            <Badge variant="secondary">Sin match: {counts.sin}</Badge>
            <Badge variant="outline">Ambiguos: {counts.amb}</Badge>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Nombre Excel</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.slice(0, 100).map((r) => (
                  <TableRow key={r.rowIndex}>
                    <TableCell>{r.rowIndex}</TableCell>
                    <TableCell className="font-mono text-xs">{r.rawDni || '—'}</TableCell>
                    <TableCell>{r.rawNombre || '—'}</TableCell>
                    <TableCell>{r.nombreMatched || '—'}</TableCell>
                    <TableCell>{r.matchStatus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void confirmImport()} disabled={importing || counts.ok === 0}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar importación ({counts.ok})
            </Button>
            <Button type="button" variant="outline" onClick={resetFile} disabled={importing}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
