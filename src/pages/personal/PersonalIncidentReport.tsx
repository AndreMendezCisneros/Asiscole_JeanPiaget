import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BarChart3, CheckCircle2, FileDown, FileSpreadsheet, FileText, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StaffDataPanel, StaffDataPanelHeader, StaffEmptyState, StaffKpiStat, StaffToolbar } from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { PersonalCategorySelect } from '@/components/personal/PersonalFilters';
import { type CategoryFilter } from '@/lib/utils/personalFilter';
import { personalIncidentsService, type PersonalIncident } from '@/lib/services/personalIncidentsService';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { monthStartOf } from '@/lib/utils/personalAttendanceRows';
import { countBy, formatLimaDateTime, incidentMonthKey } from '@/lib/utils/personalReportStats';
import { addDataSheet, createWorkbook, runExcelExport, saveWorkbook } from '@/lib/utils/excelExport';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';

const CountTable = ({ title, rows, label }: { title: string; rows: { label: string; count: number }[]; label: string }) => (
  <StaffDataPanel>
    <StaffDataPanelHeader title={title} />
    <div className="p-4 pt-0 sm:p-5 sm:pt-0">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos</p>
      ) : (
        <div className="app-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{label}</TableHead>
                <TableHead className="text-right">Incidencias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right font-semibold">{r.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  </StaffDataPanel>
);

