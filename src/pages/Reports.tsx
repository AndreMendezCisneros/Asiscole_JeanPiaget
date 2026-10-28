import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, TrendingUp, Users, AlertTriangle, Calendar, Loader2, Filter, BarChart3, FileDown, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffDataPanel,
  StaffDataPanelBody,
  StaffDataPanelHeader,
  StaffKpiStat,
  StaffToolbar,
} from '@/components/staff';
import { IncidentTrendChart } from '@/components/reports/IncidentTrendChart';
import {
  GradeLevelChart,
  ReincidenceDonut,
  TopFaultsChart,
  WeekdayChart,
} from '@/components/reports/IncidentBreakdownCharts';
import { GradeComparisonChart, SectionHeatmap } from '@/components/reports/ComparisonCharts';
import { Label } from '@/components/ui/label';

import { dashboardService, incidentsService } from '@/lib/services';
import { DashboardStats, EducationalLevel, Incident, Student } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCurrentSchoolYear, getAllBimestres, formatBimestreLabel, type Bimestre } from '@/lib/utils/bimestreUtils';
import { StudentSearchCombobox } from '@/components/students/StudentSearchCombobox';
import { CLASSROOM_FIELD_LABELS, CLASSROOM_GRADES, CLASSROOM_LEVELS, CLASSROOM_SECTIONS } from '@/lib/constants/classrooms';
import { buildDashboardStatsFromIncidents } from '@/lib/utils/incidentReportStats';
import { LatenessPanel } from '@/components/lateness/LatenessPanel';
import { useLatenessReportQuery } from '@/hooks/queries/useDashboardQueries';
import type { ReportExportData } from '@/lib/reports/reportInsights';
import { SCHOOL_NAME } from '@/config/siteSeo';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const Reports = () => {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | EducationalLevel>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'moderate' | 'critical'>('all');
  const [bimestre, setBimestre] = useState<Bimestre | 'all'>('all');
  const [añoEscolar, setAñoEscolar] = useState<number>(getCurrentSchoolYear());
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const studentFilterActive = selectedStudent != null;

  // Filtros derivados memoizados — la clave de caché cambia solo cuando cambian los filtros
  const reportFilters = useMemo(() => ({
    bimestre: bimestre !== 'all' ? (bimestre as number) : undefined,
    añoEscolar,
    level: selectedLevel === 'all' ? undefined : (selectedLevel as EducationalLevel),
    grade: selectedGrade === 'all' ? undefined : selectedGrade,
    section: selectedSection === 'all' ? undefined : selectedSection,
  }), [bimestre, añoEscolar, selectedLevel, selectedGrade, selectedSection]);

  const { data: reportsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.reports.all(reportFilters),
    queryFn: async () => {
      const page = await dashboardService.getReportsPage({
        añoEscolar: reportFilters.añoEscolar,
        bimestre: reportFilters.bimestre,
        level: reportFilters.level,
        grade: reportFilters.grade,
        section: reportFilters.section,
      });

      if (page.error) toast.error('Error al cargar estadísticas');

      return {
        stats: page.stats,
        monthlyTrend: page.monthlyTrend ?? [],
        weeklyData: page.weeklyData ?? [],
        comparisonByGrade: page.byGrade ?? [],
        comparisonBySection: page.bySection ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Tardanzas: bimestre elegido o año escolar completo, nunca más allá de hoy
  const latenessFilters = useMemo(() => {
    const bimestres = getAllBimestres(añoEscolar);
    const range = reportFilters.bimestre
      ? bimestres.find((b) => b.numero === reportFilters.bimestre)
      : { inicio: bimestres[0].inicio, fin: bimestres[bimestres.length - 1].fin };
    const today = getLimaTodayDate();
    const dateTo = localDateKey(range!.fin);
    return {
      dateFrom: localDateKey(range!.inicio),
      dateTo: dateTo > today ? today : dateTo,
      level: reportFilters.level,
      grade: reportFilters.grade,
      section: reportFilters.section,
    };
  }, [añoEscolar, reportFilters]);
  const latenessQuery = useLatenessReportQuery(latenessFilters, latenessFilters.dateFrom <= latenessFilters.dateTo);

  // «Ver reporte completo» del Inicio llega con #tardanzas: bajar a esa sección cuando ya se pintó
  const location = useLocation();
  const pageReady = Boolean(reportsData);
  useEffect(() => {
    if (location.hash !== '#tardanzas' || !pageReady) return;
    const id = window.setTimeout(() => {
      document.getElementById('tardanzas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(id);
  }, [location.hash, pageReady]);

  const { data: studentIncidents = [] } = useQuery({
    queryKey: ['reports', 'student-incidents', selectedStudent?.id, reportFilters.bimestre, reportFilters.añoEscolar],
    enabled: studentFilterActive,
    queryFn: async () => {
      const { incidents, error } = await incidentsService.getAll({
        estudianteId: selectedStudent!.id,
        bimestre: reportFilters.bimestre,
        añoEscolar: reportFilters.bimestre ? reportFilters.añoEscolar : undefined,
        fetchAll: true,
      });
      if (error) {
        toast.error(error);
        return [] as Incident[];
      }
      return incidents;
    },
    staleTime: 60 * 1000,
  });

  const stats: DashboardStats | null = reportsData?.stats ?? null;
  const monthlyTrend = reportsData?.monthlyTrend ?? [];
  const weeklyData = reportsData?.weeklyData ?? [];
  const comparisonByGrade = reportsData?.comparisonByGrade ?? [];
  const comparisonBySection = useMemo(() => {
    const rows = reportsData?.comparisonBySection ?? [];
    if (!reportFilters.section) return rows;
    return rows.filter((row) => row.section === reportFilters.section);
  }, [reportsData?.comparisonBySection, reportFilters.section]);
  const loading = isLoading && !reportsData;
  const studentReportStats = useMemo(
    () => (studentFilterActive ? buildDashboardStatsFromIncidents(studentIncidents) : null),
    [studentFilterActive, studentIncidents],
  );
  const viewStats = studentReportStats ?? stats;

  const loadExportIncidents = async () => {
    const { incidents: incidentsList, error } = await incidentsService.getAll({
      nivelEducativo: selectedStudent ? undefined : selectedLevel === 'all' ? undefined : selectedLevel,
      grado: selectedStudent ? undefined : selectedGrade === 'all' ? undefined : selectedGrade,
      seccion: selectedStudent ? undefined : selectedSection === 'all' ? undefined : selectedSection,
      bimestre: bimestre !== 'all' ? bimestre : undefined,
      añoEscolar: bimestre !== 'all' ? añoEscolar : undefined,
      estudianteId: selectedStudent?.id,
      fetchAll: true,
    });
    if (error) return { error, incidents: [] as Incident[] };
    return { error: null, incidents: incidentsList };
  };

  /** Datos del informe exportado: los mismos que se ven en pantalla, con los filtros aplicados. */
  const buildExportData = async (incidentsList: Incident[]): Promise<ReportExportData> => {
    const bimestreInfo =
      bimestre !== 'all' ? getAllBimestres(añoEscolar).find((b) => b.numero === bimestre) : undefined;
    const filterParts = [
      selectedLevel !== 'all' && `Nivel: ${selectedLevel}`,
      selectedGrade !== 'all' && `${CLASSROOM_FIELD_LABELS.grade}: ${selectedGrade}`,
      selectedSection !== 'all' && `${CLASSROOM_FIELD_LABELS.section}: ${selectedSection}`,
    ].filter(Boolean) as string[];

    // En modo estudiante la tendencia sale de sus propias incidencias
    const studentTrend = () => {
      const map = new Map<string, number>();
      for (const inc of incidentsList) {
        const key = inc.registeredAt.slice(0, 7);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return [...map.entries()]
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([key, incidents]) => ({
          month: format(new Date(`${key}-01T12:00:00`), 'MMM yyyy', { locale: es }),
          incidents,
        }));
    };

    let lateness = selectedStudent ? null : latenessQuery.data ?? null;
    if (!selectedStudent && !lateness) {
      const res = await latenessQuery.refetch();
      lateness = res.data ?? null;
    }

    return {
      schoolName: SCHOOL_NAME,
      periodLabel: bimestreInfo ? formatBimestreLabel(bimestreInfo) : `Año escolar ${añoEscolar}`,
      filterText: filterParts.join(' · '),
      studentName: selectedStudent?.fullName,
      stats: selectedStudent ? buildDashboardStatsFromIncidents(incidentsList) : viewStats!,
      monthlyTrend: selectedStudent ? studentTrend() : monthlyTrend,
      weeklyData: selectedStudent ? [] : weeklyData,
      byGrade: selectedStudent ? [] : comparisonByGrade,
      bySection: selectedStudent ? [] : comparisonBySection,
      lateness,
    };
  };

  const exportToPDF = async () => {
    if (!viewStats) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      toast.loading('Generando informe PDF…', { id: 'pdf-export' });
      const { incidents: incidentsList, error } = await loadExportIncidents();
      if (error) {
        toast.error('Error al cargar incidencias para el PDF', { id: 'pdf-export' });
        return;
      }
      if (selectedStudent && incidentsList.length === 0) {
        toast.error('No hay incidencias de ese estudiante para exportar', { id: 'pdf-export' });
        return;
      }
      const { exportFullReportPdf } = await import('@/lib/reports/fullReportPdf');
      await exportFullReportPdf(await buildExportData(incidentsList), incidentsList);
      toast.success('Informe PDF generado', { id: 'pdf-export' });
    } catch (err) {
      console.error('Error al generar PDF:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al generar PDF: ${message}`, { id: 'pdf-export' });
    }
  };

  const exportToExcel = async () => {
    if (!viewStats) {
      toast.error('No hay datos para exportar');
      return;
    }
    const { incidents: incidentsList, error } = await loadExportIncidents();
    if (error) {
      toast.error('Error al cargar incidencias para exportar');
      return;
    }
    if (selectedStudent && incidentsList.length === 0) {
      toast.error('No hay incidencias de ese estudiante para exportar');
      return;
    }
    const { exportFullReportExcel } = await import('@/lib/reports/fullReportExcel');
    await exportFullReportExcel(await buildExportData(incidentsList), incidentsList);
  };

  // monthlyTrend y weeklyData ahora vienen del estado, cargados desde la base de datos

  // Filter data by grade
  const filteredIncidentsByGrade = (viewStats?.incidentsByGrade || []).filter((item) => {
    if (studentFilterActive) return true;
    const matchesGrade = selectedGrade === 'all' || item.grade === selectedGrade;
    const matchesLevel = selectedLevel === 'all' || item.level === selectedLevel;
    return matchesGrade && matchesLevel;
  });

  // Niveles visibles según el filtro «Enfoque»
  const visibleLevels =
    severityFilter === 'moderate' ? [1, 2] : severityFilter === 'critical' ? [3, 4, 5] : [0, 1, 2, 3, 4, 5];

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-page-state">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="app-page">
        <div className="app-page-state">
          <p className="text-muted-foreground">Error al cargar las estadísticas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page app-page-shell w-full">
      <PageHeader
        icon={BarChart3}
        eyebrow="Reportes"
        title="Reportes de Incidencias"
        description="Analice tendencias, distribución por nivel y faltas más frecuentes del período"
        accent="primary"
      />
      <StaffToolbar
        title="Período y filtros"
        description="Busque un estudiante o ajuste el alcance del análisis y exporte"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void refetch();
                void latenessQuery.refetch();
              }}
              variant="outline"
              size="sm"
              disabled={isFetching}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {isFetching ? 'Cargando…' : 'Actualizar'}
            </Button>
            <Button onClick={exportToPDF} disabled={!viewStats} variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button onClick={exportToExcel} disabled={!viewStats} variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reports-student-search">Buscar estudiante</Label>
          <StudentSearchCombobox
            id="reports-student-search"
            variant="search"
            allowClear
            value={selectedStudent?.id ?? null}
            placeholder="Nombre completo del estudiante..."
            onChange={(_id, student) => setSelectedStudent(student)}
            onClear={() => setSelectedStudent(null)}
          />
        </div>
        <div className="space-y-2">
          <Label>Nivel</Label>
        <Select
          value={selectedLevel}
          disabled={studentFilterActive}
          onValueChange={(value) => setSelectedLevel(value as 'all' | EducationalLevel)}
        >
          <SelectTrigger>
            <SelectValue placeholder={CLASSROOM_FIELD_LABELS.allLevels} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{CLASSROOM_FIELD_LABELS.allLevels}</SelectItem>
            {CLASSROOM_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <div className="space-y-2">
          <Label>{CLASSROOM_FIELD_LABELS.grade}</Label>
        <Select value={selectedGrade} disabled={studentFilterActive} onValueChange={setSelectedGrade}>
          <SelectTrigger>
            <SelectValue placeholder={CLASSROOM_FIELD_LABELS.allGrades} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{CLASSROOM_FIELD_LABELS.allGrades}</SelectItem>
            {CLASSROOM_GRADES.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <div className="space-y-2">
          <Label>Enfoque</Label>
        <Select value={severityFilter} onValueChange={(value: 'all' | 'moderate' | 'critical') => setSeverityFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Enfoque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="moderate">Reincidencias moderadas</SelectItem>
            <SelectItem value="critical">Casos críticos</SelectItem>
          </SelectContent>
        </Select>
        </div>
        <div className="space-y-2">
          <Label>Año escolar</Label>
        <Select value={String(añoEscolar)} onValueChange={(value) => setAñoEscolar(Number(value))}>
          <SelectTrigger>
            <SelectValue placeholder="Año escolar" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 5 }, (_, i) => getCurrentSchoolYear() - 2 + i).map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <div className="space-y-2">
          <Label>Bimestre</Label>
        <Select value={bimestre === 'all' ? 'all' : String(bimestre)} onValueChange={(value) => setBimestre(value === 'all' ? 'all' : (Number(value) as Bimestre))}>
          <SelectTrigger>
            <SelectValue placeholder="Bimestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los bimestres</SelectItem>
            {getAllBimestres(añoEscolar).map((b) => (
              <SelectItem key={b.numero} value={String(b.numero)}>
                {formatBimestreLabel(b)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <div className="space-y-2">
          <Label>{CLASSROOM_FIELD_LABELS.section}</Label>
          <Select
            value={selectedSection}
            disabled={studentFilterActive}
            onValueChange={setSelectedSection}
          >
            <SelectTrigger>
              <SelectValue placeholder={CLASSROOM_FIELD_LABELS.allSections} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{CLASSROOM_FIELD_LABELS.allSections}</SelectItem>
              {CLASSROOM_SECTIONS.map((section) => (
                <SelectItem key={section} value={section}>
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </StaffToolbar>

      <div className="app-kpi-grid">
        <StaffKpiStat
          label="Total incidencias"
          value={viewStats?.totalIncidents ?? 0}
          icon={TrendingUp}
          tone="primary"
        />
        <StaffKpiStat
          label="Estudiantes"
          value={viewStats?.studentsWithIncidents ?? 0}
          hint={selectedStudent?.fullName}
          icon={Users}
          tone="accent"
        />
        <StaffKpiStat
          label="Nivel promedio"
          value={(viewStats?.averageReincidenceLevel ?? 0).toFixed(1)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StaffKpiStat
          label="Casos críticos"
          value={(viewStats?.levelDistribution.level3 ?? 0) + (viewStats?.levelDistribution.level4 ?? 0)}
          icon={AlertTriangle}
          tone="secondary"
        />
      </div>

      <div id="tardanzas" className="scroll-mt-20">
      <LatenessPanel
        description={`${
          bimestre !== 'all'
            ? formatBimestreLabel(getAllBimestres(añoEscolar).find((b) => b.numero === bimestre)!)
            : `Año escolar ${añoEscolar}`
        } · respeta los filtros de nivel, grado y sección`}
        summary={latenessQuery.data ?? null}
        isLoading={latenessQuery.isLoading}
        isError={latenessQuery.isError}
        isFetching={latenessQuery.isFetching}
        onRetry={() => void latenessQuery.refetch()}
        showDaily
      />
      </div>

      <StaffDataPanel>
        <StaffDataPanelHeader
          compact
          accent="primary"
          title="Tendencia mensual"
          description="Incidencias por mes, con el promedio del período y el mes pico"
        />
        <StaffDataPanelBody>
          <IncidentTrendChart data={monthlyTrend} />
        </StaffDataPanelBody>
      </StaffDataPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StaffDataPanel>
          <StaffDataPanelHeader
            compact
            accent="info"
            title="Incidencias por día"
            description="Esta semana · el día con más se resalta"
          />
          <StaffDataPanelBody>
            <WeekdayChart data={weeklyData} />
          </StaffDataPanelBody>
        </StaffDataPanel>

        <StaffDataPanel>
          <StaffDataPanelHeader
            compact
            accent="info"
            title="Incidencias por nivel y grado"
            description={
              selectedLevel !== 'all' || selectedGrade !== 'all'
                ? `${selectedLevel !== 'all' ? selectedLevel : 'Todos los niveles'} ${selectedGrade !== 'all' ? selectedGrade : ''}`.trim()
                : 'Color según nivel educativo'
            }
          />
          <StaffDataPanelBody>
            <GradeLevelChart data={filteredIncidentsByGrade} />
          </StaffDataPanelBody>
        </StaffDataPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StaffDataPanel>
          <StaffDataPanelHeader
            compact
            accent="warning"
            title="Nivel de reincidencia"
            description={
              severityFilter === 'all'
                ? 'Cómo se reparten las incidencias por gravedad'
                : severityFilter === 'moderate'
                  ? 'Enfoque: reincidencias moderadas'
                  : 'Enfoque: casos críticos'
            }
          />
          <StaffDataPanelBody>
            {viewStats && (
              <ReincidenceDonut distribution={viewStats.levelDistribution} visibleLevels={visibleLevels} />
            )}
          </StaffDataPanelBody>
        </StaffDataPanel>

        <StaffDataPanel>
          <StaffDataPanelHeader
            compact
            accent="warning"
            title="Faltas más frecuentes"
            description="% del total de incidencias · las 3 primeras resaltadas"
          />
          <StaffDataPanelBody>
            <TopFaultsChart faults={viewStats?.topFaults ?? []} total={viewStats?.totalIncidents ?? 0} />
          </StaffDataPanelBody>
        </StaffDataPanel>
      </div>

      <StaffDataPanel>
        <StaffDataPanelHeader
          compact
          accent="accent"
          title="Comparativa por grados"
          description="Por gravedad (composición por nivel de reincidencia) o por alumno (incidencias por alumno involucrado)"
        />
        <StaffDataPanelBody>
          <GradeComparisonChart rows={comparisonByGrade} />
        </StaffDataPanelBody>
      </StaffDataPanel>

      <StaffDataPanel>
        <StaffDataPanelHeader
          compact
          accent="accent"
          title="Comparativa por secciones"
          description="Mapa por grado y sección · pase el cursor por un aula para ver el detalle"
        />
        <StaffDataPanelBody>
          <SectionHeatmap rows={comparisonBySection} />
        </StaffDataPanelBody>
      </StaffDataPanel>
    </div>
  );
};