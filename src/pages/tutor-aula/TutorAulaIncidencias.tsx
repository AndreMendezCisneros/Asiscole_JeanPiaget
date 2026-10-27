import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Camera, ChevronLeft, ChevronRight, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StaffDataPanel, StaffDataPanelHeader, StaffEmptyState } from '@/components/staff';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { PageLoader } from '@/components/ui/page-loader';
import { tutorAulaService } from '@/lib/services/tutorAulaService';
import { getLimaMonthBounds, getLimaTodayDate } from '@/lib/utils/limaDateTime';
import type { TutorIncident } from '@/types/tutorAula';

const PAGE_SIZE = 25;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "d MMM yyyy · HH:mm", { locale: es });
}

/** Incidencias del salón, solo lectura (sin datos de apoderados). */
export function TutorAulaIncidencias() {
  const today = getLimaTodayDate();
  const month = getLimaMonthBounds(today);
  const [from, setFrom] = useState(month.start);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<TutorIncident | null>(null);

  useEffect(() => setPage(1), [from, to]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['tutor-aula', 'incidencias', from, to, page],
    queryFn: async () => {
      const res = await tutorAulaService.getIncidents({ from, to, page, pageSize: PAGE_SIZE });
      if (res.error) throw new Error(res.error);
      return res;
    },
    staleTime: 60 * 1000,
    enabled: Boolean(from && to && from <= to),
  });

  const evidences = useQuery({
    queryKey: ['tutor-aula', 'evidencias', detail?.id],
    queryFn: async () => {
      const res = await tutorAulaService.getEvidences(detail!.id);
      if (res.error) throw new Error(res.error);
      return res.evidences;
    },
    enabled: Boolean(detail && detail.photoCount > 0),
    staleTime: 30 * 60 * 1000,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const incidents = data?.incidents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tutor-inc-desde">Desde</Label>
          <Input id="tutor-inc-desde" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tutor-inc-hasta">Hasta</Label>
          <Input id="tutor-inc-hasta" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Incidencias (${total})`}
          description={totalPages > 1 ? `Página ${page} de ${totalPages} · Solo lectura` : 'Toque una incidencia para ver el detalle'}
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0" aria-live="polite">
          {isLoading ? (
            <PageLoader message="Cargando incidencias..." />
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'No se pudo cargar'}
            </p>
          ) : incidents.length === 0 ? (
            <StaffEmptyState icon={ClipboardList} title="Sin incidencias" description="No hay incidencias en esas fechas" />
          ) : (
            <ul className="divide-y divide-border/70">
              {incidents.map((inc) => (
                <li key={inc.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(inc)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <StudentPhoto src={inc.studentPhoto} name={inc.studentName} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{inc.studentName}</p>
                      <p className="truncate text-sm">{inc.faultName}</p>
                      <p className="text-xs text-muted-foreground">{formatWhen(inc.registeredAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {inc.faultSerious && <Badge variant="destructive">Grave</Badge>}
                      {inc.photoCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                          {inc.photoCount}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || isFetching}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Anterior</span>
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || isFetching}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Siguiente</span>
              </Button>
            </div>
          )}
        </div>
      </StaffDataPanel>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.faultName}</DialogTitle>
                <DialogDescription>
                  {detail.studentName} · {formatWhen(detail.registeredAt)}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
                {detail.faultCategory && (
                  <>
                    <dt className="text-muted-foreground">Categoría</dt>
                    <dd>{detail.faultCategory}</dd>
                  </>
                )}
                {detail.reincidenceLevel != null && (
                  <>
                    <dt className="text-muted-foreground">Nivel</dt>
                    <dd>{detail.reincidenceLevel}</dd>
                  </>
                )}
                {detail.status && (
                  <>
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd>{detail.status}</dd>
                  </>
                )}
                {detail.registeredBy && (
                  <>
                    <dt className="text-muted-foreground">Registró</dt>
                    <dd>{detail.registeredBy}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Observaciones</dt>
                <dd className="whitespace-pre-wrap">{detail.observations?.trim() || '—'}</dd>
              </dl>
              {detail.photoCount > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Evidencias</p>
                  {evidences.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Cargando evidencias" />
                  ) : evidences.error ? (
                    <p className="text-sm text-destructive">
                      {evidences.error instanceof Error ? evidences.error.message : 'No se pudieron cargar'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {(evidences.data ?? []).map((ev) => (
                        <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={ev.url}
                            alt={ev.filename ?? 'Evidencia'}
                            loading="lazy"
                            className="aspect-square w-full rounded-md border object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
