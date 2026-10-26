import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Loader2, LogIn, Lock, RefreshCw, UserX } from 'lucide-react';
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
import {
  PERSONAL_STATUS_BADGE,
  PERSONAL_STATUS_LABEL,
  buildPersonalDayRows,
  type PersonalDayRow,
  type PersonalDayStatus,
} from '@/lib/utils/personalAttendanceRows';

const STATUS_OPTIONS: PersonalDayStatus[] = [
  'A tiempo',
  'Tarde',
  'Sin llegada',
  'Pendiente',
  'Fuera de horario',
  'Falta',
  'Tarde justificada',
  'Falta justificada',
  'No le toca',
];

export const PersonalArrivalControl = () => {
  const now = getLimaNow();
  const [date, setDate] = useState(now.date);
  const { personal, records, absenceAfterMin, loading, refreshing, reload } = usePersonalAttendance(date, date);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PersonalDayStatus>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const rows = useMemo(
    () => buildPersonalDayRows(personal, records, date, now.date, now.time, absenceAfterMin),
    // now cambia cada render; basta con recalcular al cambiar datos o fecha
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personal, records, date, absenceAfterMin],
  );

  const filtered = rows.filter(
    (r) =>
      matchesPersonalFilter(r.personal, search, category, employeeId) &&
      (statusFilter === 'all' || r.status === statusFilter),
  );

  const stats = useMemo(() => {
    const expected = rows.filter((r) => r.horario);
    return {
      expected: expected.length,
      onTime: rows.filter((r) => r.status === 'A tiempo').length,
      late: rows.filter((r) => r.status === 'Tarde' || r.status === 'Tarde justificada').length,
      pending: rows.filter((r) => r.status === 'Sin llegada').length,
      missing: rows.filter((r) => r.status === 'Falta').length,
    };
  }, [rows]);

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: filtered.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, employeeId, statusFilter, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const isToday = date === now.date;

  const registerNow = async (row: PersonalDayRow) => {
    setBusyId(row.personal.id);
    const result = await personalAttendanceService.registerArrival(
      row.personal,
      authService.getCurrentUser()?.id,
      isToday ? undefined : { date, time: row.horario?.entry ?? now.time },
    );
    setBusyId(null);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${row.personal.fullName}: ${PERSONAL_STATUS_LABEL[result.record.status]} (${result.record.arrivalTime})`);
    void reload(true);
  };

  if (loading) return <PageLoader message="Cargando llegadas del personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Clock}
        eyebrow="Personal"
        title="Control de Llegadas del Personal"
        description="Llegada de cada empleado frente a su hora de entrada del día"
        accent="info"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Deben asistir" value={stats.expected} hint="Tienen horario ese día" icon={Clock} tone="info" />
        <StaffKpiStat label="A tiempo" value={stats.onTime} hint="Hasta su hora de entrada" icon={CheckCircle2} tone="success" />
        <StaffKpiStat label="Tarde" value={stats.late} hint="Desde el minuto siguiente" icon={AlertTriangle} tone="warning" />
        <StaffKpiStat
          label="Inasistencias"
          value={stats.missing}
          hint={`${stats.pending} aún sin marcar · inasistencia a los ${absenceAfterMin} min`}
          icon={UserX}
          tone="accent"
        />
      </div>

      <StaffToolbar title="Filtros" description="Fecha, nombre, categoría o estado">
        <div className="space-y-2">
          <Label htmlFor="pa-date">Fecha</Label>
          <Input id="pa-date" type="date" value={date} max={now.date} onChange={(e) => setDate(e.target.value || now.date)} />
        </div>
        <PersonalSearchField id="pa-search" value={search} onChange={setSearch} />
        <PersonalEmployeeFilter employees={personal} value={employeeId} onChange={setEmployeeId} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {PERSONAL_STATUS_LABEL[s]}
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
          title={`Personal (${filtered.length})`}
          description="El tutor registra con el escáner. Una llegada registrada no se puede modificar."
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {filtered.length === 0 ? (
            <StaffEmptyState icon={Clock} title="Sin resultados" description="Cambie la fecha o los filtros" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Llegadas del personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Hora de entrada</TableHead>
                      <TableHead>Llegó</TableHead>
                      <TableHead>Estado</TableHead>
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
                              <p className="font-mono text-xs text-muted-foreground">{row.personal.barcode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{row.personal.category}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.record?.expectedEntry ?? row.horario?.entry ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.record?.arrivalTime ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={PERSONAL_STATUS_BADGE[row.status]}>{PERSONAL_STATUS_LABEL[row.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {row.record?.arrivalTime ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                              title="La hora de llegada del personal no se puede modificar"
                            >
                              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                              Registrada
                            </span>
                          ) : row.status !== 'Falta justificada' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void registerNow(row)}
                              disabled={busyId === row.personal.id}
                              title={isToday ? 'Registrar llegada ahora' : 'Registrar llegada con su hora de entrada'}
                            >
                              {busyId === row.personal.id ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <LogIn className="mr-1 h-4 w-4" />
                              )}
                              Registrar
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

    </div>
  );
};

export default PersonalArrivalControl;
