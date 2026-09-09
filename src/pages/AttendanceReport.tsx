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
import { EducationalLevel, MonthlyAttendanceRow, Student } from '@/types';
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
import { CLASSROOM_FIELD_LABELS, CLASSROOM_GRADES, CLASSROOM_SECTIONS, CLASSROOM_LEVELS } from '@/lib/constants/classrooms';
import { StudentSearchCombobox } from '@/components/students/StudentSearchCombobox';
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
  Tarde_justificada: { label: 'TJ', className: 'bg-sky-100 text-sky-800', description: 'Tarde justificada' },
  Inasistencia_justificada: { label: 'IJ', className: 'bg-violet-100 text-violet-800', description: 'Inasistencia justificada' },
  Justificada: { label: 'TJ', className: 'bg-sky-100 text-sky-800', description: 'Tarde justificada' },
  Injustificada: { label: 'I', className: 'bg-rose-100 text-rose-700', description: 'Injustificada (legado)' },
  Sin_registro: { label: '—', className: 'text-muted-foreground', description: 'Sin registro' },
};

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function filtersAreComplete(
  selectedStudent: Student | null,
  reportType: 'monthly' | 'bimestral',
  bimestre: Bimestre | 'all',
  levelFilter: 'all' | EducationalLevel,
  gradeFilter: 'all' | string,
  sectionFilter: 'all' | string,
): boolean {
  if (reportType === 'bimestral' && bimestre === 'all') {
    return false;
  }
  if (selectedStudent != null) return true;
  if (levelFilter === 'all' || gradeFilter === 'all' || sectionFilter === 'all') {
    return false;
  }
  return true;
}

function narrowAttendanceToStudent(
  reportRows: MonthlyAttendanceRow[],
  studentId: number | null,
): MonthlyAttendanceRow[] {
  if (studentId == null) return reportRows;
  return reportRows.filter((row) => row.student.id === studentId);
}

