import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  GraduationCap,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Download,
  FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  StaffDataPanel,
  StaffDataPanelBody,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffToolbar,
} from '@/components/staff';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotasImportPanel } from '@/components/notas/NotasImportPanel';
import {
  NotasDeclaracionesPanel,
  type DeclDraft,
} from '@/components/notas/NotasDeclaracionesPanel';
import { notasService, studentsService } from '@/lib/services';
import type {
  NotasArea,
  NotasCarrera,
  NotasDeclaracion,
  NotasImportLog,
  NotasRankingArea,
  NotasRow,
  NotasSemana,
} from '@/types/notas';
import type { Student } from '@/types';
import {
  buildNotasRankingExcelBuffer,
  buildNotasRankingPdfBlob,
} from '@/lib/utils/notasReportExport';

export const NotasAdmin = () => {
  const [semanas, setSemanas] = useState<NotasSemana[]>([]);
  const [semanaId, setSemanaId] = useState<number | null>(null);
  const [areas, setAreas] = useState<NotasArea[]>([]);
  const [carreras, setCarreras] = useState<NotasCarrera[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [declaraciones, setDeclaraciones] = useState<NotasDeclaracion[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DeclDraft>>({});
  const [notas, setNotas] = useState<NotasRow[]>([]);
  const [ranking, setRanking] = useState<NotasRankingArea[]>([]);
  const [logs, setLogs] = useState<NotasImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingDecl, setSavingDecl] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroArea, setFiltroArea] = useState<string>('all');

  const semana = useMemo(
    () => semanas.find((s) => s.id === semanaId) ?? null,
    [semanas, semanaId],
  );

  const loadMeta = useCallback(async () => {
    const [semRes, areaRes, carRes, stuRes] = await Promise.all([
      notasService.listSemanas(true),
      notasService.listAreas(),
      notasService.listCarreras(),
      studentsService.getAll({ active: true, fetchAll: true }),
    ]);
    if (semRes.error) toast.error(semRes.error);
    else {
      setSemanas(semRes.semanas);
      setSemanaId((prev) => {
        if (prev && semRes.semanas.some((s) => s.id === prev)) return prev;
        return semRes.semanas[0]?.id ?? null;
      });
    }
    if (!areaRes.error) setAreas(areaRes.areas);
    if (!carRes.error) setCarreras(carRes.carreras);
    if (!stuRes.error) setStudents(stuRes.students);
  }, []);

  const loadWeekData = useCallback(async (id: number, silent?: boolean) => {
    if (silent) setRefreshing(true);
    try {
      const [decl, list, rank, logRes] = await Promise.all([
        notasService.listDeclaraciones(id),
        notasService.listNotas(id),
        notasService.ranking(id, 20),
        notasService.listImportLogs(15),
      ]);
      if (decl.error) toast.error(decl.error);
      else {
        setDeclaraciones(decl.declaraciones);
        const next: Record<number, DeclDraft> = {};
        for (const d of decl.declaraciones) {
          next[d.idEstudiante] = { areaId: d.areaId, carreraId: d.carreraId };
        }
        setDrafts(next);
      }
      if (list.error) toast.error(list.error);
      else setNotas(list.notas);
      if (!rank.error) setRanking(rank.porArea);
      if (!logRes.error) setLogs(logRes.logs);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadMeta();
      setLoading(false);
    })();
  }, [loadMeta]);

  useEffect(() => {
    if (semanaId == null) return;
    void loadWeekData(semanaId);
  }, [semanaId, loadWeekData]);

  const filteredNotas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notas.filter((n) => {
      if (filtroArea !== 'all' && String(n.areaId) !== filtroArea) return false;
      if (!q) return true;
      return `${n.nombreEstudiante} ${n.barcode}`.toLowerCase().includes(q);
    });
  }, [notas, search, filtroArea]);

  const saveDeclaraciones = async () => {
    if (semanaId == null) return;
    if (!semana?.abiertaDeclaracion) {
      toast.error('La declaración de esta semana está cerrada');
      return;
    }
    const filas = Object.entries(drafts)
      .filter(([, d]) => d.areaId != null)
      .map(([id, d]) => ({
        id_estudiante: Number(id),
        area_id: d.areaId!,
        carrera_id: d.carreraId,
      }));
    if (!filas.length) {
      toast.error('Asigne al menos un área');
      return;
    }
    setSavingDecl(true);
    try {
      const res = await notasService.upsertDeclaraciones(semanaId, filas);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Declaraciones: ${res.okCount} ok · ${res.failCount} fallos`);
        await loadWeekData(semanaId, true);
      }
    } finally {
      setSavingDecl(false);
    }
  };

  const assignBulkArea = (areaId: number) => {
    const q = search.trim().toLowerCase();
    const targets = !q
      ? students
      : students.filter((s) => `${s.fullName} ${s.barcode}`.toLowerCase().includes(q));
    setDrafts((prev) => {
      const next = { ...prev };
      for (const s of targets) {
        const cur = next[s.id] ?? { areaId: null, carreraId: null };
        next[s.id] = {
          areaId,
          carreraId:
            cur.carreraId != null &&
            carreras.some((c) => c.id === cur.carreraId && c.areaId === areaId)
              ? cur.carreraId
              : null,
        };
      }
      return next;
    });
  };

  const downloadExcel = async () => {
    if (!semana) return;
    try {
      const buf = await buildNotasRankingExcelBuffer(semana.etiqueta, ranking, notas, {
        semanaCodigo: semana.codigo,
      });
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ranking-notas-${semana.codigo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel de ranking descargado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el Excel');
    }
  };

  const downloadPdf = async () => {
    if (!semana) return;
    try {
      const blob = await buildNotasRankingPdfBlob(semana.etiqueta, ranking, notas, {
        semanaCodigo: semana.codigo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ranking-notas-${semana.codigo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF de ranking descargado');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="app-page app-page-shell space-y-6">
      <PageHeader
        icon={GraduationCap}
        eyebrow="Estudiantes"
        title="Notas por área"
        description="Declaración semanal de área, importación Excel y ranking"
        accent="secondary"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat
          label="Semanas"
          value={semanas.length}
          hint="activas"
          icon={GraduationCap}
          tone="info"
        />
        <StaffKpiStat
          label="Declaraciones"
          value={declaraciones.length}
          hint={semana?.codigo ?? '—'}
          icon={FileText}
          tone="success"
        />
        <StaffKpiStat
          label="Notas"
          value={notas.length}
          hint="cargadas"
          icon={FileSpreadsheet}
          tone="warning"
        />
        <StaffKpiStat
          label="Áreas"
          value={areas.length}
          hint="Salud · Ing. · Letras"
          icon={GraduationCap}
          tone="info"
        />
      </div>

      <StaffToolbar>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <Label>Semana</Label>
            <Select
              value={semanaId != null ? String(semanaId) : undefined}
              onValueChange={(v) => setSemanaId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione semana" />
              </SelectTrigger>
              <SelectContent>
                {semanas.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.etiqueta} ({s.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={refreshing || semanaId == null}
            onClick={() => semanaId != null && void loadWeekData(semanaId, true)}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
          {semana && (
            <p className="text-xs text-muted-foreground max-w-md">
              {semana.fechaInicio} → {semana.fechaFin}
              {semana.abiertaDeclaracion ? ' · declaración abierta' : ' · declaración cerrada'}
              {semana.abiertaCargaNotas ? ' · carga abierta' : ' · carga cerrada'}
            </p>
          )}
        </div>
      </StaffToolbar>

      {semanaId == null || !semana ? (
        <StaffEmptyState
          icon={GraduationCap}
          title="Sin semanas"
          description="Cree una semana en Administración → Configuración."
        />
      ) : (
        <Tabs defaultValue="declaraciones" className="space-y-4">
          <TabsList className="notas-tabs-list h-auto w-full max-w-3xl flex-wrap justify-start gap-1 rounded-xl border border-border bg-card p-1.5 text-foreground shadow-sm">
            <TabsTrigger value="declaraciones" className="notas-tabs-trigger">
              Declaraciones
            </TabsTrigger>
            <TabsTrigger value="importar" className="notas-tabs-trigger">
              Importar
            </TabsTrigger>
            <TabsTrigger value="listado" className="notas-tabs-trigger">
              Listado
            </TabsTrigger>
            <TabsTrigger value="reportes" className="notas-tabs-trigger">
              Reportes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="declaraciones" className="mt-4">
            <StaffDataPanel>
              <StaffDataPanelHeader
                accent="info"
                title="Área y carrera por estudiante"
                description="Postulación semanal: elija área/carrera en la tabla, o cargue un Excel con la columna Carrera."
              />
              <StaffDataPanelBody>
                <NotasDeclaracionesPanel
                  abiertaDeclaracion={semana.abiertaDeclaracion}
                  students={students}
                  areas={areas}
                  carreras={carreras}
                  drafts={drafts}
                  onDraftsChange={setDrafts}
                  search={search}
                  onSearchChange={setSearch}
                  saving={savingDecl}
                  onSave={() => void saveDeclaraciones()}
                  onBulkArea={assignBulkArea}
                />
              </StaffDataPanelBody>
            </StaffDataPanel>
          </TabsContent>

          <TabsContent value="importar" className="mt-4">
            <StaffDataPanel>
              <StaffDataPanelHeader
                accent="info"
                title="Importar Excel de notas"
                description="Parseo en el navegador. Descargue la plantilla, complete la columna Nota (0–20) e importe. Si no hay declaración previa, Carrera/Área del Excel la crea."
              />
              <StaffDataPanelBody>
                <NotasImportPanel
                  semanaId={semanaId}
                  semanaCodigo={semana.codigo}
                  semanaEtiqueta={semana.etiqueta}
                  semanaFechaInicio={semana.fechaInicio}
                  semanaFechaFin={semana.fechaFin}
                  semanaAbiertaCarga={semana.abiertaCargaNotas}
                  declaraciones={declaraciones}
                  areas={areas}
                  onImported={() => void loadWeekData(semanaId, true)}
                />
              </StaffDataPanelBody>
            </StaffDataPanel>
          </TabsContent>

          <TabsContent value="listado" className="mt-4">
            <StaffDataPanel>
              <StaffDataPanelHeader
                title={`Notas — ${semana.etiqueta}`}
                description="Listado de la semana seleccionada"
              />
              <StaffDataPanelBody className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Input
                    placeholder="Buscar…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                  <Select value={filtroArea} onValueChange={setFiltroArea}>
                    <SelectTrigger className="h-auto min-h-10 w-[min(100%,18rem)] whitespace-normal text-left [&>span]:line-clamp-none [&>span]:whitespace-normal">
                      <SelectValue placeholder="Área" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[min(92vw,22rem)]">
                      <SelectItem value="all" className="whitespace-normal py-2.5">
                        Todas las áreas
                      </SelectItem>
                      {areas.map((a) => (
                        <SelectItem
                          key={a.id}
                          value={String(a.id)}
                          className="whitespace-normal py-2.5 leading-snug"
                        >
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {filteredNotas.length === 0 ? (
                  <StaffEmptyState
                    icon={FileSpreadsheet}
                    title="Sin notas"
                    description="Importe un Excel o cambie de semana."
                  />
                ) : (
                  <div className="notas-table-wrap">
                    <Table className="min-w-[640px]">
                      <TableHeader>
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableHead className="notas-table-th">Estudiante</TableHead>
                          <TableHead className="notas-table-th">DNI</TableHead>
                          <TableHead className="notas-table-th min-w-[12rem]">Área</TableHead>
                          <TableHead className="notas-table-th min-w-[10rem]">Carrera</TableHead>
                          <TableHead className="notas-table-th">Nota</TableHead>
                          <TableHead className="notas-table-th">Obs.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNotas.map((n) => (
                          <TableRow key={n.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium leading-snug">
                              {n.nombreEstudiante}
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                              {n.barcode}
                            </TableCell>
                            <TableCell className="max-w-[14rem] text-sm leading-snug">
                              {n.areaNombre}
                            </TableCell>
                            <TableCell className="max-w-[14rem] text-sm leading-snug text-muted-foreground">
                              {n.carreraNombre || '—'}
                            </TableCell>
                            <TableCell className="font-semibold tabular-nums">{n.nota}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {n.observacion || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </StaffDataPanelBody>
            </StaffDataPanel>
          </TabsContent>

          <TabsContent value="reportes" className="mt-4 space-y-4">
            <StaffDataPanel>
              <StaffDataPanelHeader
                title="Ranking por área"
                description="Ranking por área + Excel (todas las notas por sección) y PDF"
              />
              <StaffDataPanelBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void downloadExcel()}>
                    <Download className="mr-2 h-4 w-4" />
                    Excel ranking
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void downloadPdf()}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF ranking
                  </Button>
                </div>
                {ranking.length === 0 ? (
                  <StaffEmptyState
                    icon={GraduationCap}
                    title="Sin ranking"
                    description="Cargue notas para ver el top por área."
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {ranking.map((a) => (
                      <div
                        key={a.areaId}
                        className="app-card space-y-3 p-4"
                      >
                        <h3 className="text-sm font-semibold leading-snug text-foreground">
                          {a.areaNombre}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Mayor:{' '}
                          {a.top[0]
                            ? `${a.top[0].nombreEstudiante} (${a.top[0].nota})`
                            : '—'}
                        </p>
                        <ol className="space-y-2 text-sm leading-snug">
                          {a.top.slice(0, 5).map((t) => (
                            <li
                              key={`${a.areaId}-${t.idEstudiante}`}
                              className="flex gap-2 border-b border-border/60 pb-2 last:border-0"
                            >
                              <span className="tabular-nums text-muted-foreground">
                                {t.puesto}.
                              </span>
                              <span className="min-w-0 flex-1">
                                {t.nombreEstudiante}
                              </span>
                              <span className="font-semibold tabular-nums">{t.nota}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </StaffDataPanelBody>
            </StaffDataPanel>

            <StaffDataPanel>
              <StaffDataPanelHeader title="Historial de imports" />
              <StaffDataPanelBody>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay imports.</p>
                ) : (
                  <div className="notas-table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-0 hover:bg-transparent">
                          <TableHead className="notas-table-th">Fecha</TableHead>
                          <TableHead className="notas-table-th">Semana</TableHead>
                          <TableHead className="notas-table-th">Archivo</TableHead>
                          <TableHead className="notas-table-th">OK</TableHead>
                          <TableHead className="notas-table-th">Sin decl.</TableHead>
                          <TableHead className="notas-table-th">Sin match</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs">{l.importadoEn}</TableCell>
                            <TableCell>{l.semanaCodigo}</TableCell>
                            <TableCell>{l.nombreArchivo || '—'}</TableCell>
                            <TableCell>{l.filasOk}</TableCell>
                            <TableCell>{l.filasSinDeclaracion}</TableCell>
                            <TableCell>{l.filasSinMatch}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </StaffDataPanelBody>
            </StaffDataPanel>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
