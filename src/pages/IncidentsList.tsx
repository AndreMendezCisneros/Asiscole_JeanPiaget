import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Eye, Edit, Printer, Camera, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/PageHeader';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Incident, EducationalLevel, IncidentEvidence } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useIncidentsQuery,
  useIncidentsSummaryQuery,
  useInvalidateIncidents,
  INCIDENTS_PAGE_SIZE,
} from '@/hooks/queries/useIncidentsQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { incidentsService, evidenceService, authService } from '@/lib/services';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = INCIDENTS_PAGE_SIZE;

export const IncidentsList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [currentPage, setCurrentPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [exporting, setExporting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState<Incident | null>(null);
  const [detailEvidences, setDetailEvidences] = useState<IncidentEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [justifyOpen, setJustifyOpen] = useState(false);
  const [justifyIncident, setJustifyIncident] = useState<Incident | null>(null);
  const [justificationReason, setJustificationReason] = useState('');
  const [justifying, setJustifying] = useState(false);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const invalidateIncidents = useInvalidateIncidents();

  const incidentFilters = useMemo(
    () => ({
      nivelEducativo: levelFilter === 'all' ? undefined : levelFilter,
      search: debouncedSearch.trim() || undefined,
      page: currentPage,
    }),
    [levelFilter, debouncedSearch, currentPage],
  );

  const summaryFilters = useMemo(
    () => ({
      nivelEducativo: levelFilter === 'all' ? undefined : levelFilter,
      search: debouncedSearch.trim() || undefined,
    }),
    [levelFilter, debouncedSearch],
  );

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useIncidentsQuery(incidentFilters);

  const { data: summary } = useIncidentsSummaryQuery(summaryFilters);

  const incidents = pageData?.incidents ?? [];
  const totalRecords = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // Después de 12 s de carga ininterrumpida sin datos, mostramos un mensaje de
  // "tardando más de lo esperado" para que el usuario sepa que el servidor está
  // inicializando (cold-start de Supabase) en lugar de ver un spinner mudo.
  const [loadingSlow, setLoadingSlow] = useState(false);
  useEffect(() => {
    if (!isLoading || incidents.length > 0) {
      setLoadingSlow(false);
      return;
    }
    const id = setTimeout(() => setLoadingSlow(true), 12_000);
    return () => clearTimeout(id);
  }, [isLoading, incidents.length]);

  useEffect(() => {
    if (isError) {
      toast.error('Error al cargar incidencias');
    }
  }, [isError]);

  useEffect(() => {
    if (!detailOpen || !detailIncident) {
      setDetailEvidences([]);
      return;
    }

    let cancelled = false;
    setEvidenceLoading(true);

    void evidenceService.getByIncident(detailIncident.id).then(({ evidences, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error('No se pudieron cargar las fotos de evidencia');
      }
      setDetailEvidences(evidences);
      setEvidenceLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [detailOpen, detailIncident]);

  const openDetail = (incident: Incident) => {
    setDetailIncident(incident);
    setDetailOpen(true);
  };

  const openJustify = (incident: Incident) => {
    setJustifyIncident(incident);
    setJustificationReason('');
    setJustifyOpen(true);
  };

  const handlePrintPdf = async (incident: Incident) => {
    setPrintingId(incident.id);
    try {
      toast.loading('Generando PDF con evidencias…', { id: 'incident-pdf' });

      let evidences: IncidentEvidence[] =
        detailIncident?.id === incident.id && !evidenceLoading ? detailEvidences : [];

      if (detailIncident?.id !== incident.id || evidenceLoading) {
        const result = await evidenceService.getByIncident(incident.id);
        if (result.error) {
          toast.warning('Algunas fotos podrían no incluirse en el PDF', { id: 'incident-pdf' });
        }
        evidences = result.evidences;
      }

      const { exportIncidentReportPdf } = await import('@/lib/utils/exportIncidentReportPdf');
      await exportIncidentReportPdf(incident, evidences);
      await incidentsService.registerPrint(incident.id);
      toast.success('PDF descargado correctamente', { id: 'incident-pdf' });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el PDF', { id: 'incident-pdf' });
    } finally {
      setPrintingId(null);
    }
  };

  const handleJustify = async () => {
    const user = authService.getCurrentUser();
    if (!user || !justifyIncident) return;

    setJustifying(true);
    const { success, error } = await incidentsService.justify(
      justifyIncident.id,
      user.id,
      justificationReason.trim(),
    );
    setJustifying(false);

    if (!success) {
      toast.error(error || 'No se pudo justificar la incidencia');
      return;
    }

    toast.success('Incidencia justificada');
    setJustifyOpen(false);
    setJustifyIncident(null);
    invalidateIncidents();
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, levelFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleExportExcel = async () => {
    setExporting(true);
    toast.loading('Preparando exportación…', { id: 'incidents-export' });
    try {
      const { incidents: allRows, error } = await incidentsService.getAll({
        nivelEducativo: levelFilter === 'all' ? undefined : levelFilter,
        search: debouncedSearch.trim() || undefined,
        fetchAll: true,
      });
      if (error) {
        toast.error('No se pudo exportar', { id: 'incidents-export' });
        return;
      }
      const parts: string[] = [];
      if (levelFilter !== 'all') parts.push(`Nivel: ${levelFilter}`);
      if (debouncedSearch.trim()) parts.push(`Búsqueda: "${debouncedSearch.trim()}"`);
      const { exportIncidentsListExcel } = await import('@/lib/utils/excelListExports');
      await exportIncidentsListExcel(allRows, parts.length ? parts.join(' · ') : undefined);
      toast.success('Excel descargado', { id: 'incidents-export' });
    } catch {
      toast.error('No se pudo exportar', { id: 'incidents-export' });
    } finally {
      setExporting(false);
    }
  };

  const activeCount = summary?.activas;
  const withEvidence = summary?.conEvidencia;
  const listTotal = summary?.total ?? (pageData ? totalRecords : undefined);
  const tableLoading = isLoading && !pageData;

  return (
    <div className="app-page app-page-shell relative overflow-hidden">
      {/* Decoraciones de fondo */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div>
        <PageHeader
          icon={FileText}
          eyebrow="Incidencias"
          title="Lista de Incidencias"
          description="Historial completo con filtros por nivel y exportación a Excel"
          accent="warning"
        >
          <Badge variant="outline" className="hidden sm:inline-flex gap-1 border-accent/40 bg-accent/5 text-accent">
            <Sparkles className="w-3 h-3" />
            Vista mejorada
          </Badge>
          <Button
            variant="outline-primary"
            onClick={() => void handleExportExcel()}
            disabled={exporting || !listTotal}
            className="transition-transform hover:scale-[1.03]"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Exportar Excel
          </Button>
        </PageHeader>
      </div>

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-3">
        <StaffKpiStat
          label="En listado"
          value={listTotal ?? '…'}
          hint={tableLoading ? 'Actualizando…' : `${PAGE_SIZE} por página`}
          icon={FileText}
          tone="primary"
        />
        <StaffKpiStat
          label="Activas"
          value={activeCount ?? '…'}
          hint="Pendientes de gestión"
          hintIcon={AlertCircle}
          icon={AlertCircle}
          tone="warning"
        />
        <StaffKpiStat
          label="Con evidencia"
          value={withEvidence ?? '…'}
          hint="Registros documentados"
          hintIcon={CheckCircle2}
          icon={Camera}
          tone="success"
        />
      </div>

      <div className="space-y-6">
        <StaffToolbar title="Buscar y filtrar" description="Refine por texto o nivel educativo">
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="incidents-search">Buscar</Label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="incidents-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID, nombre del estudiante o tipo de falta..."
                className="min-w-[12rem] pl-10 transition-all focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nivel educativo</Label>
            <Select
              value={levelFilter}
              onValueChange={(value) => setLevelFilter(value as 'all' | EducationalLevel)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nivel educativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                <SelectItem value="Primaria">Primaria</SelectItem>
                <SelectItem value="Secundaria">Secundaria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </StaffToolbar>

        <StaffDataPanel className={cn('overflow-hidden border-l-[3px] border-l-primary/40', tableLoading && 'opacity-70')}>
          <StaffDataPanelHeader
            title={`Registros (${listTotal ?? '…'})`}
            description={
              listTotal > PAGE_SIZE
                ? `Página ${currentPage} de ${totalPages} · ${PAGE_SIZE} por página`
                : 'Detalle, evidencia y estado de cada incidencia'
            }
          />
          <div className="p-4 pt-0 sm:p-5 sm:pt-0">
            {tableLoading && incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {loadingSlow ? (
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">El servidor está inicializando…</p>
                    <p className="text-xs">Esto puede tardar hasta 30 s en la primera carga del día.</p>
                  </div>
                ) : (
                  <span>Cargando incidencias…</span>
                )}
              </div>
            ) : isError && incidents.length === 0 ? (
              <StaffEmptyState
                icon={AlertCircle}
                title="Error al cargar incidencias"
                description="No se pudo conectar con el servidor. Verifique la conexión e intente de nuevo."
                action={
                  <Button size="sm" variant="outline" onClick={() => void refetch()}>
                    Reintentar
                  </Button>
                }
              />
            ) : incidents.length === 0 ? (
              <StaffEmptyState
                icon={FileText}
                title="No hay incidencias"
                description="Prueba otro término de búsqueda o cambia el filtro de nivel"
              />
            ) : (
              <div className="app-table-wrap">
                <Table role="table" aria-label="Lista de incidencias">
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
                      <TableHead scope="col">ID</TableHead>
                      <TableHead scope="col">Estudiante</TableHead>
                      <TableHead scope="col">Falta</TableHead>
                      <TableHead scope="col">Fecha/Hora</TableHead>
                      <TableHead scope="col">Nivel</TableHead>
                      <TableHead scope="col">Evidencia</TableHead>
                      <TableHead scope="col">Estado</TableHead>
                      <TableHead scope="col">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident, idx) => (
                      <TableRow 
                        key={incident.id}
                        role="row"
                        aria-label={`Incidencia ${incident.id} - ${incident.student?.fullName || 'N/A'}`}
                        className="animate-fade-in transition-colors hover:bg-primary/5"
                        style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}
                      >
                      <TableCell className="font-mono text-sm">{incident.id}</TableCell>
                      <TableCell className="max-w-[14rem]">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{incident.student?.fullName || 'N/A'}</p>
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
                        {incident.hasEvidence ? (
                          <Badge variant="secondary" className="gap-1">
                            <Camera className="w-3 h-3" />
                            {incident.evidenceCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Sin evidencia</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={incident.status === 'Activa' ? 'default' : 'secondary'}>
                          {incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-primary/10 hover:text-primary"
                            onClick={() => openDetail(incident)}
                            aria-label={`Ver incidencia ${incident.id}`}
                            title="Ver detalle y fotos"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-info/10 hover:text-info disabled:opacity-40"
                            onClick={() => openJustify(incident)}
                            disabled={incident.status !== 'Activa'}
                            aria-label={`Justificar incidencia ${incident.id}`}
                            title={
                              incident.status === 'Activa'
                                ? 'Justificar incidencia'
                                : 'Solo incidencias activas'
                            }
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-primary/10 hover:text-primary"
                            onClick={() => void handlePrintPdf(incident)}
                            disabled={printingId === incident.id}
                            aria-label={`Imprimir PDF incidencia ${incident.id}`}
                            title="Descargar PDF con evidencias"
                          >
                            {printingId === incident.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {listTotal > PAGE_SIZE && (
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                    )
                    .map((page, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev != null && page - prev > 1;
                      return (
                        <span key={page} className="contents">
                          {showEllipsis && (
                            <PaginationItem>
                              <span className="px-2 text-muted-foreground">…</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </span>
                      );
                    })}
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

      {/* Detalle + evidencias fotográficas */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de incidencia</DialogTitle>
            <DialogDescription>
              Información completa y fotos de evidencia adjuntas
            </DialogDescription>
          </DialogHeader>
          {detailIncident && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID</p>
                  <p className="font-mono font-semibold">{detailIncident.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant={detailIncident.status === 'Activa' ? 'default' : 'secondary'}>
                    {detailIncident.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Estudiante</p>
                <Card className="border-l-[3px] border-l-primary/50">
                  <CardContent className="pt-4">
                    <p className="font-semibold text-lg">{detailIncident.student?.fullName || 'N/A'}</p>
                    <p className="text-muted-foreground text-sm">
                      {detailIncident.student?.level} • {detailIncident.student?.grade}{' '}
                      {detailIncident.student?.section} • Código: {detailIncident.student?.barcode}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Tipo de falta</p>
                <Card className="border-l-[3px] border-l-warning/50">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{detailIncident.faultType?.name || 'N/A'}</p>
                      {detailIncident.faultType && (
                        <SeverityBadge severity={detailIncident.faultType.severity} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {detailIncident.faultType?.description || 'Sin descripción'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Nivel de reincidencia</p>
                <ReincidenceBadge level={detailIncident.reincidenceLevel} className="px-4 py-2" />
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Observaciones</p>
                <Card className="border-l-[3px] border-l-accent/50">
                  <CardContent className="pt-4">
                    <p>{detailIncident.observations || 'Sin observaciones'}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Evidencia fotográfica
                  {detailIncident.hasEvidence && (
                    <Badge variant="secondary">{detailIncident.evidenceCount} foto(s)</Badge>
                  )}
                </p>
                {evidenceLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando fotos…
                  </div>
                ) : detailEvidences.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Sin fotos adjuntas</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detailEvidences.map((ev) => (
                      <a
                        key={ev.id}
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary/40 transition-shadow"
                      >
                        <img
                          src={ev.url}
                          alt={ev.filename}
                          className="w-full h-32 object-cover bg-muted"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm space-y-1">
                <p>
                  Registrado por:{' '}
                  <span className="font-semibold">
                    {detailIncident.registeredByUser?.fullName || 'N/A'}
                  </span>
                </p>
                <p>
                  Fecha:{' '}
                  <span className="font-semibold">
                    {format(
                      new Date(detailIncident.registeredAt),
                      "dd 'de' MMMM 'de' yyyy 'a las' HH:mm",
                      { locale: es },
                    )}
                  </span>
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  onClick={() => void handlePrintPdf(detailIncident)}
                  disabled={printingId === detailIncident.id}
                >
                  {printingId === detailIncident.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generando PDF…
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir PDF
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Justificar */}
      <Dialog open={justifyOpen} onOpenChange={setJustifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Justificar incidencia</DialogTitle>
            <DialogDescription>
              La incidencia pasará a estado Justificada. Mínimo 10 caracteres.
            </DialogDescription>
          </DialogHeader>
          {justifyIncident && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p className="font-semibold">{justifyIncident.student?.fullName}</p>
                <p className="text-muted-foreground">{justifyIncident.faultType?.name}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="justify-reason-list">Motivo de justificación</Label>
                <Textarea
                  id="justify-reason-list"
                  value={justificationReason}
                  onChange={(e) => setJustificationReason(e.target.value)}
                  rows={4}
                  placeholder="Ej.: certificado médico presentado por el apoderado…"
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustifyOpen(false)} disabled={justifying}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleJustify()}
              disabled={justifying || justificationReason.trim().length < 10}
            >
              {justifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Justificar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};