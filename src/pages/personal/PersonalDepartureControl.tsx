import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Loader2, LogOut, RefreshCw } from 'lucide-react';
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
import { PersonalCategorySelect, PersonalSearchField } from '@/components/personal/PersonalFilters';
import { matchesPersonalFilter, type CategoryFilter } from '@/lib/utils/personalFilter';
import { authService } from '@/lib/services';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { usePersonalAttendance } from '@/hooks/usePersonalAttendance';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { buildPersonalDayRows, type PersonalDayRow } from '@/lib/utils/personalAttendanceRows';

type DepartureFilter = 'all' | 'pending' | 'done' | 'early';

export const PersonalDepartureControl = () => {
  const now = getLimaNow();
  const [date, setDate] = useState(now.date);
  const { personal, records, loading, refreshing, reload } = usePersonalAttendance(date, date);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [filter, setFilter] = useState<DepartureFilter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Solo quienes llegaron ese día pueden registrar salida.
  const rows = useMemo(
    () =>
      buildPersonalDayRows(personal, records, date, now.date, now.time).filter((r) => r.record?.arrivalTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personal, records, date],
  );

  const filtered = rows.filter((r) => {
    if (!matchesPersonalFilter(r.personal, search, category)) return false;
    if (filter === 'pending') return !r.record?.departureTime;
    if (filter === 'done') return Boolean(r.record?.departureTime);
    if (filter === 'early') return r.record?.departureType === 'Anticipada';
    return true;
  });

  const stats = useMemo(
    () => ({
      present: rows.length,
      out: rows.filter((r) => r.record?.departureTime).length,
      pending: rows.filter((r) => !r.record?.departureTime).length,
      early: rows.filter((r) => r.record?.departureType === 'Anticipada').length,
    }),
    [rows],
  );

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: filtered.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, filter, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const isToday = date === now.date;

  const registerDeparture = async (row: PersonalDayRow, authorized: boolean) => {
    setBusyId(row.personal.id);
    const result = await personalAttendanceService.registerDeparture(
      row.personal,
      authService.getCurrentUser()?.id,
      isToday ? undefined : { date, time: row.record?.expectedExit ?? now.time },
      authorized ? 'Autorizada' : undefined,
    );
    setBusyId(null);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${row.personal.fullName}: salida ${result.record.departureTime} (${result.record.departureType})`);
    void reload(true);
  };

  if (loading) return <PageLoader message="Cargando salidas del personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={LogOut}
        eyebrow="Personal"
        title="Control de Salida del Personal"
        description="Salida de cada empleado frente a su hora de salida del día"
        accent="info"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Llegaron" value={stats.present} hint="Con llegada ese día" icon={Clock} tone="info" />
        <StaffKpiStat label="Ya salieron" value={stats.out} hint="Salida registrada" icon={CheckCircle2} tone="success" />
        <StaffKpiStat label="Sin salida" value={stats.pending} hint="Aún sin marcar salida" icon={LogOut} tone="secondary" />
        <StaffKpiStat label="Anticipadas" value={stats.early} hint="Antes de su hora de salida" icon={AlertTriangle} tone="warning" />
      </div>

      <StaffToolbar title="Filtros" description="Fecha, nombre, categoría o estado de salida">
        <div className="space-y-2">
          <Label htmlFor="pd-date">Fecha</Label>
          <Input id="pd-date" type="date" value={date} max={now.date} onChange={(e) => setDate(e.target.value || now.date)} />
        </div>
        <PersonalSearchField id="pd-search" value={search} onChange={setSearch} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="space-y-2">
          <Label>Salida</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as DepartureFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Sin salida</SelectItem>
              <SelectItem value="done">Con salida</SelectItem>
              <SelectItem value="early">Anticipadas</SelectItem>
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
          description="Salida anticipada = antes de su hora de salida. Use Autorizada si tuvo permiso."
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
                        <TableCell className="font-mono text-sm">{row.record?.expectedExit ?? '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{row.record?.departureTime ?? '—'}</TableCell>
                        <TableCell>
                          {row.record?.departureType ? (
                            <Badge variant={row.record.departureType === 'Anticipada' ? 'warning' : 'success'}>
                              {row.record.departureType}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!row.record?.departureTime && (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void registerDeparture(row, false)}
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
                                onClick={() => void registerDeparture(row, true)}
                                disabled={busyId === row.personal.id}
                                title="Salida con permiso (no cuenta como anticipada)"
                              >
                                Autorizada
                              </Button>
                            </div>
                          )}
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

export default PersonalDepartureControl;
