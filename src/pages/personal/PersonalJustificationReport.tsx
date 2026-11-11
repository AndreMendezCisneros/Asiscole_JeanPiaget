import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileCheck2, FileDown, FileSpreadsheet, Paperclip, RefreshCw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { PersonalCategorySelect, PersonalEmployeeFilter, PersonalSearchField } from '@/components/personal/PersonalFilters';
import { JustificationRowActions } from '@/components/personal/JustificationEvidence';
import { usePersonalAttendance } from '@/hooks/usePersonalAttendance';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { matchesPersonalFilter, type CategoryFilter } from '@/lib/utils/personalFilter';
import { monthStartOf } from '@/lib/utils/personalAttendanceRows';
import { monthEndOf, monthLabel } from '@/lib/utils/personalWorkedTime';
import { justificationKindLabel } from '@/lib/utils/exportPersonalJustificationPdf';
import { addDataSheet, createWorkbook, runExcelExport, saveWorkbook } from '@/lib/utils/excelExport';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

type PeriodMode = 'month' | 'year' | 'range';
type KindFilter = 'all' | 'tardanza' | 'inasistencia';
type EvidenceFilter = 'all' | 'with' | 'without';

interface Row {
  record: PersonalArrivalRecord;
  personal: Personal;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
}

function clampEnd(from: string, end: string, today: string): string {
  if (end <= today) return end;
  return today < from ? from : today;
}

const isLate = (r: PersonalArrivalRecord) => r.status === 'Tarde justificada';

