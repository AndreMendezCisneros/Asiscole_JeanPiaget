import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { StaffKpiStat, StaffToolbar } from '@/components/staff';
import { Label } from '@/components/ui/label';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { dashboardService, incidentsService } from '@/lib/services';
import { DashboardStats, EducationalLevel } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCurrentSchoolYear, getAllBimestres, formatBimestreLabel, type Bimestre } from '@/lib/utils/bimestreUtils';

export const Reports = () => {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<'all' | EducationalLevel>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'moderate' | 'critical'>('all');
  const [bimestre, setBimestre] = useState<Bimestre | 'all'>('all');
  const [añoEscolar, setAñoEscolar] = useState<number>(getCurrentSchoolYear());

  // Filtros derivados memoizados — la clave de caché cambia solo cuando cambian los filtros
  const reportFilters = useMemo(() => ({
    bimestre: bimestre !== 'all' ? (bimestre as number) : undefined,
    añoEscolar,
    level: selectedLevel === 'all' ? undefined : (selectedLevel as EducationalLevel),
    grade: selectedGrade === 'all' ? undefined : selectedGrade,
  }), [bimestre, añoEscolar, selectedLevel, selectedGrade]);

  const { data: reportsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.reports.all(reportFilters),
    queryFn: async () => {
      const statsFilters: { bimestre?: number; añoEscolar?: number } = {};
      if (reportFilters.bimestre) {
        statsFilters.bimestre = reportFilters.bimestre;
        statsFilters.añoEscolar = reportFilters.añoEscolar;
      }

      const [statsResult, trendResult, weeklyResult, gradeResult, sectionResult] = await Promise.all([
        dashboardService.getDashboardStats(statsFilters),
        dashboardService.getMonthlyTrend(reportFilters.añoEscolar, reportFilters.level, reportFilters.grade),
        dashboardService.getWeeklyData(reportFilters.level, reportFilters.grade),
        dashboardService.getComparisonByGrade({
          level: reportFilters.level,
          bimestre: reportFilters.bimestre,
          añoEscolar: reportFilters.bimestre ? reportFilters.añoEscolar : undefined,
        }),
        dashboardService.getComparisonBySection({
          level: reportFilters.level,
          grade: reportFilters.grade,
          bimestre: reportFilters.bimestre,
          añoEscolar: reportFilters.bimestre ? reportFilters.añoEscolar : undefined,
        }),
      ]);

      if (statsResult.error) toast.error('Error al cargar estadísticas');

      return {
        stats: statsResult.stats,
        monthlyTrend: trendResult.monthlyTrend ?? [],
        weeklyData: weeklyResult.weeklyData ?? [],
        comparisonByGrade: gradeResult.comparison ?? [],
        comparisonBySection: sectionResult.comparison ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const stats: DashboardStats | null = reportsData?.stats ?? null;
  const monthlyTrend = reportsData?.monthlyTrend ?? [];
  const weeklyData = reportsData?.weeklyData ?? [];
  const comparisonByGrade = reportsData?.comparisonByGrade ?? [];
  const comparisonBySection = reportsData?.comparisonBySection ?? [];
  const loading = isLoading && !reportsData;

  const exportToPDF = async () => {
    if (!stats) {
      toast.error('No hay datos para exportar');
      return;
    }

    try {
      toast.loading('Generando PDF...', { id: 'pdf-export' });

      const { incidents: incidentsList, error } = await incidentsService.getAll({
        nivelEducativo: selectedLevel === 'all' ? undefined : selectedLevel,
        grado: selectedGrade === 'all' ? undefined : selectedGrade,
        bimestre: bimestre !== 'all' ? bimestre : undefined,
        añoEscolar: bimestre !== 'all' ? añoEscolar : undefined,
        fetchAll: true,
      });

      if (error) {
        toast.error('Error al cargar incidencias para el PDF', { id: 'pdf-export' });
        return;
      }

      const { PdfReportDocument, buildFilterSubtitle } = await import('@/lib/utils/pdfReportBuilder');

      const bimestreInfo =
        bimestre !== 'all'
          ? getAllBimestres(añoEscolar).find((b) => b.numero === bimestre)
          : undefined;

      const subtitle = buildFilterSubtitle([
        `Generado ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
        selectedLevel !== 'all' && `Nivel: ${selectedLevel}`,
        selectedGrade !== 'all' && `Grado: ${selectedGrade}`,
        bimestreInfo && `Período: ${formatBimestreLabel(bimestreInfo)}`,
      ]);

      const doc = new PdfReportDocument('portrait', 'REPORTE DE INCIDENCIAS', subtitle);
      await doc.drawCoverHeader();

      const criticalCount = stats.levelDistribution.level3 + stats.levelDistribution.level4;

      doc.drawKpiCards([
        { label: 'Total incidencias', value: stats.totalIncidents, tone: 'primary' },
        { label: 'Estudiantes involucrados', value: stats.studentsWithIncidents, tone: 'info' },
        { label: 'Nivel promedio', value: stats.averageReincidenceLevel.toFixed(1), tone: 'warning' },
        { label: 'Casos críticos', value: criticalCount, tone: criticalCount > 0 ? 'error' : 'success' },
      ]);

      doc.drawSectionTitle('Distribución por nivel de reincidencia');
      doc.drawKeyValueList(
        levelItems.map((item) => {
          const pct =
            stats.totalIncidents > 0
              ? ((item.count / stats.totalIncidents) * 100).toFixed(1)
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
        stats.topFaults.slice(0, 15).map((fault, index) => {
          const pct =
            stats.totalIncidents > 0
              ? `${((fault.count / stats.totalIncidents) * 100).toFixed(1)}%`
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
    if (!stats) {
      toast.error('No hay datos para exportar');
      return;
    }

    try {
      const { incidents: incidentsList, error } = await incidentsService.getAll({
        nivelEducativo: selectedLevel === 'all' ? undefined : selectedLevel,
        grado: selectedGrade === 'all' ? undefined : selectedGrade,
        bimestre: bimestre !== 'all' ? bimestre : undefined,
        añoEscolar: bimestre !== 'all' ? añoEscolar : undefined,
        fetchAll: true,
      });

      if (error) {
        toast.error('Error al cargar incidencias para exportar');
        return;
      }

      let filterText = `Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`;
      if (selectedLevel !== 'all') filterText += ` · Nivel: ${selectedLevel}`;
      if (selectedGrade !== 'all') filterText += ` · Grado: ${selectedGrade}`;
      if (bimestre !== 'all') {
        const b = getAllBimestres(añoEscolar).find((x) => x.numero === bimestre);
        if (b) filterText += ` · ${formatBimestreLabel(b)}`;
      }

      const levelItemsForExport = stats
        ? [
            { level: 'Nivel 0 - Sin reincidencias', count: stats.levelDistribution.level0 },
            { level: 'Nivel 1 - Primera reincidencia', count: stats.levelDistribution.level1 },
            { level: 'Nivel 2 - Reincidencia moderada', count: stats.levelDistribution.level2 },
            { level: 'Nivel 3 - Reincidencia alta', count: stats.levelDistribution.level3 },
            { level: 'Nivel 4 - Reincidencia crítica', count: stats.levelDistribution.level4 },
          ]
        : [];

      const { exportIncidentsReportExcel } = await import('@/lib/utils/excelReportExports');
      await exportIncidentsReportExcel(stats, incidentsList, {
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
  const filteredIncidentsByGrade = (stats?.incidentsByGrade || []).filter((item) => {
    const matchesGrade = selectedGrade === 'all' || item.grade === selectedGrade;
    const matchesLevel = selectedLevel === 'all' || item.level === selectedLevel;
    return matchesGrade && matchesLevel;
  });

  // Filter level distribution by severity focus
  const levelItems = stats
    ? [
        { level: 'Nivel 0 - Sin reincidencias', key: 'level0' as const, count: stats.levelDistribution.level0, severity: 'low' },
        { level: 'Nivel 1 - Primera reincidencia', key: 'level1' as const, count: stats.levelDistribution.level1, severity: 'moderate' },
        { level: 'Nivel 2 - Reincidencia moderada', key: 'level2' as const, count: stats.levelDistribution.level2, severity: 'moderate' },
        { level: 'Nivel 3 - Reincidencia alta', key: 'level3' as const, count: stats.levelDistribution.level3, severity: 'critical' },
        { level: 'Nivel 4 - Reincidencia crítica', key: 'level4' as const, count: stats.levelDistribution.level4, severity: 'critical' },
      ]
    : [];

  const filteredLevelItems = levelItems.filter((item) => {
    if (severityFilter === 'all') return true;
    if (severityFilter === 'moderate') return item.severity === 'moderate';
    if (severityFilter === 'critical') return item.severity === 'critical';
    return true;
  });

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
        description="Ajuste el alcance del análisis y exporte"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
              <Calendar className="mr-2 h-4 w-4" />
              {isFetching ? 'Cargando…' : 'Actualizar'}
            </Button>
            <Button onClick={exportToPDF} disabled={!stats} variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button onClick={exportToExcel} disabled={!stats} variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <Label>Nivel</Label>
        <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as 'all' | EducationalLevel)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los niveles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles</SelectItem>
            <SelectItem value="Primaria">Primaria</SelectItem>
            <SelectItem value="Secundaria">Secundaria</SelectItem>
          </SelectContent>
        </Select>
        </div>
        <div className="space-y-2">
          <Label>Grado</Label>
        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los grados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grados</SelectItem>
            <SelectItem value="1ro">1ro</SelectItem>
            <SelectItem value="2do">2do</SelectItem>
            <SelectItem value="3ro">3ro</SelectItem>
            <SelectItem value="4to">4to</SelectItem>
            <SelectItem value="5to">5to</SelectItem>
            <SelectItem value="6to">6to</SelectItem>
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
      </StaffToolbar>

      <div className="app-kpi-grid">
        <StaffKpiStat
          label="Total incidencias"
          value={stats.totalIncidents}
          icon={TrendingUp}
          tone="primary"
        />
        <StaffKpiStat
          label="Estudiantes"
          value={stats.studentsWithIncidents}
          icon={Users}
          tone="accent"
        />
        <StaffKpiStat
          label="Nivel promedio"
          value={stats.averageReincidenceLevel.toFixed(1)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StaffKpiStat
          label="Casos críticos"
          value={stats.levelDistribution.level3 + stats.levelDistribution.level4}
          icon={AlertTriangle}
          tone="secondary"
        />
      </div>

      {/* Charts y detalle */}
      {/* Tendencia mensual a ancho completo */}
      <Card className="app-card">
        <CardHeader className="app-card-header">
          <CardTitle className="app-section-title">Tendencia Mensual</CardTitle>
        </CardHeader>
          <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="incidents" 
                stroke="#3b82f6" 
                strokeWidth={3}
                name="Incidencias"
                dot={{ fill: '#1e40af', r: 5 }}
                activeDot={{ r: 7 }}
                fill="url(#colorIncidents)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fila: Incidencias por día vs por grado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Incidencias por Día (Esta Semana)</CardTitle>
          </CardHeader>
            <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="url(#colorBar)" name="Incidencias" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">
              Incidencias por Nivel / Grado
              {(selectedLevel !== 'all' || selectedGrade !== 'all') && (
                <>
                  {' '}
                  - {selectedLevel !== 'all' ? selectedLevel : 'Todos'}{' '}
                  {selectedGrade !== 'all' ? selectedGrade : ''}
                </>
              )}
            </CardTitle>
          </CardHeader>
            <CardContent className="pt-6">
            {filteredIncidentsByGrade.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredIncidentsByGrade} layout="vertical">
                    <defs>
                      <linearGradient id="colorGrade" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#1e40af" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" />
                    <YAxis dataKey="label" type="category" width={180} stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="url(#colorGrade)" name="Incidencias" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No hay datos para el filtro seleccionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila: Distribución de niveles vs faltas más frecuentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Distribución por Nivel de Reincidencia</CardTitle>
          </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-5">
              {filteredLevelItems.map((item, index) => (
                <div key={item.key} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">{item.level}</span>
                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 shadow-inner overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-500 group-hover:shadow-lg"
                      style={{
                        width: `${stats.totalIncidents > 0 ? (item.count / stats.totalIncidents) * 100 : 0}%`,
                        background:
                          item.severity === 'low'
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : item.severity === 'moderate'
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : 'linear-gradient(90deg, #ef4444, #dc2626)'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Faltas Más Frecuentes</CardTitle>
          </CardHeader>
            <CardContent className="pt-6">
            {stats.topFaults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay datos disponibles
              </div>
            ) : (
                <div className="space-y-5">
                  {stats.topFaults.map((fault, index) => {
                    const colors = [
                      'bg-blue-500',
                      'bg-purple-500',
                      'bg-amber-500',
                      'bg-indigo-500',
                      'bg-pink-500'
                    ];
                    return (
                      <div key={index} className="flex items-center gap-4 group">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${colors[index % colors.length]} text-white font-bold shadow-md group-hover:shadow-lg transition-all`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-700">{fault.faultType}</span>
                            <span className="font-bold text-sm text-gray-900">{fault.count} incidencias</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-3 shadow-inner overflow-hidden">
                            <div
                              className={`${colors[index % colors.length]} h-3 rounded-full transition-all duration-500 group-hover:shadow-lg`}
                              style={{ 
                                width: `${stats.topFaults.length > 0 && stats.topFaults[0].count > 0 
                                  ? (fault.count / stats.topFaults[0].count) * 100 
                                  : 0}%` 
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-500 min-w-[45px] text-right">
                          {stats.totalIncidents > 0 ? ((fault.count / stats.totalIncidents) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}
            </CardContent>
          </Card>
        </div>

      {/* Cuadros Comparativos */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Comparativas por Grado y Sección
        </h2>

        {/* Comparativa por Grados */}
        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Comparativa por Grados</CardTitle>
          </CardHeader>
            <CardContent className="pt-6">
              {comparisonByGrade.length > 0 ? (
                <div className="space-y-6">
                  {/* Gráfico de barras comparativo */}
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={comparisonByGrade}>
                      <defs>
                        <linearGradient id="colorGradeComparison" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                          <stop offset="100%" stopColor="#1e40af" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="label" 
                        stroke="#6b7280" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '8px' 
                        }}
                        formatter={(value: any) => [value, 'Incidencias']}
                      />
                      <Legend />
                      <Bar 
                        dataKey="totalIncidents" 
                        fill="url(#colorGradeComparison)" 
                        name="Total Incidencias"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar 
                        dataKey="studentsWithIncidents" 
                        fill="#f59e0b" 
                        name="Estudiantes Involucrados"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Tabla comparativa detallada */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-4 py-3 text-left text-sm font-bold text-gray-900">Grado</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Total Incidencias</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Estudiantes Involucrados</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel Promedio</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel 0</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel 1</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel 2</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel 3</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel 4</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonByGrade.map((item, index) => (
                          <tr 
                            key={index} 
                            className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          >
                            <td className="border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
                              {item.label}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">
                              {item.totalIncidents}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm text-gray-700">
                              {item.studentsWithIncidents}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-blue-600">
                              {item.averageReincidence.toFixed(2)}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm text-green-600">
                              {item.levelDistribution.level0}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm text-yellow-600">
                              {item.levelDistribution.level1}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm text-orange-600">
                              {item.levelDistribution.level2}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm text-red-600">
                              {item.levelDistribution.level3}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-red-700">
                              {item.levelDistribution.level4}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No hay datos para comparar
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comparativa por Secciones */}
          <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Comparativa por Secciones</CardTitle>
          </CardHeader>
            <CardContent className="pt-6">
              {comparisonBySection.length > 0 ? (
                <div className="space-y-6">
                  {/* Gráfico de barras comparativo */}
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={comparisonBySection}>
                      <defs>
                        <linearGradient id="colorSectionComparison" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.7}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="label" 
                        stroke="#6b7280" 
                        angle={-45}
                        textAnchor="end"
                        height={120}
                      />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '8px' 
                        }}
                        formatter={(value: any) => [value, 'Incidencias']}
                      />
                      <Legend />
                      <Bar 
                        dataKey="totalIncidents" 
                        fill="url(#colorSectionComparison)" 
                        name="Total Incidencias"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar 
                        dataKey="studentsWithIncidents" 
                        fill="#3b82f6" 
                        name="Estudiantes Involucrados"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Tabla comparativa detallada */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-4 py-3 text-left text-sm font-bold text-gray-900">Sección</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Total Incidencias</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Estudiantes Involucrados</th>
                          <th className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">Nivel Promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonBySection.map((item, index) => (
                          <tr 
                            key={index} 
                            className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          >
                            <td className="border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">
                              {item.label}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm font-bold text-gray-900">
                              {item.totalIncidents}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm text-gray-700">
                              {item.studentsWithIncidents}
                            </td>
                            <td className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-blue-600">
                              {item.averageReincidence.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No hay datos para comparar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
};