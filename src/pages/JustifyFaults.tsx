import { useState, useEffect, useMemo } from 'react';
import {
  useInvalidateIncidents,
  useJustifyIncidentsQuery,
  JUSTIFY_INCIDENTS_PAGE_SIZE,
} from '@/hooks/queries/useIncidentsQuery';
import { useInvalidateStudents } from '@/hooks/queries/useStudentsQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { getLimaDayRangeISO } from '@/lib/utils/limaDateTime';
import { PageHeader } from '@/components/layout/PageHeader';
import { incidentsService, authService } from '@/lib/services';
import { Incident, EducationalLevel } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { PageLoader } from '@/components/ui/page-loader';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

export const JustifyFaults = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [justificationReason, setJustificationReason] = useState('');
  const [justifying, setJustifying] = useState(false);
  const invalidateIncidents = useInvalidateIncidents();
  const invalidateStudents = useInvalidateStudents();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Activa' | 'Justificada'>('Activa');
  const [dateFilter, setDateFilter] = useState<string>('');

  const incidentFilters = useMemo(() => {
    const filters: {
      page: number;
      search?: string;
      estado?: 'Activa' | 'Justificada';
      nivelEducativo?: EducationalLevel;
      fechaDesde?: string;
      fechaHasta?: string;
    } = {
      page: currentPage,
      search: debouncedSearch.trim() || undefined,
      estado: statusFilter === 'all' ? undefined : statusFilter,
      nivelEducativo: levelFilter === 'all' ? undefined : levelFilter,
    };

    if (dateFilter) {
      const { desde, hasta } = getLimaDayRangeISO(dateFilter);
      filters.fechaDesde = desde;
      filters.fechaHasta = hasta;
    }

    return filters;
  }, [currentPage, debouncedSearch, statusFilter, levelFilter, dateFilter]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useJustifyIncidentsQuery(incidentFilters);

  const incidents = pageData?.incidents ?? [];
  const totalRecords = pageData?.total ?? 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [levelFilter, statusFilter, dateFilter, debouncedSearch]);

  useEffect(() => {
    if (isError) {
      toast.error('Error al cargar incidencias');
    }
  }, [isError]);

  const handleJustify = async () => {
    if (!selectedIncident || !justificationReason.trim()) {
      toast.error('Por favor ingrese un motivo de justificación');
      return;
    }

    if (justificationReason.trim().length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para justificar faltas');
      return;
    }

    setJustifying(true);
    try {
      const { success, error } = await incidentsService.justify(
        selectedIncident.id,
        currentUser.id,
        justificationReason.trim()
      );

      if (error || !success) {
        toast.error(error || 'Error al justificar la falta');
      } else {
        toast.success('Falta justificada exitosamente');
        setDialogOpen(false);
        setJustificationReason('');
        setSelectedIncident(null);
        invalidateIncidents();
        invalidateStudents();
        void refetch();
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentIncidents() });
      }
    } catch (error: unknown) {
      console.error('Error en handleJustify:', error);
      toast.error('Error al justificar la falta');
    } finally {
      setJustifying(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / JUSTIFY_INCIDENTS_PAGE_SIZE));
  const activeOnPage = incidents.filter((i) => i.status === 'Activa').length;
  const justifiedOnPage = incidents.filter((i) => i.status === 'Justificada').length;

  if (isLoading && !pageData) {
    return <PageLoader message="Cargando incidencias..." />;
  }

  if (isError && !pageData) {
    return (
      <div className="app-page app-page-shell">
        <PageHeader
          icon={CheckCircle2}
          eyebrow="Incidencias"
          title="Justificar Faltas"
          description="Gestione incidencias activas y registre justificaciones con motivo documentado"
          accent="success"
        />
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/70" />
          <div>
            <p className="font-semibold text-foreground">No se pudieron cargar las incidencias</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Error de conexión con el servidor. Verifique el WiFi e intente nuevamente.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={CheckCircle2}
        eyebrow="Incidencias"
        title="Justificar Faltas"
        description="Gestione incidencias activas y registre justificaciones con motivo documentado"
        accent="success"
      />

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-3">
        <StaffKpiStat label="Total filtrado" value={totalRecords} icon={FileText} tone="primary" />
        <StaffKpiStat
          label="En esta página"
          value={activeOnPage}
          hint="Activas visibles"
          hintIcon={AlertCircle}
          icon={AlertCircle}
          tone="warning"
        />
        <StaffKpiStat
          label="Justificadas"
          value={justifiedOnPage}
          hint="En esta página"
          hintIcon={CheckCircle2}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <StaffToolbar title="Filtros" description="Estado, nivel y fecha">
        <div className="space-y-2 sm:col-span-2">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ID, estudiante o falta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Nivel</Label>
          <Select value={levelFilter} onValueChange={(value: 'all' | EducationalLevel) => setLevelFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Primaria">Primaria</SelectItem>
              <SelectItem value="Secundaria">Secundaria</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={statusFilter} onValueChange={(value: 'all' | 'Activa' | 'Justificada') => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Activa">Activas</SelectItem>
              <SelectItem value="Justificada">Justificadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Incidencias (${totalRecords})`}
          description={
            statusFilter === 'Activa'
              ? 'Seleccione una fila para justificar'
              : 'Historial de incidencias justificadas'
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {isError && incidents.length === 0 ? (
            <StaffEmptyState
              icon={AlertCircle}
              title="Error al cargar incidencias"
              description="No se pudo conectar. Verifique la conexión e intente de nuevo."
              action={
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                  Reintentar
                </Button>
              }
            />
          ) : incidents.length === 0 ? (
            <StaffEmptyState
              icon={FileText}
              title="Sin resultados"
              description="Ajuste los filtros o el término de búsqueda"
            />
          ) : (
            <div className="app-table-wrap">
            <Table role="table" aria-label="Lista de incidencias para justificar">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">ID</TableHead>
                  <TableHead scope="col">Estudiante</TableHead>
                  <TableHead scope="col">Falta</TableHead>
                  <TableHead scope="col">Fecha/Hora</TableHead>
                  <TableHead scope="col">Nivel</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow
                    key={incident.id}
                    role="row"
                    aria-label={`Incidencia ${incident.id} - ${incident.student?.fullName || 'N/A'}`}
                  >
                    <TableCell className="font-mono text-sm">{incident.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{incident.student?.fullName || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          {incident.student?.level} • {incident.student?.grade} {incident.student?.section}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{incident.faultType?.name || 'N/A'}</p>
                        {incident.faultType && (
                          <SeverityBadge severity={incident.faultType.severity} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(incident.registeredAt), 'dd/MM/yyyy', { locale: es })}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(incident.registeredAt), 'HH:mm', { locale: es })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ReincidenceBadge level={incident.reincidenceLevel} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          incident.status === 'Justificada'
                            ? 'default'
                            : incident.status === 'Anulada'
                            ? 'secondary'
                            : 'outline'
                        }
                        className={
                          incident.status === 'Justificada'
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : ''
                        }
                      >
                        {incident.status === 'Justificada' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {incident.status === 'Activa' && (
                          <Dialog
                            open={dialogOpen && selectedIncident?.id === incident.id}
                            onOpenChange={(open) => {
                              setDialogOpen(open);
                              if (open) {
                                setSelectedIncident(incident);
                                setJustificationReason('');
                              } else {
                                setJustificationReason('');
                                setSelectedIncident(null);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setSelectedIncident(incident)}
                                aria-label={`Justificar falta ${incident.id}`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Justificar
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Justificar Falta</DialogTitle>
                                <DialogDescription>
                                  Ingrese el motivo de justificación para la falta del estudiante
                                </DialogDescription>
                              </DialogHeader>
                              {selectedIncident && (
                                <div className="space-y-4">
                                  <div className="bg-muted p-4 rounded-lg space-y-2">
                                    <div>
                                      <Label className="text-muted-foreground">Estudiante</Label>
                                      <p className="font-semibold">{selectedIncident.student?.fullName}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {selectedIncident.student?.level} • {selectedIncident.student?.grade} {selectedIncident.student?.section}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Falta</Label>
                                      <p className="font-semibold">{selectedIncident.faultType?.name}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Fecha</Label>
                                      <p className="font-semibold">
                                        {format(new Date(selectedIncident.registeredAt), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                                      </p>
                                    </div>
                                    {selectedIncident.observations && (
                                      <div>
                                        <Label className="text-muted-foreground">Observaciones Originales</Label>
                                        <p className="text-sm">{selectedIncident.observations}</p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="justification-reason">
                                      Motivo de Justificación <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                      id="justification-reason"
                                      placeholder="Ej: El estudiante presentó certificado médico que justifica la falta..."
                                      value={justificationReason}
                                      onChange={(e) => setJustificationReason(e.target.value)}
                                      rows={5}
                                      className="resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Mínimo 10 caracteres. Este motivo quedará registrado en el sistema.
                                    </p>
                                  </div>
                                  {selectedIncident.status === 'Justificada' && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <p className="text-sm text-green-800">
                                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                                        Esta falta ya está justificada
                                      </p>
                                      {selectedIncident.annulmentReason && (
                                        <p className="text-xs text-green-700 mt-1">
                                          Motivo: {selectedIncident.annulmentReason}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setDialogOpen(false);
                                    setJustificationReason('');
                                    setSelectedIncident(null);
                                  }}
                                  disabled={justifying}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={handleJustify}
                                  disabled={justifying || !justificationReason.trim() || justificationReason.trim().length < 10}
                                >
                                  {justifying ? 'Justificando...' : 'Confirmar Justificación'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                        {incident.status === 'Justificada' && (
                          <div className="text-xs text-muted-foreground flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" />
                            Justificada
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          {totalRecords > JUSTIFY_INCIDENTS_PAGE_SIZE && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((p) => Math.max(1, p - 1));
                    }}
                    className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                    }}
                    className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};

