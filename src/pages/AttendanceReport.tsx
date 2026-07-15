import { useEffect, useMemo, useState, useRef } from 'react';
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
import { arrivalService } from '@/lib/services';
import { EducationalLevel, MonthlyAttendanceRow } from '@/types';
import {
  Loader2,
  Printer,
  FileDown,
  FileSpreadsheet,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  addBrandedExcelHeader,
  addExcelWatermark,
  createWorkbook,
  defaultExportFilename,
  runExcelExport,
  saveWorkbook,
  setColumnWidths,
} from '@/lib/utils/excelExport';
import { buildAttendanceDetailSheet } from '@/lib/utils/excelListExports';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import { REPORT_LOGO_PATH } from '@/lib/utils/reportLogo';
import { getCurrentSchoolYear, getAllBimestres, formatBimestreLabel, type Bimestre } from '@/lib/utils/bimestreUtils';
import { CLASSROOM_GRADES, CLASSROOM_SECTIONS, CLASSROOM_LEVELS } from '@/lib/constants/classrooms';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const TABLE_PAGE_SIZE = 25;

const statusMap: Record<string, { label: string; className: string; description: string }> = {
  A_tiempo: { label: 'A', className: 'bg-emerald-100 text-emerald-700', description: 'A tiempo' },
  Tarde: { label: 'T', className: 'bg-amber-100 text-amber-700', description: 'Tardanza' },
  Justificada: { label: 'J', className: 'bg-blue-100 text-blue-700', description: 'Justificada' },
  Injustificada: { label: 'I', className: 'bg-rose-100 text-rose-700', description: 'Injustificada' },
  Sin_registro: { label: '—', className: 'text-muted-foreground', description: 'Sin registro' },
};

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function filtersAreComplete(
  reportType: 'monthly' | 'bimestral',
  bimestre: Bimestre | 'all',
  levelFilter: 'all' | EducationalLevel,
  gradeFilter: 'all' | string,
  sectionFilter: 'all' | string,
): boolean {
  if (levelFilter === 'all' || gradeFilter === 'all' || sectionFilter === 'all') {
    return false;
  }
  if (reportType === 'bimestral' && bimestre === 'all') {
    return false;
  }
  return true;
}

