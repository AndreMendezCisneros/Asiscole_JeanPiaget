import { useMemo, useRef, useState } from 'react';
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
import { StaffTablePagination } from '@/components/staff';
import type {
  PensionImpago,
  PensionImportModo,
  PensionImportPreviewRow,
  Student,
} from '@/types';
import { pensionesService, studentsService, whatsappService } from '@/lib/services';
import {
  parsePensionesExcelBuffer,
  pensionMonthShort,
  PENSIONES_EXCEL_MAX_BYTES,
  type PensionExcelFormato,
} from '@/lib/utils/pensionesExcelParser';
import { computeAusentes, matchPensionCandidate } from '@/lib/utils/pensionesMatch';
import { fechaVencimientoForPeriodo, resolveEstadoPension } from '@/lib/utils/pensionPeriod';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { useTablePagination } from '@/hooks/useTablePagination';

type Props = {
  periodo: string;
  diaVencimiento: number;
  montoMensual: number | null;
  onImported: () => void;
};

type PreviewFilter = 'all' | 'ok' | 'sin_match' | 'ambiguo';

function formatMeses(
  meses: number[],
  fallbackPeriodo: string,
  formato: PensionExcelFormato,
): string {
  if (meses.length === 0) {
    if (formato === 'matriz') return '—';
    const month = Number(fallbackPeriodo.slice(5, 7));
    return Number.isFinite(month) ? pensionMonthShort(month) : fallbackPeriodo;
  }
  return meses.map(pensionMonthShort).join(', ');
}

type AusenteRow = PensionImpago & { revisar: boolean };

