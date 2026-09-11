import { useEffect, useMemo, useRef, useState } from 'react';
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
import { arrivalService, studentsService } from '@/lib/services';
import { assembleIntegralBlocks, type IntegralStudentBlock } from '@/lib/services/integralReportService';
import { EducationalLevel, Student } from '@/types';
import {
  Loader2,
  FileDown,
  FileSpreadsheet,
  Layers,
  Users,
  AlertTriangle,
  Wallet,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffSegmentedControl,
} from '@/components/staff';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  addBrandedExcelHeader,
  createWorkbook,
  defaultExportFilename,
  runExcelExport,
  saveWorkbook,
  setColumnWidths,
  styleHeaderRow,
} from '@/lib/utils/excelExport';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import {
  getCurrentSchoolYear,
  getAllBimestres,
  formatBimestreLabel,
  getBimestreDates,
  type Bimestre,
} from '@/lib/utils/bimestreUtils';
import { CLASSROOM_FIELD_LABELS, CLASSROOM_GRADES, CLASSROOM_SECTIONS, CLASSROOM_LEVELS } from '@/lib/constants/classrooms';
import { StudentSearchCombobox } from '@/components/students/StudentSearchCombobox';
import { monthDateKeys, rangeDateKeys } from '@/lib/utils/attendanceTurno';
import { isNotasEnabled, isPensionesEnabled } from '@/config/features';

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const PDF_DETAIL_LIMIT = 8;

function attendanceStatusLabel(status: string): string {
  if (status === 'A_tiempo' || status === 'A tiempo') return 'A tiempo';
  if (status === 'Tarde') return 'Tardanza';
  if (status === 'Tarde_justificada' || status === 'Tarde justificada' || status === 'Justificada') {
    return 'Tardanza justificada (TJ)';
  }
  if (status === 'Inasistencia_justificada' || status === 'Falta justificada') {
    return 'Inasistencia justificada (IJ)';
  }
  if (status === 'Injustificada') return 'Inasistencia (falto)';
  return status.replace('_', ' ');
}

