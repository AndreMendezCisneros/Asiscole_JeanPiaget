import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, FileDown, FileSpreadsheet, RefreshCw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffTablePagination,
  StaffToolbar,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { PersonalCategorySelect, PersonalSearchField } from '@/components/personal/PersonalFilters';
import { matchesPersonalFilter, type CategoryFilter } from '@/lib/utils/personalFilter';
import { usePersonalAttendance } from '@/hooks/usePersonalAttendance';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { dateKeysBetween, monthStartOf, resolveDayStatus } from '@/lib/utils/personalAttendanceRows';
import { scheduleForDate } from '@/lib/utils/personalSchedule';
import { summarizePersonalAttendance, totalsOf } from '@/lib/utils/personalReportStats';
import { addDataSheet, createWorkbook, runExcelExport, saveWorkbook } from '@/lib/utils/excelExport';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';

/** Abreviatura por día para la hoja de detalle. */
const STATUS_SHORT: Record<string, string> = {
  'A tiempo': 'A',
  Tarde: 'T',
  'Tarde justificada': 'TJ',
  Falta: 'F',
  'Falta justificada': 'FJ',
  'Fuera de horario': 'FH',
  'Sin llegada': 'F',
  Pendiente: '',
  'No le toca': '-',
};

export const PersonalAttendanceReport = () => {
  const today = getLimaTodayDate();
  const [from, setFrom] = useState(monthStartOf(today));
  const [to, setTo] = useState(today);
  const { personal, records, loading, refreshing, reload } = usePersonalAttendance(from, to);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const summary = useMemo(
    () =>
      summarizePersonalAttendance(
        personal.filter((p) => matchesPersonalFilter(p, search, category)),
        records,
        from,
        to,
        today,
      ),
    [personal, records, from, to, today, search, category],
  );
  const totals = totalsOf(summary);

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: summary.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = summary.slice((page - 1) * pageSize, page * pageSize);
  const subtitle = buildFilterSubtitle([`Del ${from} al ${to}`, category !== 'all' && category]);

  const summaryRow = (s: (typeof summary)[number]) => ({
    empleado: s.personal.fullName,
    categoria: s.personal.category,
    programados: s.scheduledDays,
    atiempo: s.onTime,
    tarde: s.late,
    tj: s.lateJustified,
    faltas: s.absent + s.noRecord,
    fj: s.absentJustified,
    fh: s.offSchedule,
    anticipadas: s.earlyDepartures,
    puntualidad: s.punctuality == null ? '—' : `${s.punctuality}%`,
  });

  const exportPdf = async () => {
    const doc = new PdfReportDocument('landscape', 'Reporte de Asistencias del Personal', subtitle);
    await doc.drawCoverHeader();
    doc.drawKpiCards([
      { label: 'Días programados', value: totals.scheduledDays, tone: 'primary' },
      { label: 'A tiempo', value: totals.onTime, tone: 'success' },
      { label: 'Tardanzas', value: totals.late, tone: 'warning' },
      { label: 'Inasistencias', value: totals.absent, tone: 'error' },
      { label: 'Justificadas', value: totals.justified, tone: 'info' },
    ]);
    doc.drawSectionTitle('Resumen por empleado');
    doc.drawTable(
      [
        { header: 'Empleado', dataKey: 'empleado' },
        { header: 'Categoría', dataKey: 'categoria', width: 40 },
        { header: 'Prog.', dataKey: 'programados', width: 14, align: 'center' },
        { header: 'A tiempo', dataKey: 'atiempo', width: 16, align: 'center' },
        { header: 'Tarde', dataKey: 'tarde', width: 14, align: 'center' },
        { header: 'TJ', dataKey: 'tj', width: 12, align: 'center' },
        { header: 'Faltas', dataKey: 'faltas', width: 14, align: 'center' },
        { header: 'FJ', dataKey: 'fj', width: 12, align: 'center' },
        { header: 'F. horario', dataKey: 'fh', width: 18, align: 'center' },
        { header: 'Sal. antic.', dataKey: 'anticipadas', width: 18, align: 'center' },
        { header: 'Puntualidad', dataKey: 'puntualidad', width: 22, align: 'center' },
      ],
      summary.map(summaryRow),
      { fontSize: 7.5 },
    );
    doc.drawParagraph('A = a tiempo · T = tarde · TJ = tarde justificada · F = falta · FJ = falta justificada · FH = fuera de horario');
    await doc.finalize(`reporte-asistencia-personal-${from}-a-${to}.pdf`);
  };

  const exportExcel = () =>
    runExcelExport('Reporte de asistencias del personal', async () => {
      const wb = createWorkbook('Reporte de asistencias del personal');
      await addDataSheet(
        wb,
        'Resumen',
        'Asistencia del personal — resumen',
        subtitle,
        ['Empleado', 'Categoría', 'Días programados', 'A tiempo', 'Tarde', 'Tarde justif.', 'Faltas', 'Falta justif.', 'Fuera de horario', 'Salidas anticipadas', 'Puntualidad'],
        summary.map((s) => Object.values(summaryRow(s))),
      );
      const days = dateKeysBetween(from, to);
      const byKey = new Map(records.map((r) => [`${r.personalId}|${r.date}`, r]));
      await addDataSheet(
        wb,
        'Detalle diario',
        'Asistencia del personal — detalle por día',
        `${subtitle} · A, T, TJ, F, FJ, FH; - = no le toca`,
        ['Empleado', ...days.map((d) => d.slice(8, 10) + '/' + d.slice(5, 7))],
        summary.map((s) => [
          s.personal.fullName,
          ...days.map((d) => {
            if (d < s.personal.createdAt) return '';
            const record = byKey.get(`${s.personal.id}|${d}`) ?? null;
            const status = resolveDayStatus(scheduleForDate(s.personal.schedule, d), record, d, today, '23:59');
            return STATUS_SHORT[status] ?? '';
          }),
        ]),
      );
      await saveWorkbook(wb, `reporte-asistencia-personal-${from}-a-${to}.xlsx`);
    });

  if (loading) return <PageLoader message="Cargando reporte de asistencias..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={ClipboardList}
        eyebrow="Personal"
        title="Reporte de Asistencias del Personal"
        description="Puntualidad, tardanzas e inasistencias por empleado según su horario"
        accent="info"
      >
        <div className="flex gap-2">
          <Button variant="outline-primary" onClick={() => void exportExcel()} disabled={summary.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="info" onClick={() => void exportPdf()} disabled={summary.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Días programados" value={totals.scheduledDays} hint="Suma de todos" icon={CalendarDays} tone="info" />
        <StaffKpiStat label="A tiempo" value={totals.onTime} hint="Llegadas puntuales" icon={CheckCircle2} tone="success" />
        <StaffKpiStat label="Tardanzas" value={totals.late} hint="Incluye justificadas" icon={AlertTriangle} tone="warning" />
        <StaffKpiStat label="Inasistencias" value={totals.absent} hint="Sin justificar" icon={UserX} tone="accent" />
      </div>

      <StaffToolbar title="Filtros" description="Rango, nombre o categoría">
        <div className="space-y-2">
          <Label htmlFor="par-from">Desde</Label>
          <Input id="par-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="par-to">Hasta</Label>
          <Input id="par-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
        <PersonalSearchField id="par-search" value={search} onChange={setSearch} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="flex items-end">
          <Button variant="outline" onClick={() => void reload(true)} className="w-full" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Resumen por empleado (${summary.length})`}
          description="Faltas = inasistencias del cierre + días sin registro. Puntualidad = a tiempo / llegadas."
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {summary.length === 0 ? (
            <StaffEmptyState icon={ClipboardList} title="Sin personal" description="No hay empleados con esos filtros" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Resumen de asistencia del personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-center">Prog.</TableHead>
                      <TableHead className="text-center">A tiempo</TableHead>
                      <TableHead className="text-center">Tarde</TableHead>
                      <TableHead className="text-center">TJ</TableHead>
                      <TableHead className="text-center">Faltas</TableHead>
                      <TableHead className="text-center">FJ</TableHead>
                      <TableHead className="text-center">F. horario</TableHead>
                      <TableHead className="text-center">Sal. antic.</TableHead>
                      <TableHead className="text-center">Puntualidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((s) => (
                      <TableRow key={s.personal.id}>
                        <TableCell>
                          <p className="font-medium">{s.personal.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.personal.category}</p>
                        </TableCell>
                        <TableCell className="text-center">{s.scheduledDays}</TableCell>
                        <TableCell className="text-center">{s.onTime}</TableCell>
                        <TableCell className="text-center">{s.late}</TableCell>
                        <TableCell className="text-center">{s.lateJustified}</TableCell>
                        <TableCell className="text-center font-semibold">{s.absent + s.noRecord}</TableCell>
                        <TableCell className="text-center">{s.absentJustified}</TableCell>
                        <TableCell className="text-center">{s.offSchedule}</TableCell>
                        <TableCell className="text-center">{s.earlyDepartures}</TableCell>
                        <TableCell className="text-center">{s.punctuality == null ? '—' : `${s.punctuality}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {summary.length > pageSize && (
                <StaffTablePagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={summary.length}
                  onPrev={prevPage}
                  onNext={nextPage}
                  onGoToPage={goToPage}
                  onPageSizeChange={changePageSize}
                />
              )}
            </>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};

export default PersonalAttendanceReport;