export const PersonalJustificationReport = () => {
  const today = getLimaTodayDate();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [monthValue, setMonthValue] = useState(today.slice(0, 7));
  const [yearValue, setYearValue] = useState(Number(today.slice(0, 4)));
  const [rangeFrom, setRangeFrom] = useState(monthStartOf(today));
  const [rangeTo, setRangeTo] = useState(today);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [evidence, setEvidence] = useState<EvidenceFilter>('all');

  const { from, to } = useMemo(() => {
    if (periodMode === 'month') {
      const start = `${monthValue}-01`;
      return { from: start, to: clampEnd(start, monthEndOf(monthValue), today) };
    }
    if (periodMode === 'year') {
      const start = `${yearValue}-01-01`;
      return { from: start, to: clampEnd(start, `${yearValue}-12-31`, today) };
    }
    return { from: rangeFrom, to: rangeTo };
  }, [periodMode, monthValue, yearValue, rangeFrom, rangeTo, today]);

  const periodLabel =
    periodMode === 'month' ? monthLabel(monthValue) : periodMode === 'year' ? `Año ${yearValue}` : `Del ${formatDate(from)} al ${formatDate(to)}`;

  const { personal, records, loading, refreshing, reload } = usePersonalAttendance(from, to);

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(personal.map((p) => [p.id, p]));
    return records
      .filter((r) => r.status === 'Tarde justificada' || r.status === 'Falta justificada')
      .map((r) => ({ record: r, personal: byId.get(r.personalId) }))
      .filter((x): x is Row => Boolean(x.personal))
      .filter(
        ({ record, personal: p }) =>
          matchesPersonalFilter(p, search, category, employeeId) &&
          (kind === 'all' || (kind === 'tardanza') === isLate(record)) &&
          (evidence === 'all' || (evidence === 'with') === Boolean(record.evidence)),
      )
      .sort((a, b) => b.record.date.localeCompare(a.record.date) || a.personal.fullName.localeCompare(b.personal.fullName));
  }, [personal, records, search, category, employeeId, kind, evidence]);

  const totals = useMemo(
    () => ({
      total: rows.length,
      late: rows.filter((r) => isLate(r.record)).length,
      absence: rows.filter((r) => !isLate(r.record)).length,
      withEvidence: rows.filter((r) => r.record.evidence).length,
    }),
    [rows],
  );

  const byEmployee = useMemo(() => {
    const map = new Map<number, { personal: Personal; late: number; absence: number; withEvidence: number }>();
    for (const { record, personal: p } of rows) {
      const e = map.get(p.id) ?? { personal: p, late: 0, absence: 0, withEvidence: 0 };
      if (isLate(record)) e.late++;
      else e.absence++;
      if (record.evidence) e.withEvidence++;
      map.set(p.id, e);
    }
    return [...map.values()].sort((a, b) => b.late + b.absence - (a.late + a.absence) || a.personal.fullName.localeCompare(b.personal.fullName));
  }, [rows]);

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } = useTablePagination({
    totalItems: rows.length,
    initialPageSize: TABLE_PAGE_SIZE,
  });

  useEffect(() => {
    resetPage();
  }, [search, category, employeeId, kind, evidence, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const employeeName = employeeId !== null ? personal.find((p) => p.id === employeeId)?.fullName : null;
  const subtitle = buildFilterSubtitle([
    periodLabel,
    periodMode !== 'range' && `Del ${formatDate(from)} al ${formatDate(to)}`,
    category !== 'all' && category,
    employeeName,
    search.trim() && `Búsqueda: ${search.trim()}`,
    kind === 'tardanza' && 'Solo tardanzas',
    kind === 'inasistencia' && 'Solo inasistencias',
    evidence === 'with' && 'Con evidencia',
    evidence === 'without' && 'Sin evidencia',
  ]);

  const detailRow = ({ record, personal: p }: Row) => ({
    fecha: formatDate(record.date),
    empleado: p.fullName,
    tipo: justificationKindLabel(record),
    detalle: isLate(record) ? `Llegó ${record.arrivalTime ?? '—'} (entrada ${record.expectedEntry ?? '—'})` : 'No asistió',
    motivo: record.justificationReason ?? '—',
    registro: record.justifiedByName ?? '—',
    evidencia: record.evidence ? 'Sí' : 'No',
  });

  const tag = periodMode === 'month' ? monthValue : periodMode === 'year' ? `anual-${yearValue}` : `${from}-a-${to}`;

  const exportPdf = async () => {
    const doc = new PdfReportDocument('landscape', 'Justificaciones del Personal', subtitle);
    await doc.drawCoverHeader();
    doc.drawKpiCards([
      { label: 'Justificaciones', value: totals.total, tone: 'primary' },
      { label: 'Tardanzas', value: totals.late, tone: 'warning' },
      { label: 'Inasistencias', value: totals.absence, tone: 'error' },
      { label: 'Con evidencia', value: totals.withEvidence, tone: 'success' },
    ]);
    doc.drawSectionTitle('Por empleado');
    doc.drawTable(
      [
        { header: 'Empleado', dataKey: 'empleado' },
        { header: 'Categoría', dataKey: 'categoria', width: 46 },
        { header: 'Tardanzas', dataKey: 'tarde', width: 26, align: 'center' },
        { header: 'Inasistencias', dataKey: 'falta', width: 26, align: 'center' },
        { header: 'Total', dataKey: 'total', width: 22, align: 'center' },
        { header: 'Con evidencia', dataKey: 'evid', width: 28, align: 'center' },
      ],
      byEmployee.map((e) => ({
        empleado: e.personal.fullName,
        categoria: e.personal.category,
        tarde: e.late,
        falta: e.absence,
        total: e.late + e.absence,
        evid: e.withEvidence,
      })),
      { fontSize: 8 },
    );
    doc.drawSectionTitle('Detalle');
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 22 },
        { header: 'Empleado', dataKey: 'empleado', width: 52 },
        { header: 'Tipo', dataKey: 'tipo', width: 36 },
        { header: 'Detalle', dataKey: 'detalle', width: 40 },
        { header: 'Motivo', dataKey: 'motivo' },
        { header: 'Registró', dataKey: 'registro', width: 36 },
        { header: 'Evid.', dataKey: 'evidencia', width: 14, align: 'center' },
      ],
      rows.map(detailRow),
      { fontSize: 7.5 },
    );
    await doc.finalize(`justificaciones-personal-${tag}.pdf`);
  };

  const exportExcel = () =>
    runExcelExport('Justificaciones', async () => {
      const wb = createWorkbook('Justificaciones del personal');
      await addDataSheet(
        wb,
        'Detalle',
        'Justificaciones del personal — detalle',
        subtitle,
        ['Fecha', 'Empleado', 'Tipo', 'Detalle', 'Motivo', 'Registró', 'Evidencia', 'DNI', 'Categoría', 'Registrado el', 'Archivo de evidencia'],
        rows.map((r) => [
          ...Object.values(detailRow(r)),
          r.personal.barcode,
          r.personal.category,
          formatDateTime(r.record.justifiedAt),
          r.record.evidence?.fileName ?? '',
        ]),
      );
      await addDataSheet(
        wb,
        'Por empleado',
        'Justificaciones por empleado',
        subtitle,
        ['Empleado', 'Categoría', 'Tardanzas', 'Inasistencias', 'Total', 'Con evidencia'],
        byEmployee.map((e) => [e.personal.fullName, e.personal.category, e.late, e.absence, e.late + e.absence, e.withEvidence]),
      );
      await saveWorkbook(wb, `justificaciones-personal-${tag}.xlsx`);
    });

  if (loading) return <PageLoader message="Cargando justificaciones..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={FileCheck2}
        eyebrow="Personal"
        title="Reporte de Justificaciones"
        description="Tardanzas e inasistencias justificadas del personal, con motivo, quién las registró y su evidencia"
        accent="info"
      >
        <div className="flex gap-2">
          <Button variant="outline-primary" onClick={() => void exportExcel()} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="info" onClick={() => void exportPdf()} disabled={rows.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Justificaciones" value={totals.total} hint="Con los filtros" icon={CheckCircle2} tone="success" />
        <StaffKpiStat label="Tardanzas" value={totals.late} hint="Justificadas" icon={Clock} tone="warning" />
        <StaffKpiStat label="Inasistencias" value={totals.absence} hint="Justificadas" icon={UserX} tone="accent" />
        <StaffKpiStat label="Con evidencia" value={totals.withEvidence} hint={`${totals.total - totals.withEvidence} sin evidencia`} icon={Paperclip} tone="info" />
      </div>

      <StaffToolbar title="Filtros" description="Periodo, empleado, categoría, tipo y evidencia">
        <div className="col-span-full">
          <StaffSegmentedControl
            aria-label="Periodo"
            value={periodMode}
            onValueChange={(v) => setPeriodMode(v as PeriodMode)}
            options={[
              { value: 'month', label: 'Mes' },
              { value: 'year', label: 'Año completo' },
              { value: 'range', label: 'Rango de fechas' },
            ]}
            listClassName="sm:grid-cols-3 max-w-lg"
          />
        </div>
        {periodMode === 'month' && (
          <div className="space-y-2">
            <Label htmlFor="pjr-month">Mes</Label>
            <Input id="pjr-month" type="month" value={monthValue} max={today.slice(0, 7)} onChange={(e) => setMonthValue(e.target.value || monthValue)} />
          </div>
        )}
        {periodMode === 'year' && (
          <div className="space-y-2">
            <Label htmlFor="pjr-year">Año</Label>
            <Input
              id="pjr-year"
              type="number"
              min={2020}
              max={Number(today.slice(0, 4))}
              value={yearValue}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (y >= 2000 && y <= 2100) setYearValue(y);
              }}
            />
          </div>
        )}
        {periodMode === 'range' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="pjr-from">Desde</Label>
              <Input id="pjr-from" type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value || rangeFrom)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pjr-to">Hasta</Label>
              <Input id="pjr-to" type="date" value={rangeTo} min={rangeFrom} onChange={(e) => setRangeTo(e.target.value || rangeTo)} />
            </div>
          </>
        )}
        <PersonalSearchField id="pjr-search" value={search} onChange={setSearch} />
        <PersonalEmployeeFilter employees={personal} value={employeeId} onChange={setEmployeeId} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tardanzas e inasistencias</SelectItem>
              <SelectItem value="tardanza">Solo tardanzas</SelectItem>
              <SelectItem value="inasistencia">Solo inasistencias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Evidencia</Label>
          <Select value={evidence} onValueChange={(v) => setEvidence(v as EvidenceFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="with">Con evidencia</SelectItem>
              <SelectItem value="without">Sin evidencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => void reload(true)} className="w-full" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader title={`Justificaciones (${rows.length})`} description={periodLabel} />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {rows.length === 0 ? (
            <StaffEmptyState icon={FileCheck2} title="Sin justificaciones" description="No hay justificaciones con el periodo y filtros elegidos" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Justificaciones del personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Registró</TableHead>
                      <TableHead>Evidencia / PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map(({ record, personal: p }) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">{formatDate(record.date)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{p.fullName}</p>
                          <p className="text-xs text-muted-foreground">{p.category}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isLate(record) ? 'warning' : 'destructive'}>{isLate(record) ? 'Tardanza' : 'Inasistencia'}</Badge>
                          {isLate(record) && record.arrivalTime && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Llegó {record.arrivalTime} (entrada {record.expectedEntry ?? '—'})
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs text-sm">{record.justificationReason ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {record.justifiedByName ?? '—'}
                          <p className="text-xs text-muted-foreground">{formatDateTime(record.justifiedAt)}</p>
                        </TableCell>
                        <TableCell>
                          <JustificationRowActions record={record} personal={p} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > pageSize && (
                <StaffTablePagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={rows.length}
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

export default PersonalJustificationReport;