export const IntegralStudentReport = () => {
  const [mode, setMode] = useState<'individual' | 'general'>('individual');
  const [reportType, setReportType] = useState<'monthly' | 'bimestral'>('monthly');
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [bimestre, setBimestre] = useState<Bimestre | 'all'>('all');
  const [añoEscolar, setAñoEscolar] = useState<number>(getCurrentSchoolYear());
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [blocks, setBlocks] = useState<IntegralStudentBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const isMountedRef = useRef(true);

  const filtersReady =
    mode === 'individual'
      ? selectedStudent != null && (reportType === 'monthly' || bimestre !== 'all')
      : levelFilter !== 'all' &&
        gradeFilter !== 'all' &&
        sectionFilter !== 'all' &&
        (reportType === 'monthly' || bimestre !== 'all');

  const periodLabel = useMemo(() => {
    if (reportType === 'monthly') {
      return format(new Date(`${monthValue}-01T12:00:00`), 'MMMM yyyy', { locale: es });
    }
    if (bimestre === 'all') return `Año ${añoEscolar}`;
    const info = getAllBimestres(añoEscolar).find((item) => item.numero === bimestre);
    return info ? formatBimestreLabel(info) : `Bimestre ${bimestre}`;
  }, [reportType, monthValue, bimestre, añoEscolar]);

  const totals = useMemo(() => {
    return blocks.reduce(
      (acc, block) => ({
        students: acc.students + 1,
        asistencias: acc.asistencias + block.summary.asistenciasManana,
        tardanzas: acc.tardanzas + block.summary.tardanzas,
        incidencias: acc.incidencias + block.summary.incidencias,
        deuda: acc.deuda + block.summary.deuda,
      }),
      { students: 0, asistencias: 0, tardanzas: 0, incidencias: 0, deuda: 0 },
    );
  }, [blocks]);

  const fetchReport = async () => {
    if (!filtersReady) {
      toast.error(
        mode === 'individual'
          ? 'Seleccione un estudiante y el período'
          : 'Seleccione nivel, grado, sección y período',
      );
      return;
    }

    setLoading(true);
    try {
      let start = '';
      let end = '';
      let dateKeys: string[] = [];
      const attendanceFilters = {
        level:
          mode === 'individual'
            ? selectedStudent?.level
            : levelFilter === 'all'
              ? undefined
              : levelFilter,
        grade:
          mode === 'individual'
            ? selectedStudent?.grade
            : gradeFilter === 'all'
              ? undefined
              : gradeFilter,
        section:
          mode === 'individual'
            ? selectedStudent?.section
            : sectionFilter === 'all'
              ? undefined
              : sectionFilter,
      };

      let morningRows;
      if (reportType === 'bimestral') {
        if (bimestre === 'all') {
          toast.error('Seleccione un bimestre');
          return;
        }
        const { inicio, fin } = getBimestreDates(bimestre, añoEscolar);
        dateKeys = rangeDateKeys(inicio, fin);
        start = dateKeys[0] ?? '';
        end = dateKeys[dateKeys.length - 1] ?? '';
        const result = await arrivalService.getBimestralAttendance({
          bimestre,
          añoEscolar,
          ...attendanceFilters,
        });
        if (result.error) throw new Error(result.error);
        morningRows = result.rows;
      } else {
        const [yearStr, monthStr] = monthValue.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const result = await arrivalService.getMonthlyAttendance({
          month,
          year,
          ...attendanceFilters,
        });
        if (result.error) throw new Error(result.error);
        dateKeys = monthDateKeys(year, month, result.daysInMonth);
        start = dateKeys[0] ?? `${monthValue}-01`;
        end = dateKeys[dateKeys.length - 1] ?? `${monthValue}-28`;
        morningRows = result.rows;
      }

      let students: Student[];
      if (mode === 'individual' && selectedStudent) {
        morningRows = morningRows.filter((row) => row.student.id === selectedStudent.id);
        students = [selectedStudent];
      } else {
        const list = await studentsService.listLite({
          active: true,
          level: attendanceFilters.level,
          grade: attendanceFilters.grade,
          section: attendanceFilters.section,
        });
        if (list.error) throw new Error(list.error);
        students = list.students;
      }

      const { blocks: nextBlocks, error } = await assembleIntegralBlocks({
        students,
        morningRows,
        start,
        end,
        dateKeys,
        estudianteId: mode === 'individual' ? selectedStudent?.id : undefined,
        level: attendanceFilters.level,
        grade: attendanceFilters.grade,
        section: attendanceFilters.section,
      });
      if (error) toast.error(error);
      if (!isMountedRef.current) return;
      setBlocks(nextBlocks);
      setHasQueried(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error(error instanceof Error ? error.message : 'Error al generar el reporte');
      setBlocks([]);
      setHasQueried(false);
    } finally {
      if (isMountedRef.current) setLoading(false);
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
    setBlocks([]);
  }, [mode, reportType, monthValue, bimestre, añoEscolar, levelFilter, gradeFilter, sectionFilter, selectedStudent?.id]);

  const subtitle = buildFilterSubtitle([
    `Período: ${periodLabel}`,
    mode === 'individual' && selectedStudent ? `Estudiante: ${selectedStudent.fullName}` : null,
    mode === 'general' && levelFilter !== 'all' && `Nivel: ${levelFilter}`,
    mode === 'general' && gradeFilter !== 'all' && `${CLASSROOM_FIELD_LABELS.grade}: ${gradeFilter}`,
    mode === 'general' && sectionFilter !== 'all' && `${CLASSROOM_FIELD_LABELS.section}: ${sectionFilter}`,
  ]);

  const exportToPDF = async () => {
    if (blocks.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      toast.loading('Generando PDF...', { id: 'integral-pdf' });
      const doc = new PdfReportDocument('portrait', 'REPORTE INTEGRAL DEL ESTUDIANTE', subtitle);
      await doc.drawCoverHeader();
      doc.drawKpiCards([
        { label: 'Estudiantes', value: totals.students, tone: 'info' },
        { label: 'Asistencias', value: totals.asistencias, tone: 'success' },
        { label: 'Tardanzas', value: totals.tardanzas, tone: 'warning' },
        { label: 'Incidencias', value: totals.incidencias, tone: 'error' },
      ]);

      doc.drawSectionTitle('Resumen por estudiante');
      doc.drawTable(
        [
          { header: 'Estudiante', dataKey: 'student', width: 52 },
          { header: 'Asist.', dataKey: 'asistencias', width: 18, align: 'center' },
          { header: 'Tard.', dataKey: 'tardanzas', width: 16, align: 'center' },
          { header: 'Faltas', dataKey: 'faltas', width: 16, align: 'center' },
          { header: 'Tarde', dataKey: 'tarde', width: 16, align: 'center' },
          { header: 'Incid.', dataKey: 'incidencias', width: 16, align: 'center' },
          { header: 'Deuda', dataKey: 'deuda', width: 22, align: 'right' },
        ],
        blocks.map((block) => ({
          student: block.student.fullName,
          asistencias: String(block.summary.asistenciasManana),
          tardanzas: String(block.summary.tardanzas),
          faltas: String(block.summary.faltas),
          tarde: String(block.summary.asistenciasTarde),
          incidencias: String(block.summary.incidencias),
          deuda: block.summary.deuda.toFixed(2),
        })),
      );

      const detailBlocks = blocks.slice(0, mode === 'individual' ? blocks.length : PDF_DETAIL_LIMIT);
      if (mode === 'general' && blocks.length > PDF_DETAIL_LIMIT) {
        doc.drawParagraph(
          `El PDF muestra el detalle de los primeros ${PDF_DETAIL_LIMIT} estudiantes. Use Excel para el consolidado completo.`,
        );
      }

      for (const block of detailBlocks) {
        doc.drawSectionTitle(block.student.fullName);
        doc.drawKeyValueList([
          { label: 'Nivel', value: block.student.level },
          { label: CLASSROOM_FIELD_LABELS.grade, value: block.student.grade },
          { label: CLASSROOM_FIELD_LABELS.section, value: block.student.section },
          { label: 'Asistencias mañana', value: String(block.summary.asistenciasManana) },
          { label: 'Tardanzas', value: String(block.summary.tardanzas) },
          { label: 'Faltas', value: String(block.summary.faltas) },
          { label: 'Asistencias tarde', value: String(block.summary.asistenciasTarde) },
          { label: 'Incidencias', value: String(block.summary.incidencias) },
          { label: 'Deuda', value: block.summary.deuda.toFixed(2) },
        ]);

        doc.drawParagraph('Asistencia mañana');
        doc.drawTable(
          [
            { header: 'Fecha', dataKey: 'date', width: 28 },
            { header: 'Ingreso', dataKey: 'arrival', width: 24 },
            { header: 'Salida', dataKey: 'departure', width: 24 },
            { header: 'Estado', dataKey: 'status', width: 36 },
          ],
          block.manana.records.map((record) => ({
            date: record.date,
            arrival: record.arrivalTime ?? '—',
            departure: record.departureTime ?? '—',
            status: attendanceStatusLabel(record.status),
          })),
        );

        doc.drawParagraph('Asistencia tarde');
        doc.drawTable(
          [
            { header: 'Fecha', dataKey: 'date', width: 28 },
            { header: 'Ingreso', dataKey: 'arrival', width: 24 },
            { header: 'Salida', dataKey: 'departure', width: 24 },
            { header: 'Estado', dataKey: 'status', width: 36 },
          ],
          block.tarde.records.map((record) => ({
            date: record.date,
            arrival: record.arrivalTime ?? '—',
            departure: record.departureTime ?? '—',
            status: attendanceStatusLabel(record.status),
          })),
        );

        doc.drawParagraph('Incidencias');
        doc.drawTable(
          [
            { header: 'Fecha', dataKey: 'date', width: 28 },
            { header: 'Falta', dataKey: 'fault', width: 50 },
            { header: 'Estado', dataKey: 'status', width: 34 },
          ],
          block.incidents.map((incident) => ({
            date: incident.registeredAt.slice(0, 10),
            fault: incident.faultType?.name ?? `Falta #${incident.faultTypeId}`,
            status: incident.status,
          })),
        );

        if (isNotasEnabled()) {
          doc.drawParagraph('Notas');
          doc.drawTable(
            [
              { header: 'Semana', dataKey: 'semana', width: 36 },
              { header: 'Área', dataKey: 'area', width: 40 },
              { header: 'Nota', dataKey: 'nota', width: 20, align: 'right' },
            ],
            block.notas.map((nota) => ({
              semana: nota.semanaEtiqueta,
              area: nota.areaNombre,
              nota: `${nota.nota}/${nota.notaMaxima}`,
            })),
          );
        }

        if (isPensionesEnabled()) {
          doc.drawParagraph('Pensiones');
          doc.drawTable(
            [
              { header: 'Periodo', dataKey: 'periodo', width: 28 },
              { header: 'Estado', dataKey: 'estado', width: 28 },
              { header: 'Monto', dataKey: 'monto', width: 24, align: 'right' },
              { header: 'Pagado', dataKey: 'pagado', width: 22, align: 'center' },
            ],
            block.pensiones.map((row) => ({
              periodo: row.periodo,
              estado: row.estado,
              monto: row.monto == null ? '—' : row.monto.toFixed(2),
              pagado: row.pagado === 1 ? 'Sí' : 'No',
            })),
          );
        }
      }

      await doc.finalize(`Reporte_Integral_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('PDF generado', { id: 'integral-pdf' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al generar PDF', { id: 'integral-pdf' });
    }
  };

  const exportToExcel = async () => {
    if (blocks.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    await runExcelExport('reporte integral', async () => {
      const workbook = createWorkbook('Reporte integral');
      const summary = workbook.addWorksheet('Resumen');
      await addBrandedExcelHeader(workbook, summary, 'REPORTE INTEGRAL', subtitle, 8);
      const summaryHeader = summary.addRow([
        'Estudiante',
        'Nivel',
        CLASSROOM_FIELD_LABELS.grade,
        CLASSROOM_FIELD_LABELS.section,
        'Asist. mañana',
        'Tardanzas',
        'Faltas',
        'Asist. tarde',
        'Incidencias',
        'Deuda',
      ]);
      styleHeaderRow(summaryHeader);
      for (const block of blocks) {
        summary.addRow([
          block.student.fullName,
          block.student.level,
          block.student.grade,
          block.student.section,
          block.summary.asistenciasManana,
          block.summary.tardanzas,
          block.summary.faltas,
          block.summary.asistenciasTarde,
          block.summary.incidencias,
          block.summary.deuda,
        ]);
      }
      setColumnWidths(summary, [32, 16, 10, 10, 14, 12, 10, 12, 12, 12]);

      const morning = workbook.addWorksheet('Asistencia mañana');
      await addBrandedExcelHeader(workbook, morning, 'ASISTENCIA MAÑANA', subtitle, 6);
      styleHeaderRow(morning.addRow(['Estudiante', 'Fecha', 'Ingreso', 'Salida', 'Estado']));
      for (const block of blocks) {
        for (const record of block.manana.records) {
          morning.addRow([
            block.student.fullName,
            record.date,
            record.arrivalTime ?? '',
            record.departureTime ?? '',
            attendanceStatusLabel(record.status),
          ]);
        }
      }
      setColumnWidths(morning, [32, 14, 12, 12, 16]);

      const afternoon = workbook.addWorksheet('Asistencia tarde');
      await addBrandedExcelHeader(workbook, afternoon, 'ASISTENCIA TARDE', subtitle, 6);
      styleHeaderRow(afternoon.addRow(['Estudiante', 'Fecha', 'Ingreso', 'Salida', 'Estado']));
      for (const block of blocks) {
        for (const record of block.tarde.records) {
          afternoon.addRow([
            block.student.fullName,
            record.date,
            record.arrivalTime ?? '',
            record.departureTime ?? '',
            attendanceStatusLabel(record.status),
          ]);
        }
      }
      setColumnWidths(afternoon, [32, 14, 12, 12, 16]);

      const incidents = workbook.addWorksheet('Incidencias');
      await addBrandedExcelHeader(workbook, incidents, 'INCIDENCIAS', subtitle, 5);
      styleHeaderRow(incidents.addRow(['Estudiante', 'Fecha', 'Falta', 'Estado', 'Observaciones']));
      for (const block of blocks) {
        for (const incident of block.incidents) {
          incidents.addRow([
            block.student.fullName,
            incident.registeredAt.slice(0, 10),
            incident.faultType?.name ?? incident.faultTypeId,
            incident.status,
            incident.observations ?? '',
          ]);
        }
      }
      setColumnWidths(incidents, [32, 14, 28, 14, 40]);

      if (isNotasEnabled()) {
        const notes = workbook.addWorksheet('Notas');
        await addBrandedExcelHeader(workbook, notes, 'NOTAS', subtitle, 5);
        styleHeaderRow(notes.addRow(['Estudiante', 'Semana', 'Área', 'Nota', 'Máximo']));
        for (const block of blocks) {
          for (const nota of block.notas) {
            notes.addRow([
              block.student.fullName,
              nota.semanaEtiqueta,
              nota.areaNombre,
              nota.nota,
              nota.notaMaxima,
            ]);
          }
        }
        setColumnWidths(notes, [32, 22, 24, 10, 10]);
      }

      if (isPensionesEnabled()) {
        const pensions = workbook.addWorksheet('Pensiones');
        await addBrandedExcelHeader(workbook, pensions, 'PENSIONES', subtitle, 5);
        styleHeaderRow(pensions.addRow(['Estudiante', 'Periodo', 'Estado', 'Monto', 'Pagado']));
        for (const block of blocks) {
          for (const row of block.pensiones) {
            pensions.addRow([
              block.student.fullName,
              row.periodo,
              row.estado,
              row.monto,
              row.pagado === 1 ? 'Sí' : 'No',
            ]);
          }
        }
        setColumnWidths(pensions, [32, 14, 14, 12, 10]);
      }

      await saveWorkbook(workbook, defaultExportFilename('Reporte_Integral'));
    });
  };

  const selectedBlock = mode === 'individual' ? blocks[0] : null;

  return (
    <div className="app-page app-page-shell space-y-6">
      <PageHeader
        icon={Layers}
        eyebrow="Reportes"
        title="Reporte Integral"
        description="Consolida asistencia, incidencias, notas y pensiones del período seleccionado."
        accent="info"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={loading || !filtersReady} onClick={() => void fetchReport()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Cargando' : hasQueried ? 'Actualizar' : 'Consultar'}
          </Button>
          <Button variant="ghost" disabled={blocks.length === 0} onClick={() => void exportToPDF()}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="ghost" disabled={blocks.length === 0} onClick={() => void exportToExcel()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat
          label="Estudiantes"
          value={hasQueried ? totals.students : '—'}
          hint={hasQueried ? periodLabel : 'Consulte para ver datos'}
          icon={Users}
          tone="info"
        />
        <StaffKpiStat
          label="Asistencias mañana"
          value={hasQueried ? totals.asistencias : '—'}
          hint="Registros de ingreso"
          icon={Clock}
          tone="success"
        />
        <StaffKpiStat
          label="Incidencias"
          value={hasQueried ? totals.incidencias : '—'}
          hint="En el período"
          icon={AlertTriangle}
          tone="warning"
        />
        <StaffKpiStat
          label="Deuda"
          value={hasQueried ? totals.deuda.toFixed(0) : '—'}
          hint={isPensionesEnabled() ? 'Pensiones pendientes' : 'Pensiones no habilitadas'}
          icon={Wallet}
          tone="accent"
        />
      </div>

      <StaffToolbar
        title="Filtros del reporte"
        description="Elija individual o general, el período y pulse Consultar"
      >
        <div className="col-span-full">
          <StaffSegmentedControl
            aria-label="Modo de reporte"
            value={mode}
            onValueChange={(value) => setMode(value as 'individual' | 'general')}
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'general', label: 'General' },
            ]}
            listClassName="sm:grid-cols-2 max-w-md"
          />
        </div>
        {mode === 'individual' ? (
          <div className="col-span-full space-y-2">
            <Label>Estudiante</Label>
            <StudentSearchCombobox
              variant="search"
              allowClear
              value={selectedStudent?.id ?? null}
              placeholder="Nombre completo del estudiante..."
              onChange={(_id, student) => setSelectedStudent(student)}
              onClear={() => setSelectedStudent(null)}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Nivel</Label>
              <Select
                value={levelFilter}
                onValueChange={(value) => setLevelFilter(value as 'all' | EducationalLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger>
                  <SelectValue />
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
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger>
                  <SelectValue />
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
          </>
        )}
        <div className="space-y-2">
          <Label>Tipo de período</Label>
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
            <Label>Mes</Label>
            <Input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Año escolar</Label>
              <Input
                type="number"
                value={añoEscolar}
                min={2020}
                max={2050}
                onChange={(event) => setAñoEscolar(Number(event.target.value))}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Seleccionar bimestre</SelectItem>
                  {getAllBimestres(añoEscolar).map((item) => (
                    <SelectItem key={item.numero} value={String(item.numero)}>
                      {formatBimestreLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="flex items-end">
          <Button className="w-full" disabled={loading || !filtersReady} onClick={() => void fetchReport()}>
            {loading ? 'Cargando...' : 'Consultar'}
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          accent="info"
          title={mode === 'individual' ? 'Ficha del estudiante' : 'Consolidado general'}
          description={
            !hasQueried
              ? 'Configure los filtros y pulse Consultar'
              : `${blocks.length} estudiante${blocks.length === 1 ? '' : 's'} · ${periodLabel}`
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              Consolidando datos...
            </div>
          ) : !hasQueried ? (
            <StaffEmptyState
              icon={Layers}
              title="Sin consulta realizada"
              description="Seleccione el modo, el período y pulse Consultar"
            />
          ) : blocks.length === 0 ? (
            <StaffEmptyState
              icon={Layers}
              title="Sin datos para mostrar"
              description="No hay estudiantes con los filtros seleccionados"
            />
          ) : selectedBlock ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">{selectedBlock.student.fullName}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedBlock.student.level} · {selectedBlock.student.grade} {selectedBlock.student.section}
                </p>
              </div>
              <IntegralBlockTables block={selectedBlock} />
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead className="text-center">Asist. mañana</TableHead>
                    <TableHead className="text-center">Tardanzas</TableHead>
                    <TableHead className="text-center">Faltas</TableHead>
                    <TableHead className="text-center">Asist. tarde</TableHead>
                    <TableHead className="text-center">Incidencias</TableHead>
                    <TableHead className="text-right">Deuda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block) => (
                    <TableRow key={block.student.id}>
                      <TableCell>
                        <div className="font-medium">{block.student.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {block.student.grade} {block.student.section}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{block.summary.asistenciasManana}</TableCell>
                      <TableCell className="text-center">{block.summary.tardanzas}</TableCell>
                      <TableCell className="text-center">{block.summary.faltas}</TableCell>
                      <TableCell className="text-center">{block.summary.asistenciasTarde}</TableCell>
                      <TableCell className="text-center">{block.summary.incidencias}</TableCell>
                      <TableCell className="text-right">{block.summary.deuda.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};

function IntegralBlockTables({ block }: { block: IntegralStudentBlock }) {
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Asistencia mañana</h4>
        <SimpleTable
          headers={['Fecha', 'Ingreso', 'Salida', 'Estado']}
          rows={block.manana.records.map((record) => [
            record.date,
            record.arrivalTime ?? '—',
            record.departureTime ?? '—',
            attendanceStatusLabel(record.status),
          ])}
          empty="Sin registros de mañana"
        />
      </section>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Asistencia tarde</h4>
        <SimpleTable
          headers={['Fecha', 'Ingreso', 'Salida', 'Estado']}
          rows={block.tarde.records.map((record) => [
            record.date,
            record.arrivalTime ?? '—',
            record.departureTime ?? '—',
            attendanceStatusLabel(record.status),
          ])}
          empty="Sin registros de tarde"
        />
      </section>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Incidencias</h4>
        <SimpleTable
          headers={['Fecha', 'Falta', 'Estado']}
          rows={block.incidents.map((incident) => [
            incident.registeredAt.slice(0, 10),
            incident.faultType?.name ?? `Falta #${incident.faultTypeId}`,
            incident.status,
          ])}
          empty="Sin incidencias en el período"
        />
      </section>
      {isNotasEnabled() && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Notas</h4>
          <SimpleTable
            headers={['Semana', 'Área', 'Nota']}
            rows={block.notas.map((nota) => [
              nota.semanaEtiqueta,
              nota.areaNombre,
              `${nota.nota}/${nota.notaMaxima}`,
            ])}
            empty="Sin notas en el período"
          />
        </section>
      )}
      {isPensionesEnabled() && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold">Pensiones</h4>
          <SimpleTable
            headers={['Periodo', 'Estado', 'Monto', 'Pagado']}
            rows={block.pensiones.map((row) => [
              row.periodo,
              row.estado,
              row.monto == null ? '—' : row.monto.toFixed(2),
              row.pagado === 1 ? 'Sí' : 'No',
            ])}
            empty="Sin pensiones en el período"
          />
        </section>
      )}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <TableCell key={`${cellIndex}-${cell}`}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
