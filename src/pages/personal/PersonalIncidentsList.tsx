import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Loader2, RefreshCw, XCircle } from 'lucide-react';
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
import { PersonalCategorySelect, PersonalEmployeeFilter, PersonalSearchField } from '@/components/personal/PersonalFilters';
import { type CategoryFilter } from '@/lib/utils/personalFilter';
import { authService } from '@/lib/services';
import { personalIncidentsService, type PersonalIncident } from '@/lib/services/personalIncidentsService';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import { monthStartOf } from '@/lib/utils/personalAttendanceRows';
import { formatLimaDateTime } from '@/lib/utils/personalReportStats';
import { addDataSheet, createWorkbook, runExcelExport, saveWorkbook } from '@/lib/utils/excelExport';
import type { EstadoIncidencia } from '@/types';

const STATUS_BADGE: Record<EstadoIncidencia, 'destructive' | 'info' | 'secondary' | 'warning'> = {
  Activa: 'destructive',
  Justificada: 'info',
  Anulada: 'secondary',
  'En revisión': 'warning',
};

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export const PersonalIncidentsList = () => {
  const today = getLimaTodayDate();
  const [from, setFrom] = useState(monthStartOf(today));
  const [to, setTo] = useState(today);
  const [incidents, setIncidents] = useState<PersonalIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [status, setStatus] = useState<'all' | EstadoIncidencia>('all');
  const [target, setTarget] = useState<{ incident: PersonalIncident; action: 'Justificada' | 'Anulada' } | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<PersonalIncident | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      const { incidents: rows, error } = await personalIncidentsService.list({ from, to });
      if (error) toast.error(error);
      setIncidents(rows);
      setLoading(false);
      setRefreshing(false);
    },
    [from, to],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const terms = fold(search.trim()).split(/\s+/).filter(Boolean);
    return incidents.filter((i) => {
      if (status !== 'all' && i.status !== status) return false;
      if (employeeId !== null && i.personalId !== employeeId) return false;
      if (category !== 'all' && i.personalCategory !== category) return false;
      if (terms.length === 0) return true;
      const hay = fold(`${i.personalName} ${i.personalBarcode} ${i.faultName}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [incidents, search, category, employeeId, status]);

  const employees = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string; category: string }>();
    for (const i of incidents) {
      map.set(i.personalId, { id: i.personalId, fullName: i.personalName, category: i.personalCategory ?? '' });
    }
    return [...map.values()];
  }, [incidents]);

  const stats = useMemo(
    () => ({
      total: incidents.length,
      active: incidents.filter((i) => i.status === 'Activa').length,
      serious: incidents.filter((i) => i.isSerious && i.status === 'Activa').length,
      justified: incidents.filter((i) => i.status === 'Justificada').length,
    }),
    [incidents],
  );

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: filtered.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, category, employeeId, status, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const submit = async () => {
    const user = authService.getCurrentUser();
    if (!target || !user) return;
    setSaving(true);
    const { error } = await personalIncidentsService.resolve(target.incident.id, user.id, reason, target.action);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(target.action === 'Justificada' ? 'Incidencia justificada' : 'Incidencia anulada');
    setTarget(null);
    void load(true);
  };

  const exportExcel = () =>
    runExcelExport('Excel de incidencias del personal', async () => {
      const wb = createWorkbook('Incidencias del personal');
      await addDataSheet(
        wb,
        'Incidencias',
        'Incidencias del personal',
        `Del ${from} al ${to} · ${filtered.length} registros`,
        ['Fecha y hora', 'Empleado', 'DNI', 'Categoría', 'Falta', 'Grave', 'Estado', 'Observación', 'Registró', 'Motivo (justif./anul.)'],
        filtered.map((i) => [
          formatLimaDateTime(i.registeredAt),
          i.personalName,
          i.personalBarcode,
          i.personalCategory ?? '',
          i.faultName,
          i.isSerious ? 'Sí' : 'No',
          i.status,
          i.observations ?? '',
          i.registeredByName ?? '',
          i.resolutionReason ?? '',
        ]),
      );
      await saveWorkbook(wb, `incidencias-personal-${from}-a-${to}.xlsx`);
    });

  if (loading) return <PageLoader message="Cargando incidencias del personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={FileText}
        eyebrow="Personal"
        title="Lista de Incidencias del Personal"
        description="Incidencias registradas a empleados, con justificación o anulación"
        accent="accent"
      >
        <Button variant="outline-primary" onClick={() => void exportExcel()} disabled={filtered.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Total" value={stats.total} hint="En el rango" icon={FileText} tone="info" />
        <StaffKpiStat label="Activas" value={stats.active} hint="Sin resolver" icon={AlertTriangle} tone="warning" />
        <StaffKpiStat label="Graves activas" value={stats.serious} hint="Falta grave" icon={XCircle} tone="accent" />
        <StaffKpiStat label="Justificadas" value={stats.justified} hint="Con motivo" icon={CheckCircle2} tone="success" />
      </div>

      <StaffToolbar title="Filtros" description="Rango, nombre, categoría o estado">
        <div className="space-y-2">
          <Label htmlFor="pil-from">Desde</Label>
          <Input id="pil-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || from)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pil-to">Hasta</Label>
          <Input id="pil-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || to)} />
        </div>
        <PersonalSearchField id="pil-search" value={search} onChange={setSearch} />
        <PersonalEmployeeFilter employees={employees} value={employeeId} onChange={setEmployeeId} />
        <PersonalCategorySelect value={category} onChange={setCategory} />
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Activa">Activa</SelectItem>
              <SelectItem value="Justificada">Justificada</SelectItem>
              <SelectItem value="Anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => void load(true)} className="w-full" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader title={`Incidencias (${filtered.length})`} description="Clic en una fila para ver el detalle" />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {filtered.length === 0 ? (
            <StaffEmptyState icon={FileText} title="Sin incidencias" description="No hay incidencias con esos filtros" />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Incidencias del personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Falta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((i) => (
                      <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetail(i)}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{formatLimaDateTime(i.registeredAt)}</TableCell>
                        <TableCell>
                          <p className="font-medium">{i.personalName}</p>
                          <p className="text-xs text-muted-foreground">{i.personalCategory}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{i.faultName}</span>
                          {i.isSerious && (
                            <Badge variant="destructive" className="ml-2">
                              Grave
                            </Badge>
                          )}
                          {i.automatic && (
                            <Badge variant="outline" className="ml-2">
                              Automática
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE[i.status]}>{i.status}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {i.status === 'Activa' && (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setTarget({ incident: i, action: 'Justificada' });
                                  setReason('');
                                }}
                              >
                                Justificar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTarget({ incident: i, action: 'Anulada' });
                                  setReason('');
                                }}
                              >
                                Anular
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

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{target?.action === 'Justificada' ? 'Justificar incidencia' : 'Anular incidencia'}</DialogTitle>
            <DialogDescription>
              {target?.incident.personalName} · {target?.incident.faultName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pil-reason">Motivo</Label>
            <Textarea id="pil-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant={target?.action === 'Anulada' ? 'destructive' : 'info'}
              onClick={() => void submit()}
              disabled={saving || reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de incidencia</DialogTitle>
            <DialogDescription>{detail ? formatLimaDateTime(detail.registeredAt) : ''}</DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Empleado</dt>
              <dd className="font-medium">{detail.personalName}</dd>
              <dt className="text-muted-foreground">DNI</dt>
              <dd className="font-mono">{detail.personalBarcode}</dd>
              <dt className="text-muted-foreground">Categoría</dt>
              <dd>{detail.personalCategory}</dd>
              <dt className="text-muted-foreground">Falta</dt>
              <dd>
                {detail.faultName} {detail.faultCategory ? `(${detail.faultCategory})` : ''}
              </dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                <Badge variant={STATUS_BADGE[detail.status]}>{detail.status}</Badge>
              </dd>
              <dt className="text-muted-foreground">Observación</dt>
              <dd>{detail.observations || '—'}</dd>
              <dt className="text-muted-foreground">Registró</dt>
              <dd>{detail.registeredByName ?? '—'}</dd>
              {detail.resolutionReason && (
                <>
                  <dt className="text-muted-foreground">Motivo</dt>
                  <dd>{detail.resolutionReason}</dd>
                </>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalIncidentsList;
