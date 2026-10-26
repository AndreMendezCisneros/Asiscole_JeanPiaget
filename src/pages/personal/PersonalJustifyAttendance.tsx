import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarCheck, CheckCircle2, Clock, FilePlus2, Loader2, RefreshCw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { authService } from '@/lib/services';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { usePersonalAttendance } from '@/hooks/usePersonalAttendance';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import { scheduleForDate } from '@/lib/utils/personalSchedule';
import {
  dateKeysBetween,
  monthStartOf,
  PERSONAL_STATUS_BADGE,
  PERSONAL_STATUS_LABEL,
  resolveDayStatus,
} from '@/lib/utils/personalAttendanceRows';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

type Kind = 'tardanza' | 'inasistencia';

interface JustifyItem {
  key: string;
  personal: Personal;
  date: string;
  kind: Kind;
  record: PersonalArrivalRecord | null;
  label: string;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

export const PersonalJustifyAttendance = () => {
  const now = getLimaNow();
  const [from, setFrom] = useState(monthStartOf(now.date));
  const [to, setTo] = useState(now.date);
  const { personal, records, absenceAfterMin, loading, refreshing, reload } = usePersonalAttendance(from, to);
  const [view, setView] = useState<'pending' | 'done'>('pending');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [target, setTarget] = useState<JustifyItem | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newPersonalId, setNewPersonalId] = useState('');
  const [newDate, setNewDate] = useState(now.date);

