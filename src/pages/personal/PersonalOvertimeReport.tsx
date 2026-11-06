import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileDown,
  FileSpreadsheet,
  Hammer,
  RefreshCw,
  TimerReset,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { PersonalCategorySelect, PersonalEmployeeFilter, PersonalSearchField } from '@/components/personal/PersonalFilters';
import { matchesPersonalFilter, type CategoryFilter } from '@/lib/utils/personalFilter';
import { usePersonalAttendance } from '@/hooks/usePersonalAttendance';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { monthStartOf } from '@/lib/utils/personalAttendanceRows';
import { formatMinutes } from '@/lib/utils/personalLostTime';
import { computeOvertime, type OvertimeSummary } from '@/lib/utils/personalOvertime';
import { personalTallerService } from '@/lib/services/personalTallerService';
import { addDataSheet, createWorkbook, runExcelExport, saveWorkbook } from '@/lib/utils/excelExport';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import type { PersonalTallerRecord } from '@/types/personal';

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

export const PersonalOvertimeReport = () => {
  const now = getLimaNow();
  const [from, setFrom] = useState(monthStartOf(now.date));
  const [to, setTo] = useState(now.date);
  const { personal, records, loading, refreshing, reload } = usePersonalAttendance(from, to);
  const [talleres, setTalleres] = useState<PersonalTallerRecord[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const loadTalleres = useCallback(async () => {
    const res = await personalTallerService.getRecords({ from, to });
    if (res.error) toast.error(res.error);
    setTalleres(res.records);
  }, [from, to]);

  useEffect(() => {
    void loadTalleres();
  }, [loadTalleres]);

  const summary = useMemo(
    () =>
      computeOvertime(
        personal.filter((p) => matchesPersonalFilter(p, search, category, employeeId)),
        records,
        talleres,
        now.date,
      ).sort((a, b) => b.totalMin - a.totalMin || a.personal.fullName.localeCompare(b.personal.fullName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personal, records, talleres, search, category, employeeId],
  );

  const totals = useMemo(
    () =>
      summary.reduce(
        (acc, s) => ({
          total: acc.total + s.totalMin,
          afterExit: acc.afterExit + s.afterExitMin,
          taller: acc.taller + s.tallerMin,
          offDay: acc.offDay + s.offDayMin,
          review: acc.review + s.missingDepartureDays + s.daysWithoutExit,
        }),
        { total: 0, afterExit: 0, taller: 0, offDay: 0, review: 0 },
      ),
    [summary],
  );

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: summary.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, employeeId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = summary.slice((page - 1) * pageSize, page * pageSize);
  const subtitle = buildFilterSubtitle([`Del ${from} al ${to}`, category !== 'all' && category]);

  const rowFor = (s: OvertimeSummary) => ({
    empleado: s.personal.fullName,
    categoria: s.personal.category,
    salida: formatMinutes(s.afterExitMin),
    taller: formatMinutes(s.tallerMin),
    dia: formatMinutes(s.offDayMin),
    total: formatMinutes(s.totalMin),
  });

  const exportPdf = async () => {
    const doc = new PdfReportDocument('landscape', 'Horas extra del Personal', subtitle);
    await doc.drawCoverHeader();
    doc.drawKpiCards([
      { label: 'Total extra', value: formatMinutes(totals.total), tone: 'primary' },
      { label: 'Salida tarde', value: formatMinutes(totals.afterExit), tone: 'info' },
      { label: 'Taller', value: formatMinutes(totals.taller), tone: 'info' },
      { label: 'Día sin horario', value: formatMinutes(totals.offDay), tone: 'info' },
    ]);
    doc.drawSectionTitle('Por empleado');
    doc.drawTable(
      [
        { header: 'Empleado', dataKey: 'empleado' },
        { header: 'Categoría', dataKey: 'categoria', width: 42 },
        { header: 'Salida tarde', dataKey: 'salida', width: 28, align: 'center' },
        { header: 'Taller', dataKey: 'taller', width: 28, align: 'center' },
        { header: 'Día sin horario', dataKey: 'dia', width: 28, align: 'center' },
        { header: 'Total extra', dataKey: 'total', width: 28, align: 'center' },
      ],
      summary.map(rowFor),
      { fontSize: 8 },
    );
    doc.drawParagraph(
      'Salida tarde = hora en que salió − hora de salida. Taller = salida − entrada, fuera de su horario. Día sin horario = salida − entrada. Llegar antes de la entrada no cuenta. Sin salida marcada cuenta 0.',
    );
    await doc.finalize(`horas-extra-${from}-a-${to}.pdf`);
  };

  const exportExcel = () =>
    runExcelExport('Horas extra', async () => {
      const wb = createWorkbook('Horas extra del personal');
      await addDataSheet(
        wb,
        'Resumen',
        'Horas extra — resumen',
        subtitle,
        ['Empleado', 'Categoría', 'Salida tarde', 'Taller', 'Día sin horario', 'Total extra', 'Total (min)', 'Días sin marcar salida', 'Días sin hora de salida'],
        summary.map((s) => [...Object.values(rowFor(s)), s.totalMin, s.missingDepartureDays, s.daysWithoutExit]),
      );
      await addDataSheet(
        wb,
        'Detalle',
        'Horas extra — detalle por día',
        subtitle,
        ['Fecha', 'Empleado', 'Motivo', 'Detalle', 'Tiempo', 'Minutos'],
        summary.flatMap((s) =>
          s.items.map((i) => [formatDate(i.date), s.personal.fullName, i.kind, i.detail, formatMinutes(i.minutes), i.minutes]),
        ),
      );
      await saveWorkbook(wb, `horas-extra-${from}-a-${to}.xlsx`);
    });

  if (loading) return <PageLoader message="Calculando horas extra..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={TimerReset}
        eyebrow="Personal"
        title="Horas extra"
        description="Tiempo después de su hora de salida, en taller y en días que no le toca. Llegar antes de su entrada no cuenta."
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
        <StaffKpiStat label="Total extra" value={formatMinutes(totals.total)} hint="Suma del periodo" icon={Timer} tone="info" />
        <StaffKpiStat label="Salida tarde" value={formatMinutes(totals.afterExit)} hint="Después de su hora de salida" icon={Clock} tone="accent" />
        <StaffKpiStat label="Taller y días sin horario" value={formatMinutes(totals.taller + totals.offDay)} hint={`Taller ${formatMinutes(totals.taller)} · Días ${formatMinutes(totals.offDay)}`} icon={Hammer} tone="success" />
        <StaffKpiStat label="Por revisar" value={totals.review} hint="Días sin marcar salida o sin hora de salida" icon={AlertTriangle} tone="warning" />
      </div>

      <StaffToolbar title="Filtros" description="Rango, nombre o categoría">
        <div className="space-y-2">
          <Label htmlFor="pot-from">Desde</Label>
          <Input id="pot-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pot-to">Hasta</Label>
          <Input id="pot-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
        <PersonalSearchField id="pot-search" value={search} onChange={setSearch} />
        <PersonalEmployeeFilter employees={personal} value={employeeId} onChange={setEmployeeId} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              void reload(true);
              void loadTalleres();
            }}
            className="w-full"
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Por empleado (${summary.length})`}
          description="Clic en un empleado para ver el detalle por día."
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {summary.length === 0 ? (
            <StaffEmptyState icon={TimerReset} title="Sin personal" description="No hay empleados con esos filtros" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Horas extra por empleado">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-center">Salida tarde</TableHead>
                      <TableHead className="text-center">Taller</TableHead>
                      <TableHead className="text-center">Día sin horario</TableHead>
                      <TableHead className="text-center">Total extra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((s) => {
                      const open = expanded === s.personal.id;
                      return (
                        <Fragment key={s.personal.id}>
                          <TableRow className="cursor-pointer" onClick={() => setExpanded(open ? null : s.personal.id)}>
                            <TableCell>
                              <div className="flex items-start gap-2">
                                {open ? (
                                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                ) : (
                                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                )}
                                <div>
                                  <p className="font-medium">{s.personal.fullName}</p>
                                  <p className="text-xs text-muted-foreground">{s.personal.category}</p>
                                  {s.daysWithoutExit > 0 && (
                                    <Badge variant="outline" className="mt-1 border-warning text-warning">
                                      {s.daysWithoutExit} {s.daysWithoutExit === 1 ? 'día' : 'días'} sin hora de salida
                                    </Badge>
                                  )}
                                  {s.missingDepartureDays > 0 && (
                                    <Badge variant="outline" className="ml-1 mt-1">
                                      {s.missingDepartureDays} sin marcar salida
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{formatMinutes(s.afterExitMin)}</TableCell>
                            <TableCell className="text-center">{formatMinutes(s.tallerMin)}</TableCell>
                            <TableCell className="text-center">{formatMinutes(s.offDayMin)}</TableCell>
                            <TableCell className="text-center font-semibold">{formatMinutes(s.totalMin)}</TableCell>
                          </TableRow>
                          {open && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/30">
                                {s.items.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Sin horas extra en el periodo.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm">
                                    {s.items.map((i, idx) => (
                                      <li key={`${i.date}-${i.kind}-${idx}`} className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs">{formatDate(i.date)}</span>
                                        <Badge variant="info">{i.kind}</Badge>
                                        <span className="text-muted-foreground">{i.detail}</span>
                                        <span className="font-semibold">{formatMinutes(i.minutes)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
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

export default PersonalOvertimeReport;
