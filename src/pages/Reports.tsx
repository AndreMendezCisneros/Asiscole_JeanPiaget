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

  const exportToPDF = async () => {
    if (!viewStats) {
      toast.error('No hay datos para exportar');
      return;
    }

    try {
      toast.loading('Generando PDF...', { id: 'pdf-export' });

      const { incidents: incidentsList, error } = await loadExportIncidents();

      if (error) {
        toast.error('Error al cargar incidencias para el PDF', { id: 'pdf-export' });
        return;
      }

      if (selectedStudent && incidentsList.length === 0) {
        toast.error('No hay incidencias de ese estudiante para exportar', { id: 'pdf-export' });
        return;
      }

      const exportStats = selectedStudent
        ? buildDashboardStatsFromIncidents(incidentsList)
        : viewStats;

      const { PdfReportDocument, buildFilterSubtitle } = await import('@/lib/utils/pdfReportBuilder');

      const bimestreInfo =
        bimestre !== 'all'
          ? getAllBimestres(añoEscolar).find((b) => b.numero === bimestre)
          : undefined;

      const subtitle = buildFilterSubtitle([
        `Generado ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
        selectedStudent ? `Estudiante: ${selectedStudent.fullName}` : selectedLevel !== 'all' && `Nivel: ${selectedLevel}`,
        selectedStudent ? undefined : selectedGrade !== 'all' && `${CLASSROOM_FIELD_LABELS.grade}: ${selectedGrade}`,
        selectedStudent ? undefined : selectedSection !== 'all' && `${CLASSROOM_FIELD_LABELS.section}: ${selectedSection}`,
        bimestreInfo && `Período: ${formatBimestreLabel(bimestreInfo)}`,
      ]);

      const doc = new PdfReportDocument(
        'portrait',
        selectedStudent ? 'REPORTE DE INCIDENCIAS DEL ESTUDIANTE' : 'REPORTE DE INCIDENCIAS',
        subtitle,
      );
      await doc.drawCoverHeader();

      const criticalCount = exportStats.levelDistribution.level3 + exportStats.levelDistribution.level4;
      const exportLevelItems = [
        { level: 'Nivel 0 - Sin reincidencias', count: exportStats.levelDistribution.level0 },
        { level: 'Nivel 1 - Primera reincidencia', count: exportStats.levelDistribution.level1 },
        { level: 'Nivel 2 - Reincidencia moderada', count: exportStats.levelDistribution.level2 },
        { level: 'Nivel 3 - Reincidencia alta', count: exportStats.levelDistribution.level3 },
        { level: 'Nivel 4 - Reincidencia crítica', count: exportStats.levelDistribution.level4 },
      ];

      doc.drawKpiCards([
        { label: 'Total incidencias', value: exportStats.totalIncidents, tone: 'primary' },
        { label: 'Estudiantes involucrados', value: exportStats.studentsWithIncidents, tone: 'info' },
        { label: 'Nivel promedio', value: exportStats.averageReincidenceLevel.toFixed(1), tone: 'warning' },
        { label: 'Casos críticos', value: criticalCount, tone: criticalCount > 0 ? 'error' : 'success' },
      ]);

      doc.drawSectionTitle('Distribución por nivel de reincidencia');
      doc.drawKeyValueList(
        exportLevelItems.map((item) => {
          const pct =
            exportStats.totalIncidents > 0
              ? ((item.count / exportStats.totalIncidents) * 100).toFixed(1)
              : '0';
          return { label: item.level, value: `${item.count} registros (${pct}%)` };
        })
      );

      doc.drawSectionTitle('Faltas más frecuentes');
      doc.drawTable(
        [
          { header: '#', dataKey: 'rank', width: 10, align: 'center' },
          { header: 'Tipo de falta', dataKey: 'fault' },
          { header: 'Cantidad', dataKey: 'count', width: 22, align: 'center' },
          { header: '% del total', dataKey: 'pct', width: 22, align: 'right' },
        ],
        exportStats.topFaults.slice(0, 15).map((fault, index) => {
          const pct =
            exportStats.totalIncidents > 0
              ? `${((fault.count / exportStats.totalIncidents) * 100).toFixed(1)}%`
              : '0%';
          return {
            rank: String(index + 1),
            fault: fault.faultType,
            count: String(fault.count),
            pct,
          };
        })
      );

      doc.drawSectionTitle('Detalle de incidencias');
      doc.drawParagraph(
        `Listado de ${incidentsList.length} registro(s). Se muestran hasta 80 filas en este documento.`
      );
      doc.drawTable(
        [
          { header: 'ID', dataKey: 'id', width: 12, align: 'center' },
          { header: 'Estudiante', dataKey: 'student', width: 42 },
          { header: 'Grado', dataKey: 'grade', width: 18 },
          { header: 'Falta', dataKey: 'fault', width: 38 },
          { header: 'Niv.', dataKey: 'level', width: 12, align: 'center' },
          { header: 'Estado', dataKey: 'status', width: 18 },
          { header: 'Fecha', dataKey: 'date', width: 22 },
        ],
        incidentsList.map((inc) => ({
          id: String(inc.id),
          student: inc.student?.fullName ?? '—',
          grade: inc.student ? `${inc.student.grade} ${inc.student.section}` : '—',
          fault: inc.faultType?.name ?? '—',
          level: String(inc.reincidenceLevel),
          status: inc.status,
          date: format(new Date(inc.registeredAt), 'dd/MM/yyyy HH:mm', { locale: es }),
        })),
        { fontSize: 7.5, maxRows: 80 }
      );

      const fileName = `Reporte_Incidencias_${format(new Date(), 'yyyy_MM_dd', { locale: es })}.pdf`;
      await doc.finalize(fileName);

      toast.success('PDF generado exitosamente', { id: 'pdf-export' });
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

    try {
      const { incidents: incidentsList, error } = await loadExportIncidents();

      if (error) {
        toast.error('Error al cargar incidencias para exportar');
        return;
      }

      if (selectedStudent && incidentsList.length === 0) {
        toast.error('No hay incidencias de ese estudiante para exportar');
        return;
      }

      const exportStats = selectedStudent
        ? buildDashboardStatsFromIncidents(incidentsList)
        : viewStats;

      let filterText = `Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`;
      if (selectedStudent) filterText += ` · Estudiante: ${selectedStudent.fullName}`;
      else {
        if (selectedLevel !== 'all') filterText += ` · Nivel: ${selectedLevel}`;
        if (selectedGrade !== 'all') filterText += ` · ${CLASSROOM_FIELD_LABELS.grade}: ${selectedGrade}`;
        if (selectedSection !== 'all') filterText += ` · ${CLASSROOM_FIELD_LABELS.section}: ${selectedSection}`;
      }
      if (bimestre !== 'all') {
        const b = getAllBimestres(añoEscolar).find((x) => x.numero === bimestre);
        if (b) filterText += ` · ${formatBimestreLabel(b)}`;
      }

      const levelItemsForExport = [
        { level: 'Nivel 0 - Sin reincidencias', count: exportStats.levelDistribution.level0 },
        { level: 'Nivel 1 - Primera reincidencia', count: exportStats.levelDistribution.level1 },
        { level: 'Nivel 2 - Reincidencia moderada', count: exportStats.levelDistribution.level2 },
        { level: 'Nivel 3 - Reincidencia alta', count: exportStats.levelDistribution.level3 },
        { level: 'Nivel 4 - Reincidencia crítica', count: exportStats.levelDistribution.level4 },
      ];

      const { exportIncidentsReportExcel } = await import('@/lib/utils/excelReportExports');
      await exportIncidentsReportExcel(exportStats, incidentsList, {
        filterText,
        levelItems: levelItemsForExport,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      if (message.includes('No hay')) {
        toast.error(message);
      }
    }
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