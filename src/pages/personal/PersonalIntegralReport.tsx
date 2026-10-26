import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileDown, FileText, Loader2, UserSquare2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffDataPanel, StaffDataPanelHeader, StaffEmptyState, StaffKpiStat, StaffToolbar } from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { personalService } from '@/lib/services/personalService';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { personalIncidentsService, type PersonalIncident } from '@/lib/services/personalIncidentsService';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { DEPARTURE_STATUS_LABEL, monthStartOf, PERSONAL_STATUS_BADGE, PERSONAL_STATUS_LABEL } from '@/lib/utils/personalAttendanceRows';
import { computeLostTime, formatMinutes } from '@/lib/utils/personalLostTime';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { formatScheduleSummary } from '@/lib/utils/personalSchedule';
import { formatLimaDateTime, summarizePersonalAttendance } from '@/lib/utils/personalReportStats';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import { DIAS_SEMANA, type Personal, type PersonalArrivalRecord } from '@/types/personal';

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

export const PersonalIntegralReport = () => {
  const today = getLimaTodayDate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [from, setFrom] = useState(monthStartOf(today));
  const [to, setTo] = useState(today);
  const [records, setRecords] = useState<PersonalArrivalRecord[]>([]);
  const [incidents, setIncidents] = useState<PersonalIncident[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    void personalService.getAll().then(({ personal: rows, error }) => {
      if (error) toast.error(error);
      setPersonal(rows);
      setLoadingList(false);
    });
  }, []);

  const selected = personal.find((p) => String(p.id) === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingData(true);
    void Promise.all([
      personalAttendanceService.getRecords({ from, to, personalId: selected.id }),
      personalIncidentsService.list({ from, to, personalId: selected.id }),
    ]).then(([regs, incs]) => {
      if (cancelled) return;
      if (regs.error) toast.error(regs.error);
      if (incs.error) toast.error(incs.error);
      setRecords(regs.records);
      setIncidents(incs.incidents);
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
  const activeIncidents = incidents.filter((i) => i.status !== 'Anulada');
  const lost = useMemo(() => {
    if (!selected) return null;
    const now = getLimaNow();
    return computeLostTime([selected], records, from, to, today, now.time)[0];
     
  }, [selected, records, from, to, today]);

  const exportPdf = async () => {
    if (!selected || !summary) return;
    const doc = new PdfReportDocument(
      'portrait',
      'Reporte Integral del Personal',
      buildFilterSubtitle([selected.fullName, `Del ${from} al ${to}`]),
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
      { label: 'Programados', value: summary.scheduledDays, tone: 'primary' },
      { label: 'A tiempo', value: summary.onTime, tone: 'success' },
      { label: 'Tardanzas', value: summary.late + summary.lateJustified, tone: 'warning' },
      { label: 'Faltas', value: summary.absent + summary.noRecord, tone: 'error' },
      { label: 'Puntualidad', value: summary.punctuality == null ? '—' : `${summary.punctuality}%`, tone: 'info' },
    ]);
    if (lost) {
      doc.drawKeyValueList([
        { label: 'Tiempo no trabajado (total)', value: formatMinutes(lost.lostTotalMin) },
        { label: 'Justificado', value: formatMinutes(lost.lostJustifiedMin) },
        { label: 'No trabajado sin justificar', value: formatMinutes(lost.lostNetMin) },
      ]);
    }
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 24 },
        { header: 'Entrada esp.', dataKey: 'esperada', width: 24, align: 'center' },
        { header: 'Llegó', dataKey: 'llego', width: 18, align: 'center' },
        { header: 'Salió', dataKey: 'salio', width: 18, align: 'center' },
        { header: 'Estado', dataKey: 'estado', width: 32 },
        { header: 'Motivo', dataKey: 'motivo' },
      ],
      records.map((r) => ({
        fecha: formatDate(r.date),
        esperada: r.expectedEntry ?? '—',
        llego: r.arrivalTime ?? '—',
        salio: r.departureTime ? `${r.departureTime}${r.departureType === 'Anticipada' ? ' (antic.)' : ''}` : '—',
        estado: PERSONAL_STATUS_LABEL[r.status],
        motivo: r.justificationReason ?? r.departureReason ?? '',
      })),
      { fontSize: 7.5 },
    );
    doc.drawSectionTitle(`Incidencias (${activeIncidents.length})`);
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'fecha', width: 32 },
        { header: 'Falta', dataKey: 'falta' },
        { header: 'Estado', dataKey: 'estado', width: 24 },
        { header: 'Observación', dataKey: 'obs' },
      ],
      activeIncidents.map((i) => ({
        fecha: formatLimaDateTime(i.registeredAt),
        falta: i.faultName,
        estado: i.status,
        obs: i.observations ?? '',
      })),
      { fontSize: 7.5 },
    );
    await doc.finalize(`reporte-integral-${selected.barcode}-${from}-a-${to}.pdf`);
  };

  if (loadingList) return <PageLoader message="Cargando personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={UserSquare2}
        eyebrow="Personal"
        title="Reporte Integral del Personal"
        description="Datos, horario, asistencia e incidencias de un empleado"
        accent="info"
      >
        <Button variant="info" onClick={() => void exportPdf()} disabled={!selected || loadingData}>
          <FileDown className="mr-2 h-4 w-4" />
          PDF
        </Button>
      </PageHeader>

      <StaffToolbar title="Empleado y periodo" description="Elija a quién y el rango de fechas">
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
        <div className="space-y-2">
          <Label htmlFor="pint-from">Desde</Label>
          <Input id="pint-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pint-to">Hasta</Label>
          <Input id="pint-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
      </StaffToolbar>

      {!selected ? (
        <StaffDataPanel>
          <StaffEmptyState icon={UserSquare2} title="Elija un empleado" description="El reporte se arma al seleccionarlo" />
        </StaffDataPanel>
      ) : loadingData || !summary ? (
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
                  {selected.position ? ` · ${selected.position}` : ''} · DNI {selected.barcode}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d) => {
                  const h = selected.schedule.find((x) => x.day === d.value);
                  return (
                    <Badge key={d.value} variant={h ? 'info' : 'outline'} title={h ? `${h.entry}${h.exit ? `–${h.exit}` : ''}` : 'No asiste'}>
                      {d.short} {h ? h.entry : '—'}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </StaffDataPanel>

          <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
            <StaffKpiStat label="A tiempo" value={summary.onTime} hint={`De ${summary.scheduledDays} días programados`} icon={CheckCircle2} tone="success" />
            <StaffKpiStat label="Tardanzas" value={summary.late + summary.lateJustified} hint={`${summary.lateJustified} justificadas`} icon={AlertTriangle} tone="warning" />
            <StaffKpiStat label="Faltas" value={summary.absent + summary.noRecord} hint={`${summary.absentJustified} justificadas aparte`} icon={UserX} tone="accent" />
            <StaffKpiStat label="Incidencias" value={activeIncidents.length} hint={`Puntualidad ${summary.punctuality ?? '—'}%`} icon={FileText} tone="info" />
          </div>

          {lost && (
            <StaffDataPanel>
              <StaffDataPanelHeader title="Tiempo no trabajado" description="Tardanzas, inasistencias (jornada completa) y salidas anticipadas" />
              <div className="grid gap-3 p-4 pt-0 text-sm sm:grid-cols-3 sm:p-5 sm:pt-0">
                <p>
                  Total: <strong>{formatMinutes(lost.lostTotalMin)}</strong>
                </p>
                <p>
                  Justificado: <strong>{formatMinutes(lost.lostJustifiedMin)}</strong>
                </p>
                <p>
                  Sin justificar: <strong>{formatMinutes(lost.lostNetMin)}</strong>
                </p>
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