export const AttendanceReport = () => {
  const [reportType, setReportType] = useState<'monthly' | 'bimestral'>('monthly');
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [bimestre, setBimestre] = useState<Bimestre | 'all'>('all');
  const [añoEscolar, setAñoEscolar] = useState<number>(getCurrentSchoolYear());
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [rows, setRows] = useState<MonthlyAttendanceRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState<number>(new Date().getDate());
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const isMountedRef = useRef(true);

  const filtersReady = filtersAreComplete(
    reportType,
    bimestre,
    levelFilter,
    gradeFilter,
    sectionFilter,
  );

  const fetchReport = async () => {
    if (!isMountedRef.current) return;

    if (!filtersReady) {
      toast.error('Seleccione nivel, grado y sección antes de consultar');
      return;
    }

    setLoading(true);
    try {
      if (reportType === 'bimestral') {
        if (bimestre === 'all') {
          toast.error('Por favor selecciona un bimestre');
          if (isMountedRef.current) {
            setLoading(false);
          }
          return;
        }
        
        const { rows: reportRows, daysInBimestre: totalDays, error } = await arrivalService.getBimestralAttendance({
          bimestre: bimestre,
          añoEscolar: añoEscolar,
          level: levelFilter === 'all' ? undefined : levelFilter,
          grade: gradeFilter === 'all' ? undefined : gradeFilter,
          section: sectionFilter === 'all' ? undefined : sectionFilter,
        });

        if (!isMountedRef.current) return;

        if (error) {
          toast.error(error);
          setRows([]);
          setDaysInMonth(0);
          setHasQueried(false);
        } else {
          setRows(reportRows);
          setDaysInMonth(totalDays);
          setHasQueried(true);
          setCurrentPage(1);
        }
      } else {
        const [yearStr, monthStr] = monthValue.split('-');
        if (!yearStr || !monthStr) {
          if (isMountedRef.current) {
            setLoading(false);
          }
          return;
        }
        
        const { rows: reportRows, daysInMonth: totalDays, error } = await arrivalService.getMonthlyAttendance({
          month: Number(monthStr),
          year: Number(yearStr),
          level: levelFilter === 'all' ? undefined : levelFilter,
          grade: gradeFilter === 'all' ? undefined : gradeFilter,
          section: sectionFilter === 'all' ? undefined : sectionFilter,
        });

        if (!isMountedRef.current) return;

        if (error) {
          toast.error(error);
          setRows([]);
          setDaysInMonth(0);
          setHasQueried(false);
        } else {
          setRows(reportRows);
          setDaysInMonth(totalDays);
          setHasQueried(true);
          setCurrentPage(1);
        }
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      toast.error(error?.message || 'Error al generar reporte');
      setRows([]);
      setDaysInMonth(0);
      setHasQueried(false);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setHasQueried(false);
    setRows([]);
    setCurrentPage(1);
  }, [reportType, monthValue, bimestre, añoEscolar, levelFilter, gradeFilter, sectionFilter]);

  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, idx) => idx + 1), [daysInMonth]);

  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * TABLE_PAGE_SIZE;
    return rows.slice(start, start + TABLE_PAGE_SIZE);
  }, [rows, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const totalsGlobal = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        onTime: acc.onTime + row.totals.onTime,
        late: acc.late + row.totals.late,
        justified: acc.justified + row.totals.justified,
        unjustified: acc.unjustified + row.totals.unjustified,
      }),
      { onTime: 0, late: 0, justified: 0, unjustified: 0 }
    );
  }, [rows]);

  const handlePrint = () => {
    if (!isMountedRef.current) return;
    window.print();
  };

  const exportToPDF = async () => {
    if (!isMountedRef.current) return;

    if (rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    try {
      toast.loading('Generando PDF...', { id: 'pdf-export' });

      const monthLabel = format(
        new Date(`${monthValue}-01T12:00:00`),
        "MMMM yyyy",
        { locale: es }
      );

      const subtitle = buildFilterSubtitle([
        `Período: ${monthLabel}`,
        `Generado ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`,
        levelFilter !== 'all' && `Nivel: ${levelFilter}`,
        gradeFilter !== 'all' && `Grado: ${gradeFilter}`,
        sectionFilter !== 'all' && `Sección: ${sectionFilter}`,
      ]);

      const doc = new PdfReportDocument(
        'landscape',
        'REPORTE MENSUAL DE ASISTENCIAS',
        subtitle
      );
      await doc.drawCoverHeader();

      doc.drawKpiCards([
        { label: 'A tiempo', value: totalsGlobal.onTime, tone: 'success' },
        { label: 'Tardanzas', value: totalsGlobal.late, tone: 'warning' },
        { label: 'Justificadas', value: totalsGlobal.justified, tone: 'info' },
        { label: 'Injustificadas', value: totalsGlobal.unjustified, tone: 'error' },
      ]);

      doc.drawParagraph(
        'Leyenda de estados: A = A tiempo · T = Tardanza · J = Justificada · I = Injustificada · — = Sin registro'
      );

      doc.drawSectionTitle('Resumen por estudiante');
      doc.drawTable(
        [
          { header: 'Estudiante', dataKey: 'student', width: 52 },
          { header: 'Nivel', dataKey: 'level', width: 22 },
          { header: 'Grado', dataKey: 'grade', width: 16 },
          { header: 'Sec.', dataKey: 'section', width: 12, align: 'center' },
          { header: 'A tiempo', dataKey: 'onTime', width: 16, align: 'center' },
          { header: 'Tardanzas', dataKey: 'late', width: 16, align: 'center' },
          { header: 'Justif.', dataKey: 'justified', width: 14, align: 'center' },
          { header: 'Injustif.', dataKey: 'unjustified', width: 14, align: 'center' },
          {
            header: '% Puntualidad',
            dataKey: 'punctuality',
            width: 22,
            align: 'right',
          },
        ],
        rows.map((row) => {
          const totalMarked =
            row.totals.onTime + row.totals.late + row.totals.justified + row.totals.unjustified;
          const punctuality =
            totalMarked > 0 ? Math.round((row.totals.onTime / totalMarked) * 100) : 0;
          return {
            student: row.student.fullName,
            level: row.student.level,
            grade: row.student.grade,
            section: row.student.section,
            onTime: String(row.totals.onTime),
            late: String(row.totals.late),
            justified: String(row.totals.justified),
            unjustified: String(row.totals.unjustified),
            punctuality: `${punctuality}%`,
          };
        }),
        { fontSize: 8 }
      );

      if (daysArray.length <= 28) {
        doc.drawSectionTitle('Registro diario del mes');
        doc.drawParagraph(
          'Matriz de asistencia por día. Para el detalle completo exporte también el archivo Excel.'
        );

        const dayLabel = (d: number) => String(d);
        const dayColumns = daysArray.map((day) => ({
          header: dayLabel(day),
          dataKey: `d${day}`,
          width: 6,
          align: 'center' as const,
        }));

        const statusChar = (status: string) => {
          const info = statusMap[status] || statusMap.Sin_registro;
          return info.label === '—' ? '·' : info.label;
        };

        doc.drawTable(
          [
            { header: 'Estudiante', dataKey: 'student', width: 40 },
            ...dayColumns,
            { header: 'A', dataKey: 'onTime', width: 8, align: 'center' },
            { header: 'T', dataKey: 'late', width: 8, align: 'center' },
          ],
          rows.map((row) => {
            const record: Record<string, string> = {
              student:
                row.student.fullName.length > 22
                  ? `${row.student.fullName.slice(0, 20)}…`
                  : row.student.fullName,
              onTime: String(row.totals.onTime),
              late: String(row.totals.late),
            };
            row.days.forEach((day) => {
              record[`d${day.day}`] = statusChar(day.status);
            });
            return record;
          }),
          { fontSize: 6 }
        );
      } else {
        doc.drawParagraph(
          'El mes tiene muchos días para mostrar la matriz diaria en PDF. Use Exportar Excel para el calendario completo.'
        );
      }

      const fileName = `Reporte_Asistencias_${monthValue.replace('-', '_')}.pdf`;
      await doc.finalize(fileName);

      if (!isMountedRef.current) return;
      toast.success('PDF generado exitosamente', { id: 'pdf-export' });
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error al generar PDF:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al generar PDF: ${message}`, { id: 'pdf-export' });
    }
  };

  const exportToExcel = async () => {
    if (!isMountedRef.current) return;
    if (rows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const filterParts = [`Mes: ${monthValue}`];
    if (levelFilter !== 'all') filterParts.push(`Nivel: ${levelFilter}`);
    if (gradeFilter !== 'all') filterParts.push(`Grado: ${gradeFilter}`);
    if (sectionFilter !== 'all') filterParts.push(`Sección: ${sectionFilter}`);

    await runExcelExport('reporte de asistencias', async () => {
      const workbook = createWorkbook('Reporte de asistencias');
      await buildAttendanceDetailSheet(
        workbook,
        'Asistencias',
        'REPORTE MENSUAL DE ASISTENCIAS',
        filterParts.join(' · '),
        daysArray,
        rows,
        totalsGlobal
      );

      const summarySheet = workbook.addWorksheet('Resumen');
      await addBrandedExcelHeader(
        workbook,
        summarySheet,
        'RESUMEN GLOBAL',
        filterParts.join(' · '),
        2
      );
      summarySheet.addRow(['Concepto', 'Cantidad']);
      summarySheet.addRow(['A tiempo', totalsGlobal.onTime]);
      summarySheet.addRow(['Tardanzas', totalsGlobal.late]);
      summarySheet.addRow(['Justificadas', totalsGlobal.justified]);
      summarySheet.addRow(['Injustificadas', totalsGlobal.unjustified]);
      setColumnWidths(summarySheet, [22, 14]);
      await addExcelWatermark(workbook, summarySheet, { mergeCols: 2, centerRow: 10 });

      await saveWorkbook(
        workbook,
        defaultExportFilename(`Asistencias_${monthValue.replace('-', '_')}`)
      );
    });
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5 print:opacity-15">
        <img src={REPORT_LOGO_PATH} alt="Guardy" className="max-w-[50%] rounded-2xl opacity-10" />
      </div>
      <style>
        {`@media print {
            @page { size: landscape; margin: 12mm; }
            body * {
              visibility: hidden;
            }
            #attendance-report, #attendance-report * {
              visibility: visible;
            }
            #attendance-report {
              position: absolute;
              inset: 0;
              margin: 0;
              width: 100%;
              background: white;
            }
            #attendance-report .print-hidden {
              display: none !important;
            }
          }`}
      </style>
      <div id="attendance-report" className="app-page app-page-shell relative z-10 space-y-6">
        <PageHeader
          icon={Calendar}
          eyebrow="Reportes"
          title="Reporte de Asistencias"
          description={
            reportType === 'monthly'
              ? 'Resumen mensual por estudiante: tardanzas, faltas y justificaciones.'
              : bimestre !== 'all'
                ? `Bimestre: ${formatBimestreLabel(getAllBimestres(añoEscolar).find(b => b.numero === bimestre)!)}`
                : 'Consolidado de asistencia según el bimestre seleccionado.'
          }
          accent="success"
          className="print-hidden"
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fetchReport();
              }}
              disabled={loading || !filtersReady || !hasQueried}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cargando
                </>
              ) : (
                'Actualizar'
              )}
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePrint();
              }}
              variant="ghost"
              disabled={rows.length === 0 || !hasQueried}
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                exportToPDF();
              }}
              variant="ghost"
              disabled={rows.length === 0 || !hasQueried}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                exportToExcel();
              }}
              variant="ghost"
              disabled={rows.length === 0 || !hasQueried}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </PageHeader>

        <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
          <StaffKpiStat
            label="Estudiantes"
            value={hasQueried ? rows.length : '—'}
            hint={
              hasQueried
                ? reportType === 'monthly'
                  ? `Mes ${monthValue}`
                  : `Año ${añoEscolar}`
                : 'Seleccione filtros y consulte'
            }
            icon={Users}
            tone="info"
          />
          <StaffKpiStat
            label="A tiempo"
            value={hasQueried ? totalsGlobal.onTime : '—'}
            hint="Llegadas puntuales"
            hintIcon={CheckCircle2}
            icon={CheckCircle2}
            tone="success"
          />
          <StaffKpiStat
            label="Tardanzas"
            value={hasQueried ? totalsGlobal.late : '—'}
            hint="Registros con retraso"
            hintIcon={Clock}
            icon={Clock}
            tone="warning"
          />
          <StaffKpiStat
            label="Injustificadas"
            value={hasQueried ? totalsGlobal.unjustified : '—'}
            hint={hasQueried ? `${totalsGlobal.justified} justificadas` : 'Sin consulta aún'}
            hintIcon={XCircle}
            icon={AlertTriangle}
            tone="accent"
          />
        </div>

        <StaffToolbar
          className="print-hidden"
          title="Filtros del reporte"
          description="Seleccione nivel, grado y sección; luego pulse Consultar para cargar la planilla"
          footer={
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(statusMap).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold ${value.className}`}
                  >
                    {value.label}
                  </span>
                  <span className="text-muted-foreground">{value.description}</span>
                </div>
              ))}
            </div>
          }
        >
          <div className="space-y-2">
            <Label>Tipo de reporte</Label>
            <Select value={reportType} onValueChange={(value: 'monthly' | 'bimestral') => setReportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="bimestral">Bimestral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reportType === 'monthly' ? (
            <div className="space-y-2">
              <Label htmlFor="attendance-month">Mes</Label>
              <Input
                id="attendance-month"
                type="month"
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="attendance-year">Año escolar</Label>
                <Input
                  id="attendance-year"
                  type="number"
                  value={añoEscolar}
                  onChange={(e) => setAñoEscolar(Number(e.target.value))}
                  min={2020}
                  max={2050}
                />
              </div>
              <div className="space-y-2">
                <Label>Bimestre</Label>
                <Select
                  value={bimestre === 'all' ? 'all' : String(bimestre)}
                  onValueChange={(value) =>
                    setBimestre(value === 'all' ? 'all' : (Number(value) as Bimestre))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar bimestre" />
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
            </>
          )}
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select
              value={levelFilter}
              onValueChange={(value) => setLevelFilter(value as 'all' | EducationalLevel)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CLASSROOM_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grado</Label>
            <Select value={gradeFilter} onValueChange={(value) => setGradeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CLASSROOM_GRADES.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sección</Label>
            <Select value={sectionFilter} onValueChange={(value) => setSectionFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {CLASSROOM_SECTIONS.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={loading || !filtersReady} onClick={fetchReport}>
              {loading ? 'Cargando...' : 'Consultar'}
            </Button>
          </div>
          {!filtersReady && (
            <p className="col-span-full text-sm text-muted-foreground">
              Indique nivel, grado y sección para habilitar la consulta
              {reportType === 'bimestral' ? ' y seleccione un bimestre' : ''}.
            </p>
          )}
        </StaffToolbar>

        <StaffDataPanel>
          <StaffDataPanelHeader
            accent="success"
            title={reportType === 'monthly' ? 'Planilla mensual' : 'Planilla bimestral'}
            description={
              !hasQueried
                ? 'Configure los filtros y pulse Consultar'
                : rows.length > TABLE_PAGE_SIZE
                  ? `${rows.length} estudiantes · página ${currentPage} de ${totalPages} · ${TABLE_PAGE_SIZE} por página · ${daysInMonth} días`
                  : `${rows.length} estudiantes · ${daysInMonth} días en el período`
            }
          />
          <div className="p-4 pt-0 sm:p-5 sm:pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Cargando asistencias...
              </div>
            ) : !hasQueried ? (
              <StaffEmptyState
                icon={Calendar}
                title="Sin consulta realizada"
                description="Elija nivel, grado y sección, luego pulse Consultar para generar la planilla del período"
              />
            ) : rows.length === 0 ? (
              <StaffEmptyState
                icon={Calendar}
                title="Sin datos para mostrar"
                description="No hay estudiantes o registros de asistencia con los filtros seleccionados"
              />
            ) : (
              <>
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-[960px] text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-center text-muted-foreground">
                      <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left align-middle">
                        Estudiante
                      </th>
                      {daysArray.map((day) => (
                        <th key={day} className="min-w-[32px] px-2 py-2">
                          {day}
                        </th>
                      ))}
                      <th className="min-w-[48px] px-2 py-2">A</th>
                      <th className="min-w-[48px] px-2 py-2">T</th>
                      <th className="min-w-[48px] px-2 py-2">J</th>
                      <th className="min-w-[48px] px-2 py-2">I</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.student.id} className="border-t">
                        <td className="sticky left-0 bg-background px-3 py-2 text-sm font-medium">
                          <div>{row.student.fullName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.student.level} • {row.student.grade} {row.student.section}
                          </div>
                        </td>
                        {row.days.map((day) => {
                          const info = statusMap[day.status] || statusMap.Sin_registro;
                          return (
                            <td key={day.day} className="px-1 py-2 text-center">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold ${info.className}`}
                              >
                                {info.label}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-semibold text-emerald-700">
                          {row.totals.onTime}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-amber-700">
                          {row.totals.late}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-blue-700">
                          {row.totals.justified}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-rose-700">
                          {row.totals.unjustified}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > TABLE_PAGE_SIZE && (
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
                          Math.abs(p - currentPage) <= 1,
                      )
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <span key={page} className="contents">
                            {prev !== undefined && page - prev > 1 && (
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
              </>
            )}
          </div>
        </StaffDataPanel>
      </div>
    </div>
  );
};