export const AttendanceReport = () => {
  const [reportType, setReportType] = useState<'monthly' | 'bimestral'>('monthly');
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [bimestre, setBimestre] = useState<Bimestre | 'all'>('all');
  const [añoEscolar, setAñoEscolar] = useState<number>(getCurrentSchoolYear());
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [rows, setRows] = useState<MonthlyAttendanceRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState<number>(new Date().getDate());
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const isMountedRef = useRef(true);

  const filtersReady = filtersAreComplete(
    selectedStudent,
    reportType,
    bimestre,
    levelFilter,
    gradeFilter,
    sectionFilter,
  );

  const fetchReport = async () => {
    if (!isMountedRef.current) return;

    if (!filtersReady) {
      toast.error(
        selectedStudent
          ? 'Seleccione un bimestre para consultar'
          : 'Seleccione un estudiante de la lista o nivel, grado y sección',
      );
      return;
    }

    setLoading(true);
    try {
      const classroomLevel = selectedStudent
        ? selectedStudent.level
        : levelFilter === 'all'
          ? undefined
          : levelFilter;
      const classroomGrade = selectedStudent
        ? selectedStudent.grade
        : gradeFilter === 'all'
          ? undefined
          : gradeFilter;
      const classroomSection = selectedStudent
        ? selectedStudent.section
        : sectionFilter === 'all'
          ? undefined
          : sectionFilter;

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
          level: classroomLevel,
          grade: classroomGrade,
          section: classroomSection,
        });

        if (!isMountedRef.current) return;

        if (error) {
          toast.error(error);
          setRows([]);
          setDaysInMonth(0);
          setHasQueried(false);
        } else {
          setRows(narrowAttendanceToStudent(reportRows, selectedStudent?.id ?? null));
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
          level: classroomLevel,
          grade: classroomGrade,
          section: classroomSection,
        });

        if (!isMountedRef.current) return;

        if (error) {
          toast.error(error);
          setRows([]);
          setDaysInMonth(0);
          setHasQueried(false);
        } else {
          setRows(narrowAttendanceToStudent(reportRows, selectedStudent?.id ?? null));
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
  }, [reportType, monthValue, bimestre, añoEscolar, levelFilter, gradeFilter, sectionFilter, selectedStudent?.id]);

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
        lateJustified: acc.lateJustified + row.totals.lateJustified,
        absentJustified: acc.absentJustified + row.totals.absentJustified,
        justified: acc.justified + row.totals.justified,
        unjustified: acc.unjustified + row.totals.unjustified,
      }),
      { onTime: 0, late: 0, lateJustified: 0, absentJustified: 0, justified: 0, unjustified: 0 }
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
        selectedStudent && `Estudiante: ${selectedStudent.fullName}`,
        !selectedStudent && levelFilter !== 'all' && `Nivel: ${levelFilter}`,
        !selectedStudent && gradeFilter !== 'all' && `${CLASSROOM_FIELD_LABELS.grade}: ${gradeFilter}`,
        !selectedStudent && sectionFilter !== 'all' && `${CLASSROOM_FIELD_LABELS.section}: ${sectionFilter}`,
      ]);

      const doc = new PdfReportDocument(
        'landscape',
        selectedStudent ? 'REPORTE DE ASISTENCIAS DEL ESTUDIANTE' : 'REPORTE MENSUAL DE ASISTENCIAS',
        subtitle
      );
      await doc.drawCoverHeader();

      doc.drawKpiCards([
        { label: 'A tiempo', value: totalsGlobal.onTime, tone: 'success' },
        { label: 'Tardanzas', value: totalsGlobal.late, tone: 'warning' },
        { label: 'TJ', value: totalsGlobal.lateJustified, tone: 'info' },
        { label: 'IJ', value: totalsGlobal.absentJustified, tone: 'error' },
      ]);

      doc.drawParagraph(
        'Leyenda de estados: A = A tiempo · T = Tardanza · TJ = Tarde justificada · IJ = Inasistencia justificada · — = Sin registro'
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
          { header: 'TJ', dataKey: 'lateJustified', width: 14, align: 'center' },
          { header: 'IJ', dataKey: 'absentJustified', width: 14, align: 'center' },
          {
            header: '% Puntualidad',
            dataKey: 'punctuality',
            width: 22,
            align: 'right',
          },
        ],
        rows.map((row) => {
          const totalMarked =
            row.totals.onTime +
            row.totals.late +
            row.totals.lateJustified +
            row.totals.absentJustified +
            row.totals.justified +
            row.totals.unjustified;
          const punctuality =
            totalMarked > 0 ? Math.round((row.totals.onTime / totalMarked) * 100) : 0;
          return {
            student: row.student.fullName,
            level: row.student.level,
            grade: row.student.grade,
            section: row.student.section,
            onTime: String(row.totals.onTime),
            late: String(row.totals.late),
            lateJustified: String(row.totals.lateJustified),
            absentJustified: String(row.totals.absentJustified),
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
    if (selectedStudent) filterParts.push(`Estudiante: ${selectedStudent.fullName}`);
    if (!selectedStudent && levelFilter !== 'all') filterParts.push(`Nivel: ${levelFilter}`);
    if (!selectedStudent && gradeFilter !== 'all') filterParts.push(`${CLASSROOM_FIELD_LABELS.grade}: ${gradeFilter}`);
    if (!selectedStudent && sectionFilter !== 'all') filterParts.push(`${CLASSROOM_FIELD_LABELS.section}: ${sectionFilter}`);

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
      summarySheet.addRow(['Tarde justificada (TJ)', totalsGlobal.lateJustified]);
      summarySheet.addRow(['Inasistencia justificada (IJ)', totalsGlobal.absentJustified]);
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
            label="TJ / IJ"
            value={hasQueried ? `${totalsGlobal.lateJustified} / ${totalsGlobal.absentJustified}` : '—'}
            hint="Tarde justificada / Inasistencia justificada"
            hintIcon={CheckCircle2}
            icon={AlertTriangle}
            tone="accent"
          />
        </div>

        <StaffToolbar
          className="print-hidden"
          title="Filtros del reporte"
          description="Seleccione un estudiante de la lista o elija nivel, grado y sección; luego pulse Consultar"
          footer={
            <div className="flex flex-wrap gap-4 text-sm">
              {['A_tiempo', 'Tarde', 'Tarde_justificada', 'Inasistencia_justificada', 'Sin_registro'].map((key) => {
                const value = statusMap[key];
                return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-0.5 text-[11px] font-semibold ${value.className}`}
                  >
                    {value.label}
                  </span>
                  <span className="text-muted-foreground">{value.description}</span>
                </div>
                );
              })}
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="attendance-student-search">Buscar estudiante</Label>
            <StudentSearchCombobox
              id="attendance-student-search"
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
              value={levelFilter}
              disabled={selectedStudent != null}
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
            <Label>{CLASSROOM_FIELD_LABELS.grade}</Label>
            <Select value={gradeFilter} disabled={selectedStudent != null} onValueChange={(value) => setGradeFilter(value)}>
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
            <Label>{CLASSROOM_FIELD_LABELS.section}</Label>
            <Select value={sectionFilter} disabled={selectedStudent != null} onValueChange={(value) => setSectionFilter(value)}>
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
              Indique un estudiante de la lista o nivel, grado y sección para habilitar la consulta
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
                description="Seleccione un estudiante de la lista o elija nivel, grado y sección, luego pulse Consultar para generar la planilla del período"
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
                      <th className="min-w-[48px] px-2 py-2">TJ</th>
                      <th className="min-w-[48px] px-2 py-2">IJ</th>
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
                            <td
                              key={day.day}
                              className="px-1 py-2 text-center"
                              title={day.justificationReason || info.description}
                            >
                              <span
                                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-0.5 text-[11px] font-semibold ${info.className}`}
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
                        <td className="px-2 py-2 text-center font-semibold text-sky-800">
                          {row.totals.lateJustified}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-violet-800">
                          {row.totals.absentJustified}
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

