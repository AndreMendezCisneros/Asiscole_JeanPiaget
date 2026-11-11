import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, FileDown, Loader2, Timer, UserSquare2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffSegmentedControl,
  StaffToolbar,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { personalService } from '@/lib/services/personalService';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { personalIncidentsService, type PersonalIncident } from '@/lib/services/personalIncidentsService';
import { personalTallerService } from '@/lib/services/personalTallerService';
import { getLimaNow, getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { DEPARTURE_STATUS_LABEL, monthStartOf, PERSONAL_STATUS_BADGE, PERSONAL_STATUS_LABEL } from '@/lib/utils/personalAttendanceRows';
import { computeLostTime, formatMinutes } from '@/lib/utils/personalLostTime';
import { computeNetOvertime, computeOvertime, formatSignedMinutes } from '@/lib/utils/personalOvertime';
import {
  computeWorkedTime,
  monthEndOf,
  monthLabel,
  monthRangeWithin,
  monthsBetween,
  unauthorizedDepartures,
} from '@/lib/utils/personalWorkedTime';
import { formatScheduleSummary } from '@/lib/utils/personalSchedule';
import { formatLimaDateTime, incidentMonthKey, summarizePersonalAttendance } from '@/lib/utils/personalReportStats';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import { DIAS_SEMANA, type Personal, type PersonalArrivalRecord, type PersonalTallerRecord } from '@/types/personal';

type PeriodMode = 'month' | 'year' | 'range';

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

/** Recorta el fin del periodo a hoy (sin quedar antes del inicio). */
function clampEnd(from: string, end: string, today: string): string {
  if (end <= today) return end;
  return today < from ? from : today;
}

interface MonthRow {
  month: string;
  label: string;
  onTime: number;
  late: number;
  absent: number;
  unauthorized: number;
  workedMin: number;
  overtimeMin: number;
  incidents: number;
}

export const PersonalIntegralReport = () => {
  const today = getLimaTodayDate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [monthValue, setMonthValue] = useState(today.slice(0, 7));
  const [yearValue, setYearValue] = useState(Number(today.slice(0, 4)));
  const [rangeFrom, setRangeFrom] = useState(monthStartOf(today));
  const [rangeTo, setRangeTo] = useState(today);
  const [records, setRecords] = useState<PersonalArrivalRecord[]>([]);
  const [talleres, setTalleres] = useState<PersonalTallerRecord[]>([]);
  const [incidents, setIncidents] = useState<PersonalIncident[]>([]);
  const [loadingData, setLoadingData] = useState(false);

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
    periodMode === 'month'
      ? monthLabel(monthValue)
      : periodMode === 'year'
        ? `Año ${yearValue}`
        : `Del ${formatDate(from)} al ${formatDate(to)}`;

  useEffect(() => {
    void personalService.getAll().then(({ personal: rows, error }) => {
      if (error) toast.error(error);
      setPersonal(rows);
      setLoadingList(false);
    });
  }, []);

  const selected = personal.find((p) => String(p.id) === selectedId) ?? null;

  useEffect(() => {
    if (!selected || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
    let cancelled = false;
    setLoadingData(true);
    void Promise.all([
      personalAttendanceService.getRecords({ from, to, personalId: selected.id }),
      personalIncidentsService.list({ from, to, personalId: selected.id }),
      personalTallerService.getRecords({ from, to }),
    ]).then(([regs, incs, tall]) => {
      if (cancelled) return;
      if (regs.error) toast.error(regs.error);
      if (incs.error) toast.error(incs.error);
      if (tall.error) toast.error(tall.error);
      setRecords(regs.records);
      setIncidents(incs.incidents);
      setTalleres(tall.records.filter((t) => t.personalId === selected.id));
      setLoadingData(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, from, to]);

  const summary = useMemo(
    () => (selected ? summarizePersonalAttendance([selected], records, from, to, today)[0] : null),
    [selected, records, from, to, today],
  );
  const activeIncidents = useMemo(() => incidents.filter((i) => i.status !== 'Anulada'), [incidents]);
  const lost = useMemo(() => {
    if (!selected) return null;
    return computeLostTime([selected], records, from, to, today, getLimaNow().time)[0];
  }, [selected, records, from, to, today]);
  const overtime = useMemo(
    () => (selected ? computeOvertime([selected], records, talleres, today)[0] : null),
    [selected, records, talleres, today],
  );
  const worked = useMemo(
    () => (selected ? computeWorkedTime(selected.id, records, talleres, today) : null),
    [selected, records, talleres, today],
  );
  /** Horas adicionales − (tardanzas + inasistencias + salidas anticipadas) sin justificar. */
  const netOvertime = useMemo(
    () => (overtime && lost ? computeNetOvertime([overtime], [lost])[0] : null),
    [overtime, lost],
  );
  const unauthorized = useMemo(
    () => (selected ? unauthorizedDepartures(selected, records) : []),
    [selected, records],
  );

  const monthRows = useMemo<MonthRow[]>(() => {
    if (!selected) return [];
    const months = monthsBetween(from, to);
    if (months.length < 2) return [];
    return months.map((month) => {
      const r = monthRangeWithin(month, from, to);
      const recs = records.filter((x) => x.date >= r.from && x.date <= r.to);
      const tall = talleres.filter((x) => x.date >= r.from && x.date <= r.to);
      const s = summarizePersonalAttendance([selected], recs, r.from, r.to, today)[0];
      return {
        month,
        label: monthLabel(month),
        onTime: s.onTime,
        late: s.late + s.lateJustified,
        absent: s.absent + s.noRecord,
        unauthorized: unauthorizedDepartures(selected, recs).length,
        workedMin: computeWorkedTime(selected.id, recs, tall, today).workedMin,
        overtimeMin: computeOvertime([selected], recs, tall, today)[0].totalMin,
        incidents: activeIncidents.filter((i) => incidentMonthKey(i) === month).length,
      };
    });
  }, [selected, records, talleres, activeIncidents, from, to, today]);

  const exportPdf = async () => {
    if (!selected || !summary || !overtime || !worked) return;
    const doc = new PdfReportDocument(
      'portrait',
      'Reporte Integral del Personal',
      buildFilterSubtitle([selected.fullName, periodLabel, periodMode !== 'range' && `Del ${from} al ${to}`]),
    );
    await doc.drawCoverHeader();
    doc.drawSectionTitle('Datos del empleado');
    doc.drawKeyValueList([
      { label: 'Nombre', value: selected.fullName },
      { label: 'DNI', value: selected.barcode },
      { label: 'Categoría', value: selected.category },
      { label: 'Cargo', value: selected.position ?? '—' },
      { label: 'Horario', value: formatScheduleSummary(selected.schedule) },
    ]);

    doc.drawSectionTitle('Asistencia');
    doc.drawKpiCards([
      { label: 'A tiempo', value: summary.onTime, tone: 'success' },
      { label: 'Tardanzas', value: summary.late + summary.lateJustified, tone: 'warning' },
      { label: 'Faltas', value: summary.absent + summary.noRecord, tone: 'error' },
      { label: 'H. trabajadas', value: formatMinutes(worked.workedMin), tone: 'primary' },
      { label: 'H. adicionales', value: formatMinutes(overtime.totalMin), tone: 'info' },
    ]);
    const kv = [
      { label: 'Días programados', value: String(summary.scheduledDays) },
      { label: 'Puntualidad', value: summary.punctuality == null ? '—' : `${summary.punctuality}%` },
      { label: 'Salidas sin autorización', value: String(unauthorized.length) },
      { label: 'Horas adicionales: salida después de hora', value: formatMinutes(overtime.afterExitMin) },
      { label: 'Horas adicionales: taller', value: formatMinutes(overtime.tallerMin) },
      { label: 'Horas adicionales: día sin horario', value: formatMinutes(overtime.offDayMin) },
    ];
    if (lost) {
      kv.push(
        { label: 'Tiempo no trabajado (total)', value: formatMinutes(lost.lostTotalMin) },
        { label: 'Justificado', value: formatMinutes(lost.lostJustifiedMin) },
        { label: 'No trabajado sin justificar', value: formatMinutes(lost.lostNetMin) },
      );
    }
    if (netOvertime) {
      kv.push({
        label: 'Horas adicionales reales (descontando lo no justificado)',
        value: formatSignedMinutes(netOvertime.realMin),
      });
    }
    if (worked.noDepartureDays > 0) {
      kv.push({ label: 'Días sin salida marcada (cuentan 0 h)', value: String(worked.noDepartureDays) });
    }
    if (overtime.daysWithoutExit > 0) {
      kv.push({ label: 'Días sin hora de salida en su horario', value: String(overtime.daysWithoutExit) });
    }
    doc.drawKeyValueList(kv);

    if (monthRows.length > 0) {
      doc.drawSectionTitle('Resumen por mes');
      doc.drawTable(
        [
          { header: 'Mes', dataKey: 'mes', width: 30 },
          { header: 'A tiempo', dataKey: 'atiempo', width: 18, align: 'center' },
          { header: 'Tard.', dataKey: 'tard', width: 16, align: 'center' },
          { header: 'Faltas', dataKey: 'faltas', width: 16, align: 'center' },
          { header: 'Sal. sin aut.', dataKey: 'sinaut', width: 20, align: 'center' },
          { header: 'H. trabajadas', dataKey: 'trab', width: 24, align: 'center' },
          { header: 'H. adicionales', dataKey: 'extra', width: 20, align: 'center' },
          { header: 'Incid.', dataKey: 'inc', align: 'center' },
        ],
        monthRows.map((m) => ({
          mes: m.label,
          atiempo: String(m.onTime),
          tard: String(m.late),
          faltas: String(m.absent),
          sinaut: String(m.unauthorized),
          trab: formatMinutes(m.workedMin),
          extra: formatMinutes(m.overtimeMin),
          inc: String(m.incidents),
        })),
        { fontSize: 7.5 },
      );
    }

    doc.drawSectionTitle('Detalle de asistencia');
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 22 },
        { header: 'Entrada esp.', dataKey: 'esperada', width: 20, align: 'center' },
        { header: 'Llegó', dataKey: 'llego', width: 16, align: 'center' },
        { header: 'Salida esp.', dataKey: 'salidaEsp', width: 20, align: 'center' },
        { header: 'Salió', dataKey: 'salio', width: 22, align: 'center' },
        { header: 'Estado', dataKey: 'estado', width: 28 },
        { header: 'Motivo', dataKey: 'motivo' },
      ],
      records.map((r) => ({
        fecha: formatDate(r.date),
        esperada: r.expectedEntry ?? '—',
        llego: r.arrivalTime ?? '—',
        salidaEsp: r.expectedExit ?? '—',
        salio: r.departureTime
          ? `${r.departureTime}${r.departureType === 'Anticipada' ? ' (sin aut.)' : r.departureType === 'Autorizada' ? ' (autoriz.)' : ''}`
          : '—',
        estado: PERSONAL_STATUS_LABEL[r.status],
        motivo: r.justificationReason ?? r.departureReason ?? '',
      })),
      { fontSize: 7.5 },
    );

    doc.drawSectionTitle(`Salidas sin autorización (${unauthorized.length})`);
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 26 },
        { header: 'Hora de salida', dataKey: 'esperada', width: 28, align: 'center' },
        { header: 'Salió', dataKey: 'salio', width: 22, align: 'center' },
        { header: 'Tiempo antes', dataKey: 'antes', width: 28, align: 'center' },
        { header: 'Motivo', dataKey: 'motivo' },
      ],
      unauthorized.map((u) => ({
        fecha: formatDate(u.date),
        esperada: u.expectedExit ?? '—',
        salio: u.departureTime,
        antes: u.minutesEarly == null ? '—' : formatMinutes(u.minutesEarly),
        motivo: u.reason ?? '',
      })),
      { fontSize: 7.5 },
    );

    doc.drawSectionTitle(`Horas adicionales (${formatMinutes(overtime.totalMin)})`);
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 26 },
        { header: 'Tipo', dataKey: 'tipo', width: 30 },
        { header: 'Tiempo', dataKey: 'tiempo', width: 22, align: 'center' },
        { header: 'Detalle', dataKey: 'detalle' },
      ],
      [...overtime.items]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((i) => ({
          fecha: formatDate(i.date),
          tipo: i.kind,
          tiempo: formatMinutes(i.minutes),
          detalle: i.detail,
        })),
      { fontSize: 7.5 },
    );
    doc.drawParagraph(
      'Hora adicional = hora en que salió − su hora de salida (ej.: sale a las 14:00 y se va a las 15:00 = 1 h). Llegar antes no cuenta. Taller y días sin horario suman salida − entrada. Horas trabajadas = salida − llegada reales; sin salida marcada cuenta 0.',
      7.5,
    );

    doc.drawSectionTitle(`Incidencias (${activeIncidents.length})`);
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 32 },
        { header: 'Falta', dataKey: 'falta' },
        { header: 'Estado', dataKey: 'estado', width: 24 },
        { header: 'Observación', dataKey: 'obs' },
        { header: 'Registró', dataKey: 'registro', width: 36 },
      ],
      activeIncidents.map((i) => ({
        fecha: formatLimaDateTime(i.registeredAt),
        falta: i.faultName,
        estado: i.status,
        obs: i.observations ?? '',
        registro: i.registeredByName ?? '—',
      })),
      { fontSize: 7.5 },
    );
    const tag = periodMode === 'month' ? monthValue : periodMode === 'year' ? `anual-${yearValue}` : `${from}-a-${to}`;
    await doc.finalize(`reporte-integral-${selected.barcode}-${tag}.pdf`);
  };

  if (loadingList) return <PageLoader message="Cargando personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={UserSquare2}
        eyebrow="Personal"
        title="Reporte Integral del Personal"
        description="Datos, asistencia, horas trabajadas, horas adicionales e incidencias de un empleado"
        accent="info"
      >
        <Button variant="info" onClick={() => void exportPdf()} disabled={!selected || loadingData}>
          <FileDown className="mr-2 h-4 w-4" />
          PDF
        </Button>
      </PageHeader>

      <StaffToolbar title="Empleado y periodo" description="Elija a quién y el periodo: un mes, el año completo o un rango">
        <div className="space-y-2 sm:col-span-2">
          <Label>Empleado</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Elegir empleado..." />
            </SelectTrigger>
            <SelectContent>
              {personal.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.fullName} {p.active ? '' : '(inactivo)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
            <Label htmlFor="pint-month">Mes</Label>
            <Input id="pint-month" type="month" value={monthValue} max={today.slice(0, 7)} onChange={(e) => setMonthValue(e.target.value || monthValue)} />
          </div>
        )}
        {periodMode === 'year' && (
          <div className="space-y-2">
            <Label htmlFor="pint-year">Año</Label>
            <Input
              id="pint-year"
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
              <Label htmlFor="pint-from">Desde</Label>
              <Input id="pint-from" type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value || rangeFrom)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pint-to">Hasta</Label>
              <Input id="pint-to" type="date" value={rangeTo} min={rangeFrom} onChange={(e) => setRangeTo(e.target.value || rangeTo)} />
            </div>
          </>
        )}
      </StaffToolbar>

      {!selected ? (
        <StaffDataPanel>
          <StaffEmptyState icon={UserSquare2} title="Elija un empleado" description="El reporte se arma al seleccionarlo" />
        </StaffDataPanel>
      ) : loadingData || !summary || !overtime || !worked ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <StaffDataPanel>
            <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <StudentPhoto src={selected.profilePhoto} name={selected.fullName} className="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{selected.fullName}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.category}
                  {selected.position ? ` · ${selected.position}` : ''} · DNI {selected.barcode} · {periodLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d) => {
                  const h = selected.schedule.find((x) => x.day === d.value);
                  return (
                    <Badge key={d.value} variant={h ? 'info' : 'outline'} title={h ? `${h.entry}${h.exit ? `–${h.exit}` : ''}` : 'No asiste'}>
                      {d.short} {h ? `${h.entry}${h.exit ? `–${h.exit}` : ''}` : '—'}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </StaffDataPanel>

          <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-5">
            <StaffKpiStat label="A tiempo" value={summary.onTime} hint={`De ${summary.scheduledDays} días programados`} icon={CheckCircle2} tone="success" />
            <StaffKpiStat label="Tardanzas" value={summary.late + summary.lateJustified} hint={`${summary.lateJustified} justificadas`} icon={AlertTriangle} tone="warning" />
            <StaffKpiStat label="Faltas" value={summary.absent + summary.noRecord} hint={`${summary.absentJustified} justificadas aparte`} icon={UserX} tone="accent" />
            <StaffKpiStat
              label="Horas trabajadas"
              value={formatMinutes(worked.workedMin)}
              hint={worked.noDepartureDays > 0 ? `${worked.noDepartureDays} días sin salida marcada` : `${worked.daysWorked} días`}
              icon={Clock}
              tone="primary"
            />
            <StaffKpiStat
              label="Horas adicionales"
              value={formatMinutes(overtime.totalMin)}
              hint={overtime.daysWithoutExit > 0 ? `${overtime.daysWithoutExit} días sin hora de salida en horario` : 'Salida tarde + taller'}
              icon={Timer}
              tone="info"
            />
          </div>

          <StaffDataPanel>
            <StaffDataPanelHeader title="Resumen" description="Puntualidad, salidas, tiempo no trabajado y horas adicionales" />
            <div className="grid gap-2 p-4 pt-0 text-sm sm:grid-cols-3 sm:p-5 sm:pt-0">
              <p>Días programados: <strong>{summary.scheduledDays}</strong></p>
              <p>Puntualidad: <strong>{summary.punctuality == null ? '—' : `${summary.punctuality}%`}</strong></p>
              <p>Salidas sin autorización: <strong>{unauthorized.length}</strong></p>
              {lost && (
                <>
                  <p>No trabajado (total): <strong>{formatMinutes(lost.lostTotalMin)}</strong></p>
                  <p>Justificado: <strong>{formatMinutes(lost.lostJustifiedMin)}</strong></p>
                  <p>Sin justificar: <strong>{formatMinutes(lost.lostNetMin)}</strong></p>
                </>
              )}
              <p>Adicional por salida tarde: <strong>{formatMinutes(overtime.afterExitMin)}</strong></p>
              <p>Adicional por taller: <strong>{formatMinutes(overtime.tallerMin)}</strong></p>
              <p>Adicional día sin horario: <strong>{formatMinutes(overtime.offDayMin)}</strong></p>
              {netOvertime && (
                <p className="sm:col-span-3">
                  Horas adicionales reales (adicionales − tardanzas, inasistencias y salidas anticipadas sin justificar):{' '}
                  <strong className={netOvertime.realMin < 0 ? 'text-destructive' : ''}>{formatSignedMinutes(netOvertime.realMin)}</strong>
                </p>
              )}
            </div>
          </StaffDataPanel>

          {monthRows.length > 0 && (
            <StaffDataPanel>
              <StaffDataPanelHeader title="Resumen por mes" />
              <div className="p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="app-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead className="text-center">A tiempo</TableHead>
                        <TableHead className="text-center">Tardanzas</TableHead>
                        <TableHead className="text-center">Faltas</TableHead>
                        <TableHead className="text-center">Sal. sin aut.</TableHead>
                        <TableHead className="text-center">H. trabajadas</TableHead>
                        <TableHead className="text-center">H. adicionales</TableHead>
                        <TableHead className="text-center">Incid.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthRows.map((m) => (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.label}</TableCell>
                          <TableCell className="text-center">{m.onTime}</TableCell>
                          <TableCell className="text-center">{m.late}</TableCell>
                          <TableCell className="text-center">{m.absent}</TableCell>
                          <TableCell className="text-center">{m.unauthorized}</TableCell>
                          <TableCell className="text-center font-mono">{formatMinutes(m.workedMin)}</TableCell>
                          <TableCell className="text-center font-mono">{formatMinutes(m.overtimeMin)}</TableCell>
                          <TableCell className="text-center">{m.incidents}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </StaffDataPanel>
          )}

          <StaffDataPanel>
            <StaffDataPanelHeader title={`Asistencia (${records.length} registros)`} />
            <div className="p-4 pt-0 sm:p-5 sm:pt-0">
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin registros en el periodo.</p>
              ) : (
                <div className="app-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Entrada esperada</TableHead>
                        <TableHead>Llegó</TableHead>
                        <TableHead>Salida esperada</TableHead>
                        <TableHead>Salió</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...records].reverse().map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{formatDate(r.date)}</TableCell>
                          <TableCell className="font-mono text-sm">{r.expectedEntry ?? '—'}</TableCell>
                          <TableCell className="font-mono text-sm">{r.arrivalTime ?? '—'}</TableCell>
                          <TableCell className="font-mono text-sm">{r.expectedExit ?? '—'}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {r.departureTime ?? '—'}
                            {(r.departureType === 'Anticipada' || r.departureType === 'Autorizada') && (
                              <Badge variant={r.departureType === 'Anticipada' ? 'destructive' : 'info'} className="ml-2">
                                {DEPARTURE_STATUS_LABEL[r.departureType]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={PERSONAL_STATUS_BADGE[r.status]}>{PERSONAL_STATUS_LABEL[r.status]}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs text-sm">{r.justificationReason ?? r.departureReason ?? ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </StaffDataPanel>

          <StaffDataPanel>
            <StaffDataPanelHeader title={`Salidas sin autorización (${unauthorized.length})`} description="Se fue antes de su hora de salida sin permiso" />
            <div className="p-4 pt-0 sm:p-5 sm:pt-0">
              {unauthorized.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin salidas sin autorización en el periodo.</p>
              ) : (
                <div className="app-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Hora de salida</TableHead>
                        <TableHead>Salió</TableHead>
                        <TableHead>Tiempo antes</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unauthorized.map((u) => (
                        <TableRow key={u.date}>
                          <TableCell className="font-mono text-sm">{formatDate(u.date)}</TableCell>
                          <TableCell className="font-mono text-sm">{u.expectedExit ?? '—'}</TableCell>
                          <TableCell className="font-mono text-sm">{u.departureTime}</TableCell>
                          <TableCell className="font-mono text-sm">{u.minutesEarly == null ? '—' : formatMinutes(u.minutesEarly)}</TableCell>
                          <TableCell className="max-w-xs text-sm">{u.reason ?? ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </StaffDataPanel>

          <StaffDataPanel>
            <StaffDataPanelHeader
              title={`Horas adicionales (${formatMinutes(overtime.totalMin)})`}
              description="Salió después de su hora de salida, talleres y días sin horario. Llegar antes no cuenta."
            />
            <div className="p-4 pt-0 sm:p-5 sm:pt-0">
              {overtime.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin horas adicionales en el periodo.
                  {overtime.daysWithoutExit > 0 &&
                    ` Hay ${overtime.daysWithoutExit} días en que su horario no tiene hora de salida: no se pueden calcular.`}
                </p>
              ) : (
                <div className="app-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Tiempo</TableHead>
                        <TableHead>Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overtime.items.map((i, idx) => (
                        <TableRow key={`${i.date}-${i.kind}-${idx}`}>
                          <TableCell className="font-mono text-sm">{formatDate(i.date)}</TableCell>
                          <TableCell>
                            <Badge variant="info">{i.kind}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{formatMinutes(i.minutes)}</TableCell>
                          <TableCell className="text-sm">{i.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </StaffDataPanel>

          <StaffDataPanel>
            <StaffDataPanelHeader title={`Incidencias (${activeIncidents.length})`} description="Sin anuladas" />
            <div className="p-4 pt-0 sm:p-5 sm:pt-0">
              {activeIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin incidencias en el periodo.</p>
              ) : (
                <div className="app-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Falta</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Observación</TableHead>
                        <TableHead>Registró</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeIncidents.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="whitespace-nowrap font-mono text-xs">{formatLimaDateTime(i.registeredAt)}</TableCell>
                          <TableCell>{i.faultName}</TableCell>
                          <TableCell>
                            <Badge variant={i.status === 'Activa' ? 'destructive' : 'info'}>{i.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs text-sm">{i.observations ?? ''}</TableCell>
                          <TableCell className="text-sm">{i.registeredByName ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </StaffDataPanel>
        </>
      )}
    </div>
  );
};

export default PersonalIntegralReport;
