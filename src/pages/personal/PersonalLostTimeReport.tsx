import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileDown,
  FileSpreadsheet,
  Hourglass,
  RefreshCw,
  ShieldCheck,
  TimerOff,
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
  StaffSegmentedControl,
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
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { monthStartOf } from '@/lib/utils/personalAttendanceRows';
import {
  compliancePct,
  computeLostTime,
  formatMinutes,
  lostFor,
  type LostTimeSummary,
  type LostTimeView,
} from '@/lib/utils/personalLostTime';
import { addDataSheet, createWorkbook, runExcelExport, saveWorkbook } from '@/lib/utils/excelExport';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

const VIEW_LABEL: Record<LostTimeView, string> = {
  total: 'Total (incluye justificadas)',
  neto: 'Descontando justificadas',
};

export const PersonalLostTimeReport = () => {
  const now = getLimaNow();
  const [from, setFrom] = useState(monthStartOf(now.date));
  const [to, setTo] = useState(now.date);
  const { personal, records, absenceAfterMin, loading, refreshing, reload } = usePersonalAttendance(from, to);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [view, setView] = useState<LostTimeView>('total');
  const [expanded, setExpanded] = useState<number | null>(null);

  const summary = useMemo(
    () =>
      computeLostTime(
        personal.filter((p) => matchesPersonalFilter(p, search, category)),
        records,
        from,
        to,
        now.date,
        now.time,
        absenceAfterMin,
      ).sort((a, b) => lostFor(b, view) - lostFor(a, view) || a.personal.fullName.localeCompare(b.personal.fullName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personal, records, from, to, search, category, view, absenceAfterMin],
  );

  const totals = useMemo(
    () =>
      summary.reduce(
        (acc, s) => ({
          scheduled: acc.scheduled + s.scheduledMin,
          total: acc.total + s.lostTotalMin,
          justified: acc.justified + s.lostJustifiedMin,
          net: acc.net + s.lostNetMin,
          withoutExit: acc.withoutExit + (s.daysWithoutExit > 0 ? 1 : 0),
          noDeparture: acc.noDeparture + s.noDepartureDays,
        }),
        { scheduled: 0, total: 0, justified: 0, net: 0, withoutExit: 0, noDeparture: 0 },
      ),
    [summary],
  );
  const lost = view === 'total' ? totals.total : totals.net;

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: summary.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, from, to, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = summary.slice((page - 1) * pageSize, page * pageSize);
  const subtitle = buildFilterSubtitle([`Del ${from} al ${to}`, category !== 'all' && category, VIEW_LABEL[view]]);

  const rowFor = (s: LostTimeSummary) => ({
    empleado: s.personal.fullName,
    categoria: s.personal.category,
    programado: formatMinutes(s.scheduledMin),
    tardanza: formatMinutes(s.lateMin),
    inasistencia: `${formatMinutes(s.absenceMin)} (${s.absenceDays} d)`,
    anticipada: formatMinutes(s.earlyMin),
    justificado: formatMinutes(s.lostJustifiedMin),
    perdido: formatMinutes(lostFor(s, view)),
    cumplimiento: compliancePct(s, view) == null ? '—' : `${compliancePct(s, view)}%`,
  });

  const exportPdf = async () => {
    const doc = new PdfReportDocument('landscape', 'Horas no trabajadas del Personal', subtitle);
    await doc.drawCoverHeader();
    doc.drawKpiCards([
      { label: 'Programado', value: formatMinutes(totals.scheduled), tone: 'primary' },
      { label: 'No trabajado (total)', value: formatMinutes(totals.total), tone: 'warning' },
      { label: 'Justificado', value: formatMinutes(totals.justified), tone: 'info' },
      { label: 'Sin justificar', value: formatMinutes(totals.net), tone: 'error' },
    ]);
    doc.drawSectionTitle(`Por empleado — ${VIEW_LABEL[view]}`);
    doc.drawTable(
      [
        { header: 'Empleado', dataKey: 'empleado' },
        { header: 'Categoría', dataKey: 'categoria', width: 38 },
        { header: 'Programado', dataKey: 'programado', width: 22, align: 'center' },
        { header: 'Tardanza', dataKey: 'tardanza', width: 22, align: 'center' },
        { header: 'Inasistencia', dataKey: 'inasistencia', width: 28, align: 'center' },
        { header: 'Salida anticipada', dataKey: 'anticipada', width: 26, align: 'center' },
        { header: 'Justificado', dataKey: 'justificado', width: 22, align: 'center' },
        { header: 'No trabajado', dataKey: 'perdido', width: 24, align: 'center' },
        { header: 'Cumplimiento', dataKey: 'cumplimiento', width: 22, align: 'center' },
      ],
      summary.map(rowFor),
      { fontSize: 7.5 },
    );
    doc.drawParagraph(
      'Tardanza = llegada − hora de entrada. Inasistencia = jornada completa (salida − entrada). Salida anticipada = hora de salida − hora en que salió. "Descontando justificadas" no cuenta tardanzas e inasistencias justificadas ni salidas autorizadas.',
    );
    await doc.finalize(`horas-no-trabajadas-${from}-a-${to}.pdf`);
  };

  const exportExcel = () =>
    runExcelExport('Horas no trabajadas', async () => {
      const wb = createWorkbook('Horas no trabajadas del personal');
      await addDataSheet(
        wb,
        'Resumen',
        'Horas no trabajadas — resumen',
        subtitle,
        ['Empleado', 'Categoría', 'Programado', 'Tardanza', 'Inasistencia', 'Salida anticipada', 'Justificado', 'No trabajado', 'Cumplimiento', 'Programado (min)', 'No trabajado total (min)', 'Sin justificar (min)'],
        summary.map((s) => [...Object.values(rowFor(s)), s.scheduledMin, s.lostTotalMin, s.lostNetMin]),
      );
      await addDataSheet(
        wb,
        'Detalle',
        'Horas no trabajadas — detalle por día',
        subtitle,
        ['Fecha', 'Empleado', 'Motivo', 'Detalle', 'Tiempo', 'Minutos', 'Justificado'],
        summary.flatMap((s) =>
          s.items.map((i) => [
            formatDate(i.date),
            s.personal.fullName,
            i.kind,
            i.detail,
            formatMinutes(i.minutes),
            i.minutes ?? '',
            i.justified ? 'Sí' : 'No',
          ]),
        ),
      );
      await saveWorkbook(wb, `horas-no-trabajadas-${from}-a-${to}.xlsx`);
    });

  if (loading) return <PageLoader message="Calculando horas no trabajadas..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Hourglass}
        eyebrow="Personal"
        title="Horas no trabajadas"
        description="Tiempo perdido por tardanzas, inasistencias y salidas anticipadas según el horario de cada empleado"
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

      <StaffSegmentedControl
        value={view}
        onValueChange={(v) => setView(v as LostTimeView)}
        options={[
          { value: 'total', label: VIEW_LABEL.total },
          { value: 'neto', label: VIEW_LABEL.neto },
        ]}
        listClassName="sm:grid-cols-2"
        aria-label="Vista"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Programado" value={formatMinutes(totals.scheduled)} hint="Suma de jornadas" icon={Clock} tone="info" />
        <StaffKpiStat
          label={view === 'total' ? 'No trabajado (total)' : 'No trabajado sin justificar'}
          value={formatMinutes(lost)}
          hint={totals.scheduled > 0 ? `${Math.round((lost / totals.scheduled) * 100)}% de lo programado` : '—'}
          icon={TimerOff}
          tone="accent"
        />
        <StaffKpiStat label="Justificado" value={formatMinutes(totals.justified)} hint="Tarde/inasistencia justificada y salidas autorizadas" icon={ShieldCheck} tone="success" />
        <StaffKpiStat
          label="Por revisar"
          value={totals.noDeparture}
          hint={`días sin marcar salida · ${totals.withoutExit} empleados sin hora de salida`}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <StaffToolbar title="Filtros" description="Rango, nombre o categoría">
        <div className="space-y-2">
          <Label htmlFor="plt-from">Desde</Label>
          <Input id="plt-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plt-to">Hasta</Label>
          <Input id="plt-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
        <PersonalSearchField id="plt-search" value={search} onChange={setSearch} />
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
          title={`Por empleado (${summary.length}) — ${VIEW_LABEL[view]}`}
          description="Clic en un empleado para ver el detalle por día. Inasistencia = su jornada completa (salida − entrada)."
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {summary.length === 0 ? (
            <StaffEmptyState icon={Hourglass} title="Sin personal" description="No hay empleados con esos filtros" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Horas no trabajadas por empleado">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-center">Programado</TableHead>
                      <TableHead className="text-center">Tardanza</TableHead>
                      <TableHead className="text-center">Inasistencia</TableHead>
                      <TableHead className="text-center">Salida anticipada</TableHead>
                      <TableHead className="text-center">Justificado</TableHead>
                      <TableHead className="text-center">No trabajado</TableHead>
                      <TableHead className="text-center">Cumplimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((s) => {
                      const open = expanded === s.personal.id;
                      const pct = compliancePct(s, view);
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
                                      {s.daysWithoutExit} días sin hora de salida
                                    </Badge>
                                  )}
                                  {s.noDepartureDays > 0 && (
                                    <Badge variant="outline" className="ml-1 mt-1">
                                      {s.noDepartureDays} sin marcar salida
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{formatMinutes(s.scheduledMin)}</TableCell>
                            <TableCell className="text-center">{formatMinutes(s.lateMin)}</TableCell>
                            <TableCell className="text-center">
                              {formatMinutes(s.absenceMin)}
                              {s.absenceDays > 0 && <span className="block text-xs text-muted-foreground">{s.absenceDays} días</span>}
                            </TableCell>
                            <TableCell className="text-center">{formatMinutes(s.earlyMin)}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{formatMinutes(s.lostJustifiedMin)}</TableCell>
                            <TableCell className="text-center font-semibold">{formatMinutes(lostFor(s, view))}</TableCell>
                            <TableCell className="text-center">{pct == null ? '—' : `${pct}%`}</TableCell>
                          </TableRow>
                          {open && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/30">
                                {s.items.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Sin tiempo perdido en el periodo.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm">
                                    {s.items.map((i, idx) => {
                                      const counted = view === 'total' || !i.justified;
                                      return (
                                        <li key={`${i.date}-${i.kind}-${idx}`} className="flex flex-wrap items-center gap-2">
                                          <span className="font-mono text-xs">{formatDate(i.date)}</span>
                                          <Badge variant={i.kind === 'inasistencia' ? 'destructive' : 'warning'}>{i.kind}</Badge>
                                          <span className="text-muted-foreground">{i.detail}</span>
                                          <span className={counted ? 'font-semibold' : 'text-muted-foreground line-through'}>
                                            {formatMinutes(i.minutes)}
                                          </span>
                                          {i.justified && <Badge variant="info">justificado</Badge>}
                                        </li>
                                      );
                                    })}
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

export default PersonalLostTimeReport;
