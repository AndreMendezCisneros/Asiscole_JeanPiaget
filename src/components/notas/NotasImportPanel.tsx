import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/types';
import type { NotasArea, NotasDeclaracion, NotasImportPreviewRow } from '@/types/notas';
import { notasService, studentsService, whatsappService } from '@/lib/services';
import {
  isNotaValida,
  NOTAS_EXCEL_MAX_BYTES,
  parseNotasExcelBuffer,
} from '@/lib/utils/notasExcelParser';
import { matchNotasCandidate } from '@/lib/utils/notasMatch';
import { loadActiveNomina } from '@/lib/utils/loadActiveNomina';
import { downloadNotasImportNominaTemplate } from '@/lib/utils/nominaExcelTemplates';

type Props = {
  semanaId: number;
  semanaCodigo: string;
  semanaEtiqueta: string;
  semanaFechaInicio?: string;
  semanaFechaFin?: string;
  semanaAbiertaCarga: boolean;
  declaraciones?: NotasDeclaracion[];
  areas?: NotasArea[];
  onImported: () => void;
};

export function NotasImportPanel({
  semanaId,
  semanaCodigo,
  semanaEtiqueta,
  semanaFechaInicio,
  semanaFechaFin,
  semanaAbiertaCarga,
  declaraciones = [],
  areas = [],
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<NotasImportPreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const { students, error } = await loadActiveNomina();
      if (error) {
        toast.error(error);
        return;
      }
      if (!students.length) {
        toast.error('No hay alumnos activos para armar la plantilla');
        return;
      }
      await downloadNotasImportNominaTemplate(students, { declaraciones });
      toast.success(`Plantilla con ${students.length} alumnos. Escriba la nota (0–20) en la columna Nota.`);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar la plantilla');
    } finally {
      setDownloading(false);
    }
  };

  const resetFile = () => {
    setPreview([]);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!semanaAbiertaCarga) {
      toast.error('La carga de notas de esta semana está cerrada');
      return;
    }
    if (file.size > NOTAS_EXCEL_MAX_BYTES) {
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
      const parsed = await parseNotasExcelBuffer(buffer);
      if (!parsed.rows.length) {
        toast.error('No se detectaron filas con DNI/nombre y nota en el Excel');
        resetFile();
        return;
      }

      const { students: indexStudents, error } = await loadActiveNomina();
      if (error) {
        toast.error(error);
        resetFile();
        return;
      }

      const index = indexStudents.map((s) => ({
        id: s.id,
        barcode: s.barcode,
        fullName: s.fullName,
      }));

      const rows: NotasImportPreviewRow[] = parsed.rows.map((row) => {
        const match = matchNotasCandidate(
          { rawDni: row.rawDni, rawNombre: row.rawNombre },
          index,
        );
        return {
          rowIndex: row.rowIndex,
          rawDni: row.rawDni,
          rawNombre: row.rawNombre,
          nota: row.nota,
          observacion: row.observacion,
          carreraNombre: row.carreraNombre,
          areaCodigo: row.areaCodigo,
          matchStatus: match.status,
          idEstudiante: match.idEstudiante,
          nombreMatched: match.nombreMatched,
        };
      });

      setPreview(rows);
      const ok = rows.filter((r) => r.matchStatus === 'ok' && isNotaValida(r.nota)).length;
      const sinCarrera = rows.filter(
        (r) =>
          r.matchStatus === 'ok' &&
          isNotaValida(r.nota) &&
          !r.carreraNombre?.trim() &&
          !r.areaCodigo?.trim(),
      ).length;
      const sin = rows.length - ok;
      if (ok === 0) {
        toast.error(
          `Se leyeron ${rows.length} filas, pero ninguna tiene match + nota 0–20 válida.`,
        );
      } else if (sinCarrera > 0) {
        toast.message(
          `${sinCarrera} filas sin carrera/área: si el alumno no declaró antes, no se importarán.`,
        );
      } else if (sin > 0) {
        toast.success(`Vista previa: ${ok} listas · ${sin} omitibles`);
      } else {
        toast.success(`Vista previa: ${rows.length} filas`);
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
    ok: preview.filter((r) => r.matchStatus === 'ok' && isNotaValida(r.nota)).length,
    sin: preview.filter((r) => r.matchStatus === 'sin_match').length,
    amb: preview.filter((r) => r.matchStatus === 'ambiguo').length,
    notaInvalida: preview.filter(
      (r) => r.matchStatus === 'ok' && !isNotaValida(r.nota),
    ).length,
    sinCarrera: preview.filter(
      (r) =>
        r.matchStatus === 'ok' &&
        isNotaValida(r.nota) &&
        !r.carreraNombre?.trim() &&
        !r.areaCodigo?.trim(),
    ).length,
  };

  const confirmImport = async () => {
    if (!semanaAbiertaCarga) {
      toast.error('La carga de notas de esta semana está cerrada');
      return;
    }
    const okRows = preview.filter(
      (r) => r.matchStatus === 'ok' && r.idEstudiante != null && isNotaValida(r.nota),
    );
    if (!okRows.length) {
      toast.error('No hay filas válidas para importar');
      return;
    }

    setImporting(true);
    try {
      const filas = preview.map((r) => {
        if (r.matchStatus !== 'ok' || r.idEstudiante == null || !isNotaValida(r.nota)) {
          return {
            id_estudiante: r.idEstudiante ?? 0,
            nota: r.nota ?? -1,
            observacion: r.observacion,
            carrera_nombre: r.carreraNombre,
            area_codigo: r.areaCodigo,
            match_status: r.matchStatus === 'ok' ? 'sin_match' : r.matchStatus,
          };
        }
        return {
          id_estudiante: r.idEstudiante,
          nota: r.nota,
          observacion: r.observacion,
          carrera_nombre: r.carreraNombre,
          area_codigo: r.areaCodigo,
          match_status: 'ok' as const,
        };
      });

      const result = await notasService.upsertLote(semanaId, filas, fileName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Importadas ${result.filasOk} · sin área/carrera ${result.filasSinDeclaracion} · sin match ${result.filasSinMatch}`,
      );

      if (result.filasOk > 0) {
        if (!whatsappService.isAppNotificationsEnabled()) {
          toast.message('Avisos por aplicación no habilitados en este entorno');
        } else {
          // Solo avisar filas que pudieron entrar (con carrera/área o sin fallos de declaración).
          const notifyRows =
            result.filasSinDeclaracion === 0
              ? okRows
              : okRows.filter((r) => r.carreraNombre?.trim() || r.areaCodigo?.trim());
          const { notas: notasGuardadas } = await notasService.listNotas(semanaId);
          const notaByStudent = new Map(
            (notasGuardadas || []).map((n) => [n.idEstudiante, n]),
          );
          let sent = 0;
          let failed = 0;
          for (const r of notifyRows.slice(0, result.filasOk)) {
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
            const decl = declaraciones.find((d) => d.idEstudiante === r.idEstudiante);
            const areaFromCatalog = areas.find((a) => {
              const code = r.areaCodigo?.trim().toLowerCase();
              if (!code) return false;
              return a.codigo.toLowerCase() === code || a.nombre.toLowerCase() === code;
            });
            const saved = notaByStudent.get(r.idEstudiante!);
            const app = await whatsappService.notifyParentNota(target, {
              semanaCodigo,
              semanaEtiqueta,
              nota: r.nota!,
              carreraNombre: r.carreraNombre || saved?.carreraNombre || decl?.carreraNombre,
              areaCodigo: r.areaCodigo,
              areaNombre:
                decl?.areaNombre ||
                saved?.areaNombre ||
                areaFromCatalog?.nombre ||
                null,
              fechaInicio: semanaFechaInicio,
              fechaFin: semanaFechaFin,
              registradoEn: saved?.registradoEn || null,
              idRegistro: saved?.id,
            });
            if (app.ok && !app.skipped) sent += 1;
            else if (!app.ok) failed += 1;
          }
          if (sent > 0) {
            toast.success(`Aplicación: ${sent} avisos de nota enviados a padres`);
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
      {!semanaAbiertaCarga && (
        <p className="text-sm text-destructive">
          Esta semana tiene la carga de notas cerrada. Ábrela en Configuración.
        </p>
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
          disabled={downloading}
          onClick={() => void downloadTemplate()}
        >
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="mr-2 h-4 w-4" />
          )}
          Descargar plantilla
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={parsing || !semanaAbiertaCarga}
          onClick={() => inputRef.current?.click()}
        >
          {parsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Elegir Excel
        </Button>
        {fileName && (
          <span className="text-sm text-muted-foreground">
            {fileName} — solo en memoria
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Descargue la plantilla con toda la nómina. Escriba la calificación (0–20) en la columna{' '}
        <strong>Nota</strong> — no se carga en Declaraciones. Columnas: DNI, Nombre, Nota, Carrera,
        Área, Observación. Si no hay declaración previa, la carrera/área del Excel crea la
        declaración automáticamente.
      </p>

      {preview.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="default">OK: {counts.ok}</Badge>
            <Badge variant="secondary">Sin match: {counts.sin}</Badge>
            <Badge variant="outline">Ambiguos: {counts.amb}</Badge>
            {counts.sinCarrera > 0 && (
              <Badge variant="outline">Sin carrera/área: {counts.sinCarrera}</Badge>
            )}
            {counts.notaInvalida > 0 && (
              <Badge variant="destructive">Nota inválida: {counts.notaInvalida}</Badge>
            )}
          </div>
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Nombre Excel</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Carrera</TableHead>
                  <TableHead>Nota</TableHead>
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
                    <TableCell className="text-xs">
                      {r.carreraNombre || r.areaCodigo || '—'}
                    </TableCell>
                    <TableCell>{r.nota ?? '—'}</TableCell>
                    <TableCell>
                      {r.matchStatus === 'ok' && !isNotaValida(r.nota)
                        ? 'nota_invalida'
                        : r.matchStatus}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void confirmImport()}
              disabled={importing || counts.ok === 0 || !semanaAbiertaCarga}
            >
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