async function loadAllActiveStudents(): Promise<{ students: Student[]; error: string | null }> {
  const nomina = await pensionesService.listNominaActiva();
  if (!nomina.error && nomina.students.length > 0) {
    return {
      students: nomina.students.map(
        (s) =>
          ({
            id: s.id,
            fullName: s.fullName,
            grade: s.grade || '',
            section: s.section || '',
            level: (s.level as Student['level']) || 'Secundaria',
            barcode: s.barcode,
            active: s.active !== false,
            contactPhone: s.contactPhone ?? null,
            emergencyPhone: s.emergencyPhone ?? null,
          }) satisfies Student,
      ),
      error: null,
    };
  }

  const lite = await studentsService.listLite({ active: true });
  if (!lite.error && lite.students.length > 0) {
    return { students: lite.students, error: null };
  }

  const pageSize = 100;
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  const all: Student[] = [];
  let lastError: string | null = nomina.error || lite.error;

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
  const rosterRef = useRef<Student[]>([]);
  const [modo, setModo] = useState<PensionImportModo>('no_pagaron');
  const [preview, setPreview] = useState<PensionImportPreviewRow[]>([]);
  const [formato, setFormato] = useState<PensionExcelFormato>('plano');
  const [mesesCubiertos, setMesesCubiertos] = useState<number[]>([]);
  const [anioArchivo, setAnioArchivo] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notifyOnImport, setNotifyOnImport] = useState(true);
  const [notifyProgress, setNotifyProgress] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  /** null = no se pudo calcular; se usa la regla antigua del servidor. */
  const [ausentes, setAusentes] = useState<AusenteRow[] | null>(null);
  const [cerrarSel, setCerrarSel] = useState<Set<number>>(new Set());

  const resetFile = () => {
    setPreview([]);
    setAusentes(null);
    setCerrarSel(new Set());
    setFormato('plano');
    setMesesCubiertos([]);
    setAnioArchivo(null);
    setFileName(null);
    setPreviewFilter('all');
    setNotifyProgress(null);
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
      rosterRef.current = indexStudents;

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
          mesesDebe: row.mesesDebe,
        };
      });

      let ausentesRows: AusenteRow[] | null = null;
      if (parsed.formato === 'matriz') {
        const anioFile = parsed.anioTitulo ?? Number(periodo.slice(0, 4));
        const periodos = parsed.mesesCubiertos.map(
          (m) => `${anioFile}-${String(m).padStart(2, '0')}`,
        );
        const impagos = await pensionesService.listImpagosPeriodos(periodos);
        if (impagos.error) {
          toast.error(`No se pudo calcular quiénes ya no salen: ${impagos.error}`);
        } else {
          const { ausentes: aus, protegidos } = computeAusentes(
            impagos.rows,
            rows.filter((r) => r.matchStatus === 'ok').map((r) => r.idEstudiante!),
            rows.filter((r) => r.matchStatus !== 'ok').map((r) => r.rawNombre),
          );
          ausentesRows = [
            ...aus.map((r) => ({ ...r, revisar: false })),
            ...protegidos.map((r) => ({ ...r, revisar: true })),
          ];
        }
      }

      setFormato(parsed.formato);
      setMesesCubiertos(parsed.mesesCubiertos);
      setAnioArchivo(parsed.anioTitulo);
      setPreviewFilter('all');
      setPreview(rows);
      setAusentes(ausentesRows);
      setCerrarSel(
        new Set((ausentesRows ?? []).filter((r) => !r.revisar).map((r) => r.idEstudiante)),
      );
      const ok = rows.filter((r) => r.matchStatus === 'ok').length;
      const sin = rows.filter((r) => r.matchStatus !== 'ok').length;
      if (ok === 0) {
        toast.error(
          `El Excel se leyó (${rows.length} filas), pero ningún DNI/nombre coincide con los ${indexStudents.length} alumnos de SIE.`,
        );
      } else if (sin > 0) {
        toast.success(`Vista previa: ${ok} listos · ${sin} sin match. Usa el filtro para verlos.`);
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

  const filteredPreview = useMemo(() => {
    if (previewFilter === 'all') return preview;
    return preview.filter((r) => r.matchStatus === previewFilter);
  }, [preview, previewFilter]);

  const previewPage = useTablePagination({ totalItems: filteredPreview.length });
  const visiblePreview = filteredPreview.slice(previewPage.sliceRange.start, previewPage.sliceRange.end);

  const anio = anioArchivo ?? Number(periodo.slice(0, 4));

  const sendNotices = async (rows: PensionImportPreviewRow[]) => {
    const debtors = rows.filter((r) => r.mesesDebe.length > 0 || formato === 'plano');
    if (!debtors.length) return;
    if (!whatsappService.isAppNotificationsEnabled()) {
      toast.message('Avisos por aplicación no habilitados en este entorno');
      return;
    }
    let sent = 0;
    let failed = 0;
    const byId = new Map(rosterRef.current.map((s) => [s.id, s]));
    for (let i = 0; i < debtors.length; i += 1) {
      const r = debtors[i];
      setNotifyProgress(`Avisando ${i + 1} de ${debtors.length}`);
      const known = r.idEstudiante != null ? byId.get(r.idEstudiante) : undefined;
      const target: Student =
        known ||
        ({
          id: r.idEstudiante!,
          fullName: r.nombreMatched || r.rawNombre || 'Estudiante',
          grade: '',
          section: '',
          level: 'Secundaria',
          barcode: r.rawDni || '',
          active: true,
          contactPhone: null,
          emergencyPhone: null,
        } satisfies Student);
      const mesesLabel = formatMeses(r.mesesDebe, periodo, formato);
      const app = await whatsappService.notifyParentPensionPending(target, {
        periodo: r.mesesDebe.length
          ? `${anio}-${String(r.mesesDebe[0]).padStart(2, '0')}`
          : periodo,
        monto: r.monto ?? montoMensual,
        mesesLabel,
        skipDedup: true,
      });
      if (app.ok && !app.skipped) sent += 1;
      else if (!app.ok) failed += 1;
    }
    setNotifyProgress(null);
    if (sent > 0) toast.success(`Aplicación: ${sent} avisos de pensión enviados`);
    else if (failed > 0) toast.error(`No se pudieron enviar ${failed} avisos por la aplicación`);
    else toast.message('Sin avisos nuevos por la aplicación');
  };

  const confirmImport = async () => {
    const okRows = preview.filter((r) => r.matchStatus === 'ok' && r.idEstudiante != null);
    if (!okRows.length) {
      toast.error('No hay filas con match para importar');
      return;
    }

    setImporting(true);
    try {
      if (formato === 'matriz') {
        const result = await pensionesService.reconcileDeudas({
          anio,
          meses: mesesCubiertos,
          deudas: okRows.map((r) => ({
            id_estudiante: r.idEstudiante!,
            meses: r.mesesDebe,
          })),
          nombreArchivo: fileName,
          filasSinMatch: counts.sin,
          filasAmbiguas: counts.amb,
          cerrarIds: ausentes ? [...cerrarSel] : undefined,
        });
        if (!result.ok) {
          toast.error(result.error || 'Error al importar');
          return;
        }
        toast.success(
          ausentes
            ? `Deudas actualizadas: ${result.filasOk ?? okRows.length} alumnos · Puestos al día: ${cerrarSel.size}`
            : `Deudas actualizadas: ${result.filasOk ?? okRows.length} alumnos`,
        );
        if (!ausentes && !result.cerroAusentes && counts.sin + counts.amb > 0) {
          toast.message(
            'Hay filas sin match: no se marcaron como pagados los alumnos que no aparecen, para no borrar deudas por error.',
          );
        }
      } else {
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
        toast.success(`Importadas ${result.filasOk ?? okRows.length} filas`);
      }

      const toNotify = [...okRows];
      const shouldNotify = notifyOnImport && (formato === 'matriz' || modo === 'no_pagaron');
      resetFile();
      onImported();
      if (shouldNotify) void sendNotices(toNotify);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {formato !== 'matriz' && (
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
      )}

      {(formato === 'matriz' || modo === 'no_pagaron') && (
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
            {fileName}
            {formato === 'matriz' ? ` · deudas ${anio}` : ''} — solo en memoria
          </span>
        )}
        {notifyProgress && <span className="text-sm text-muted-foreground">{notifyProgress}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        El reporte de deudas usa Doc. Alu. como DNI y Apellidos y Nombres. Cada columna de mes con
        DEBE queda sin pagar. Si el archivo es una lista de un solo mes, se importa al periodo
        elegido arriba.
      </p>

      {preview.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <Button
              type="button"
              size="sm"
              variant={previewFilter === 'all' ? 'default' : 'outline'}
              onClick={() => {
                setPreviewFilter('all');
                previewPage.resetPage();
              }}
            >
              Todos: {preview.length}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewFilter === 'ok' ? 'default' : 'outline'}
              onClick={() => {
                setPreviewFilter('ok');
                previewPage.resetPage();
              }}
            >
              OK: {counts.ok}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewFilter === 'sin_match' ? 'default' : 'outline'}
              onClick={() => {
                setPreviewFilter('sin_match');
                previewPage.resetPage();
              }}
            >
              Sin match: {counts.sin}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewFilter === 'ambiguo' ? 'default' : 'outline'}
              onClick={() => {
                setPreviewFilter('ambiguo');
                previewPage.resetPage();
              }}
            >
              Ambiguos: {counts.amb}
            </Button>
          </div>
          {formato === 'matriz' && counts.sin + counts.amb > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              Hay {counts.sin + counts.amb} filas sin match o ambiguas: no se importan. Revísalas con
              el filtro. Los alumnos cuyo nombre se parece a esas filas quedan sin marcar abajo.
            </div>
          )}

          {formato === 'matriz' && ausentes && ausentes.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Ya no salen en el Excel: se pondrán al día {cerrarSel.size} de {ausentes.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCerrarSel(new Set(ausentes.map((a) => a.idEstudiante)))}
                  >
                    Marcar todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCerrarSel(new Set())}
                  >
                    Ninguno
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tenían meses sin pagar que este archivo ya no muestra como DEBE. Los marcados quedan
                pagados en esos meses.
              </p>
              <div className="max-h-64 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Alumno</TableHead>
                      <TableHead>Grado</TableHead>
                      <TableHead>Meses que tenía pendientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ausentes.map((a) => (
                      <TableRow key={a.idEstudiante}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Poner al día a ${a.nombreEstudiante}`}
                            checked={cerrarSel.has(a.idEstudiante)}
                            onChange={(e) =>
                              setCerrarSel((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(a.idEstudiante);
                                else next.delete(a.idEstudiante);
                                return next;
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {a.nombreEstudiante}
                          {a.revisar && (
                            <Badge variant="outline" className="ml-2">
                              revisar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {[a.grado, a.seccion].filter(Boolean).join(' ') || '—'}
                        </TableCell>
                        <TableCell>
                          {a.periodos.map((p) => pensionMonthShort(Number(p.slice(5, 7)))).join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Nombre Excel</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Meses que debe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePreview.map((r) => (
                  <TableRow key={r.rowIndex}>
                    <TableCell>{r.rowIndex}</TableCell>
                    <TableCell className="font-mono text-xs">{r.rawDni || '—'}</TableCell>
                    <TableCell>{r.rawNombre || '—'}</TableCell>
                    <TableCell>{r.nombreMatched || '—'}</TableCell>
                    <TableCell>{r.matchStatus}</TableCell>
                    <TableCell>{formatMeses(r.mesesDebe, periodo, formato)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <StaffTablePagination
            page={previewPage.page}
            totalPages={previewPage.totalPages}
            pageSize={previewPage.pageSize}
            totalItems={filteredPreview.length}
            onPrev={previewPage.prevPage}
            onNext={previewPage.nextPage}
            onGoToPage={previewPage.goToPage}
            onPageSizeChange={previewPage.changePageSize}
          />
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
