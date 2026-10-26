import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Loader2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
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
  StaffTablePagination,
  StaffToolbar,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { PersonalCategorySelect, PersonalEmployeeFilter, PersonalSearchField } from '@/components/personal/PersonalFilters';
import { matchesPersonalFilter, type CategoryFilter } from '@/lib/utils/personalFilter';
import { authService } from '@/lib/services';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { usePersonalAttendance } from '@/hooks/usePersonalAttendance';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import {
  DEPARTURE_STATUS_BADGE,
  DEPARTURE_STATUS_LABEL,
  buildPersonalDayRows,
  resolveDepartureStatus,
  type PersonalDayRow,
  type PersonalDepartureStatus,
} from '@/lib/utils/personalAttendanceRows';

type DepartureFilter = 'all' | PersonalDepartureStatus;

interface DepartureRow extends PersonalDayRow {
  /** Hora de salida del horario vigente (o la guardada al salir). */
  expectedExit: string | null;
  departure: PersonalDepartureStatus;
}

/** Diálogo: salida con permiso (al registrar) o autorizar una anticipada ya registrada. */
type PermissionTarget = { row: DepartureRow; mode: 'register' | 'authorize' };

export const PersonalDepartureControl = () => {
  const now = getLimaNow();
  const [date, setDate] = useState(now.date);
  const { personal, records, loading, refreshing, reload } = usePersonalAttendance(date, date);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [filter, setFilter] = useState<DepartureFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [target, setTarget] = useState<PermissionTarget | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Solo quienes llegaron dentro de su jornada (una llegada después de su salida es inasistencia).
  const rows = useMemo<DepartureRow[]>(
    () =>
      buildPersonalDayRows(personal, records, date, now.date, now.time)
        .filter((r) => r.record?.arrivalTime && r.record.status !== 'Falta')
        .map((r) => {
          const expectedExit = r.record?.departureTime ? r.record.expectedExit : r.horario?.exit ?? r.record?.expectedExit ?? null;
          return {
            ...r,
            expectedExit,
            departure: resolveDepartureStatus(r.record!, expectedExit, now.date, now.time),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personal, records, date],
  );

  const filtered = rows.filter(
    (r) => matchesPersonalFilter(r.personal, search, category, employeeId) && (filter === 'all' || r.departure === filter),
  );

  const stats = useMemo(
    () => ({
      present: rows.length,
      out: rows.filter((r) => r.record?.departureTime).length,
      unauthorized: rows.filter((r) => r.departure === 'Anticipada').length,
      authorized: rows.filter((r) => r.departure === 'Autorizada').length,
      missing: rows.filter((r) => r.departure === 'No marcó salida').length,
    }),
    [rows],
  );

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: filtered.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, employeeId, filter, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const isToday = date === now.date;

  const registerDeparture = async (row: DepartureRow, permission?: { reason: string }) => {
    setBusyId(row.personal.id);
    const result = await personalAttendanceService.registerDeparture(
      row.personal,
      authService.getCurrentUser()?.id,
      isToday ? undefined : { date, time: row.expectedExit ?? now.time },
      permission,
    );
    setBusyId(null);
    if ('error' in result) {
      toast.error(result.error);
      return false;
    }
    const tipo = DEPARTURE_STATUS_LABEL[result.record.departureType ?? 'Normal'];
    toast.success(`${row.personal.fullName}: salida ${result.record.departureTime} (${tipo})`);
    if (permission && result.record.departureType === 'Normal') {
      toast.info('Salió a su hora o después: queda como salida normal (no hace falta permiso).');
    }
    void reload(true);
    return true;
  };

  const submitPermission = async () => {
    if (!target) return;
    setSaving(true);
    let ok = false;
    if (target.mode === 'register') {
      ok = await registerDeparture(target.row, { reason });
    } else {
      const user = authService.getCurrentUser();
      const res = user && target.row.record
        ? await personalAttendanceService.authorizeEarlyDeparture(target.row.record.id, user.id, reason)
        : { success: false, error: 'Sesión expirada' };
      if (res.error) toast.error(res.error);
      else {
        toast.success('Salida anticipada autorizada');
        void reload(true);
      }
      ok = res.success;
    }
    setSaving(false);
    if (ok) setTarget(null);
  };

  if (loading) return <PageLoader message="Cargando salidas del personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={LogOut}
        eyebrow="Personal"
        title="Control de Salida del Personal"
        description="Salida de cada empleado frente a la hora de salida de su horario"
        accent="info"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Llegaron" value={stats.present} hint={`${stats.out} ya salieron`} icon={Clock} tone="info" />
        <StaffKpiStat label="Anticipadas sin autorización" value={stats.unauthorized} hint="Salieron antes sin permiso" icon={AlertTriangle} tone="accent" />
        <StaffKpiStat label="Anticipadas autorizadas" value={stats.authorized} hint="Con permiso y motivo" icon={ShieldCheck} tone="success" />
        <StaffKpiStat label="No marcaron salida" value={stats.missing} hint="Pasó su hora y no marcaron" icon={CheckCircle2} tone="warning" />
      </div>

      <StaffToolbar title="Filtros" description="Fecha, nombre, categoría o tipo de salida">
        <div className="space-y-2">
          <Label htmlFor="pd-date">Fecha</Label>
          <Input id="pd-date" type="date" value={date} max={now.date} onChange={(e) => setDate(e.target.value || now.date)} />
        </div>
        <PersonalSearchField id="pd-search" value={search} onChange={setSearch} />
        <PersonalEmployeeFilter employees={personal} value={employeeId} onChange={setEmployeeId} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="space-y-2">
          <Label>Salida</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as DepartureFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {(Object.keys(DEPARTURE_STATUS_LABEL) as PersonalDepartureStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {DEPARTURE_STATUS_LABEL[k]}
                </SelectItem>
              ))}
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
        <StaffDataPanelHeader
          title={`Salidas (${filtered.length})`}
          description="Antes de su hora de salida = anticipada sin autorización, salvo que se registre o autorice con permiso y motivo."
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {filtered.length === 0 ? (
            <StaffEmptyState icon={LogOut} title="Sin registros" description="Nadie con llegada ese día coincide con los filtros" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Salidas del personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Llegó</TableHead>
                      <TableHead>Hora de salida</TableHead>
                      <TableHead>Salió</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <TableRow key={row.personal.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <StudentPhoto src={row.personal.profilePhoto} name={row.personal.fullName} className="h-9 w-9 shrink-0" />
                            <div>
                              <p className="font-medium">{row.personal.fullName}</p>
                              <p className="text-xs text-muted-foreground">{row.personal.category}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.record?.arrivalTime}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.expectedExit ?? <span className="text-xs text-warning">Sin hora de salida</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.record?.departureTime ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={DEPARTURE_STATUS_BADGE[row.departure]} title={row.record?.departureReason ?? undefined}>
                            {DEPARTURE_STATUS_LABEL[row.departure]}
                          </Badge>
                          {row.record?.departureReason && (
                            <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">{row.record.departureReason}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {!row.record?.departureTime ? (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void registerDeparture(row)}
                                disabled={busyId === row.personal.id}
                              >
                                {busyId === row.personal.id ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                  <LogOut className="mr-1 h-4 w-4" />
                                )}
                                Salida
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTarget({ row, mode: 'register' });
                                  setReason('');
                                }}
                                disabled={busyId === row.personal.id}
                                title="Salida antes de su hora con permiso (pide motivo)"
                              >
                                Con permiso
                              </Button>
                            </div>
                          ) : row.departure === 'Anticipada' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setTarget({ row, mode: 'authorize' });
                                setReason('');
                              }}
                            >
                              <ShieldCheck className="mr-1 h-4 w-4" />
                              Autorizar
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > pageSize && (
                <StaffTablePagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filtered.length}
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
            <DialogTitle>
              {target?.mode === 'authorize' ? 'Autorizar salida anticipada' : 'Salida con permiso'}
            </DialogTitle>
            <DialogDescription>
              {target?.row.personal.fullName} · hora de salida {target?.row.expectedExit ?? 'sin definir'}
              {target?.mode === 'authorize' ? ` · salió ${target.row.record?.departureTime}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pd-reason">Motivo del permiso</Label>
            <Textarea
              id="pd-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Cita médica autorizada por dirección"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="info"
              onClick={() => void submitPermission()}
              disabled={saving || reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {target?.mode === 'authorize' ? 'Autorizar' : 'Registrar salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalDepartureControl;