export const PersonalIncidentReport = () => {
  const today = getLimaTodayDate();
  const [from, setFrom] = useState(monthStartOf(today));
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [all, setAll] = useState<PersonalIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      const { incidents, error } = await personalIncidentsService.list({ from, to });
      if (error) toast.error(error);
      setAll(incidents);
      setLoading(false);
      setRefreshing(false);
    },
    [from, to],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Las anuladas no cuentan en el reporte.
  const incidents = useMemo(
    () => all.filter((i) => i.status !== 'Anulada' && (category === 'all' || i.personalCategory === category)),
    [all, category],
  );

  const byFault = useMemo(() => countBy(incidents, (i) => i.faultName), [incidents]);
  const byCategory = useMemo(() => countBy(incidents, (i) => i.personalCategory ?? 'Sin categoría'), [incidents]);
  const byEmployee = useMemo(() => countBy(incidents, (i) => i.personalName).slice(0, 15), [incidents]);
  const byMonth = useMemo(
    () => countBy(incidents, incidentMonthKey).sort((a, b) => a.label.localeCompare(b.label)),
    [incidents],
  );

  const stats = {
    total: incidents.length,
    active: incidents.filter((i) => i.status === 'Activa').length,
    justified: incidents.filter((i) => i.status === 'Justificada').length,
    people: new Set(incidents.map((i) => i.personalId)).size,
    serious: incidents.filter((i) => i.isSerious).length,
  };

  const subtitle = buildFilterSubtitle([`Del ${from} al ${to}`, category !== 'all' && category]);

  const exportPdf = async () => {
    const doc = new PdfReportDocument('portrait', 'Reporte de Incidencias del Personal', subtitle);
    await doc.drawCoverHeader();
    doc.drawKpiCards([
      { label: 'Incidencias', value: stats.total, tone: 'primary' },
      { label: 'Activas', value: stats.active, tone: 'warning' },
      { label: 'Justificadas', value: stats.justified, tone: 'success' },
      { label: 'Empleados', value: stats.people, tone: 'info' },
    ]);
    const cols = (label: string) => [
      { header: label, dataKey: 'label' },
      { header: 'Incidencias', dataKey: 'count', width: 30, align: 'right' as const },
    ];
    doc.drawSectionTitle('Por falta');
    doc.drawTable(cols('Falta'), byFault);
    doc.drawSectionTitle('Por categoría de personal');
    doc.drawTable(cols('Categoría'), byCategory);
    doc.drawSectionTitle('Empleados con más incidencias');
    doc.drawTable(cols('Empleado'), byEmployee);
    doc.drawSectionTitle('Detalle');
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 32 },
        { header: 'Empleado', dataKey: 'empleado' },
        { header: 'Falta', dataKey: 'falta' },
        { header: 'Estado', dataKey: 'estado', width: 24 },
      ],
      incidents.map((i) => ({
        fecha: formatLimaDateTime(i.registeredAt),
        empleado: i.personalName,
        falta: i.faultName,
        estado: i.status,
      })),
      { fontSize: 7.5 },
    );
    await doc.finalize(`reporte-incidencias-personal-${from}-a-${to}.pdf`);
  };

  const exportExcel = () =>
    runExcelExport('Reporte de incidencias del personal', async () => {
      const wb = createWorkbook('Reporte de incidencias del personal');
      await addDataSheet(wb, 'Por falta', 'Incidencias del personal por falta', subtitle, ['Falta', 'Incidencias'], byFault.map((r) => [r.label, r.count]));
      await addDataSheet(wb, 'Por categoría', 'Incidencias por categoría de personal', subtitle, ['Categoría', 'Incidencias'], byCategory.map((r) => [r.label, r.count]));
      await addDataSheet(wb, 'Por empleado', 'Incidencias por empleado', subtitle, ['Empleado', 'Incidencias'], countBy(incidents, (i) => i.personalName).map((r) => [r.label, r.count]));
      await addDataSheet(
        wb,
        'Detalle',
        'Detalle de incidencias del personal',
        subtitle,
        ['Fecha y hora', 'Empleado', 'DNI', 'Categoría', 'Falta', 'Grave', 'Estado', 'Observación'],
        incidents.map((i) => [
          formatLimaDateTime(i.registeredAt),
          i.personalName,
          i.personalBarcode,
          i.personalCategory ?? '',
          i.faultName,
          i.isSerious ? 'Sí' : 'No',
          i.status,
          i.observations ?? '',
        ]),
      );
      await saveWorkbook(wb, `reporte-incidencias-personal-${from}-a-${to}.xlsx`);
    });

  if (loading) return <PageLoader message="Cargando reporte..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={BarChart3}
        eyebrow="Personal"
        title="Reporte de Incidencias del Personal"
        description="Resumen por falta, categoría, empleado y mes (sin anuladas)"
        accent="info"
      >
        <div className="flex gap-2">
          <Button variant="outline-primary" onClick={() => void exportExcel()} disabled={stats.total === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="info" onClick={() => void exportPdf()} disabled={stats.total === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Incidencias" value={stats.total} hint={`${stats.serious} graves`} icon={FileText} tone="info" />
        <StaffKpiStat label="Activas" value={stats.active} hint="Sin resolver" icon={AlertTriangle} tone="warning" />
        <StaffKpiStat label="Justificadas" value={stats.justified} hint="Con motivo" icon={CheckCircle2} tone="success" />
        <StaffKpiStat label="Empleados" value={stats.people} hint="Con al menos una" icon={Users} tone="primary" />
      </div>

      <StaffToolbar title="Filtros" description="Rango de fechas y categoría">
        <div className="space-y-2">
          <Label htmlFor="pir-from">Desde</Label>
          <Input id="pir-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pir-to">Hasta</Label>
          <Input id="pir-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="flex items-end">
          <Button variant="outline" onClick={() => void load(true)} className="w-full" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      {stats.total === 0 ? (
        <StaffDataPanel>
          <StaffEmptyState icon={BarChart3} title="Sin incidencias" description="No hay incidencias del personal en el rango" />
        </StaffDataPanel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <CountTable title="Por falta" rows={byFault} label="Falta" />
          <CountTable title="Por categoría de personal" rows={byCategory} label="Categoría" />
          <CountTable title="Empleados con más incidencias" rows={byEmployee} label="Empleado" />
          <CountTable title="Por mes" rows={byMonth} label="Mes" />
        </div>
      )}
    </div>
  );
};

export default PersonalIncidentReport;