  const pending = useMemo<JustifyItem[]>(() => {
    const items: JustifyItem[] = [];
    const recordKey = new Map(records.map((r) => [`${r.personalId}|${r.date}`, r]));
    for (const r of records) {
      const p = personal.find((x) => x.id === r.personalId);
      if (!p) continue;
      if (r.status === 'Tarde') {
        items.push({ key: `t-${r.id}`, personal: p, date: r.date, kind: 'tardanza', record: r, label: `Tarde · ${r.arrivalTime} (entrada ${r.expectedEntry})` });
      } else if (r.status === 'Falta') {
        items.push({ key: `f-${r.id}`, personal: p, date: r.date, kind: 'inasistencia', record: r, label: r.arrivalTime ? `Inasistencia · llegó ${r.arrivalTime}, después de su salida` : 'Inasistencia (no marcó)' });
      }
    }
    // Días que le tocaban sin ningún registro: días pasados, y hoy si ya pasó el
    // margen de inasistencia (N min después de su entrada) aunque el cierre no haya corrido.
    for (const date of dateKeysBetween(from, to)) {
      if (date > now.date) continue;
      for (const p of personal) {
        const horario = scheduleForDate(p.schedule, date);
        if (date < p.createdAt || !horario || recordKey.has(`${p.id}|${date}`)) continue;
        if (resolveDayStatus(horario, null, date, now.date, now.time, absenceAfterMin) !== 'Falta') continue;
        items.push({
          key: `s-${p.id}-${date}`,
          personal: p,
          date,
          kind: 'inasistencia',
          record: null,
          label: `Inasistencia · no marcó (entrada ${horario.entry})`,
        });
      }
    }
    return items.sort((a, b) => b.date.localeCompare(a.date) || a.personal.fullName.localeCompare(b.personal.fullName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personal, records, from, to, absenceAfterMin]);

  const done = useMemo(
    () =>
      records
        .filter((r) => r.status === 'Tarde justificada' || r.status === 'Falta justificada')
        .map((r) => ({ record: r, personal: personal.find((p) => p.id === r.personalId) }))
        .filter((x): x is { record: PersonalArrivalRecord; personal: Personal } => Boolean(x.personal))
        .sort((a, b) => b.record.date.localeCompare(a.record.date)),
    [records, personal],
  );

  const pendingFiltered = pending.filter((i) => matchesPersonalFilter(i.personal, search, category));
  const doneFiltered = done.filter((i) => matchesPersonalFilter(i.personal, search, category));
  const listLength = view === 'pending' ? pendingFiltered.length : doneFiltered.length;

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: listLength, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, view, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const slice = <T,>(items: T[]) => items.slice((page - 1) * pageSize, page * pageSize);

  const openJustify = (item: JustifyItem) => {
    setTarget(item);
    setReason('');
  };

  const submit = async () => {
    if (!target) return;
    const userId = authService.getCurrentUser()?.id;
    if (!userId) {
      toast.error('Sesión expirada');
      return;
    }
    setSaving(true);
    const result =
      target.kind === 'tardanza' && target.record
        ? await personalAttendanceService.justifyTardiness(target.record.id, userId, reason)
        : await personalAttendanceService.justifyAbsence({ personal: target.personal, date: target.date, userId, reason });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Justificación registrada');
    setTarget(null);
    void reload(true);
  };

  const startNew = () => {
    const p = personal.find((x) => String(x.id) === newPersonalId);
    if (!p) {
      toast.error('Elija un empleado');
      return;
    }
    setNewOpen(false);
    openJustify({ key: 'new', personal: p, date: newDate, kind: 'inasistencia', record: null, label: 'Inasistencia (permiso)' });
  };

  if (loading) return <PageLoader message="Cargando asistencia del personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={CalendarCheck}
        eyebrow="Personal"
        title="Justificar Asistencia del Personal"
        description="Tardanzas e inasistencias del personal con su motivo"
        accent="info"
      >
        <Button variant="info" onClick={() => setNewOpen(true)}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Justificar un día
        </Button>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-3">
        <StaffKpiStat label="Tardanzas pendientes" value={pending.filter((i) => i.kind === 'tardanza').length} hint="En el rango" icon={Clock} tone="warning" />
        <StaffKpiStat label="Inasistencias pendientes" value={pending.filter((i) => i.kind === 'inasistencia').length} hint="Debían asistir" icon={UserX} tone="accent" />
        <StaffKpiStat label="Justificadas" value={done.length} hint="En el rango" icon={CheckCircle2} tone="success" />
      </div>

      <StaffToolbar title="Filtros" description="Rango de fechas, nombre o categoría">
        <div className="space-y-2">
          <Label htmlFor="pj-from">Desde</Label>
          <Input id="pj-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pj-to">Hasta</Label>
          <Input id="pj-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
        <PersonalSearchField id="pj-search" value={search} onChange={setSearch} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="flex items-end">
          <Button variant="outline" onClick={() => void reload(true)} className="w-full" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffSegmentedControl
        value={view}
        onValueChange={(v) => setView(v as typeof view)}
        options={[
          { value: 'pending', label: `Pendientes (${pending.length})` },
          { value: 'done', label: `Justificadas (${done.length})` },
        ]}
        listClassName="sm:grid-cols-2"
        aria-label="Vista"
      />

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={view === 'pending' ? 'Pendientes de justificar' : 'Justificadas'}
          description={`Motivo mínimo de ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres`}
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {listLength === 0 ? (
            <StaffEmptyState icon={CalendarCheck} title="Nada por aquí" description="No hay registros en el rango y filtros elegidos" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Justificaciones del personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead>{view === 'pending' ? 'Acción' : 'Motivo'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view === 'pending'
                      ? slice(pendingFiltered).map((item) => (
                          <TableRow key={item.key}>
                            <TableCell className="font-mono text-sm">{formatDate(item.date)}</TableCell>
                            <TableCell>
                              <p className="font-medium">{item.personal.fullName}</p>
                              <p className="text-xs text-muted-foreground">{item.personal.category}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.kind === 'tardanza' ? 'warning' : 'destructive'}>{item.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => openJustify(item)}>
                                Justificar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      : slice(doneFiltered).map(({ record, personal: p }) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-mono text-sm">{formatDate(record.date)}</TableCell>
                            <TableCell>
                              <p className="font-medium">{p.fullName}</p>
                              <p className="text-xs text-muted-foreground">{p.category}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={PERSONAL_STATUS_BADGE[record.status]}>{PERSONAL_STATUS_LABEL[record.status]}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs text-sm">{record.justificationReason ?? '—'}</TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
              {listLength > pageSize && (
                <StaffTablePagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={listLength}
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

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Justificar {target?.kind === 'tardanza' ? 'tardanza' : 'inasistencia'}</DialogTitle>
            <DialogDescription>
              {target?.personal.fullName} · {target ? formatDate(target.date) : ''} · {target?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pj-reason">Motivo</Label>
            <Textarea
              id="pj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Cita médica con constancia"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="info"
              onClick={() => void submit()}
              disabled={saving || reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Justificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Justificar un día</DialogTitle>
            <DialogDescription>
              Inasistencia con permiso (también para días futuros). Si ese día ya tiene llegada, no se puede.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select value={newPersonalId} onValueChange={setNewPersonalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir..." />
                </SelectTrigger>
                <SelectContent>
                  {personal.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pj-new-date">Fecha</Label>
              <Input id="pj-new-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button variant="info" onClick={startNew}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalJustifyAttendance;
