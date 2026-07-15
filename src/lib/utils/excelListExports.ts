// @ts-nocheck
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AuditLog, Incident, ParentMeeting, Student } from '@/types';
import {
  addBrandedExcelHeader,
  addDataSheet,
  addExcelWatermark,
  addReportHeader,
  autoFitColumns,
  createWorkbook,
  defaultExportFilename,
  EXCEL_COLORS,
  freezePane,
  runExcelExport,
  saveWorkbook,
  setColumnWidths,
  styleDataRows,
  styleHeaderRow,
} from '@/lib/utils/excelExport';
import type { MonthlyAttendanceRow } from '@/types';

function formatDateTime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '—', time: '—' };
  try {
    const d = new Date(iso);
    return {
      date: format(d, 'dd/MM/yyyy', { locale: es }),
      time: format(d, 'HH:mm', { locale: es }),
    };
  } catch {
    return { date: '—', time: '—' };
  }
}

export async function exportIncidentsListExcel(
  incidents: Incident[],
  filtersLabel?: string
): Promise<void> {
  if (incidents.length === 0) {
    throw new Error('No hay incidencias para exportar');
  }

  await runExcelExport('Excel de incidencias', async () => {
    const workbook = createWorkbook('Incidencias');
    const subtitle = [
      `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
      filtersLabel,
      `Total: ${incidents.length} registro(s)`,
    ]
      .filter(Boolean)
      .join(' · ');

    await addDataSheet(
      workbook,
      'Incidencias',
      'LISTADO DE INCIDENCIAS',
      subtitle,
      [
        'ID',
        'Estudiante',
        'Nivel',
        'Grado',
        'Sección',
        'Tipo de falta',
        'Categoría',
        'Gravedad',
        'Nivel reincidencia',
        'Fecha',
        'Hora',
        'Estado',
        'Evidencias',
        'Observaciones',
      ],
      incidents.map((inc) => {
        const dt = formatDateTime(inc.registeredAt);
        return [
          inc.id,
          inc.student?.fullName ?? 'N/A',
          inc.student?.level ?? '—',
          inc.student?.grade ?? '—',
          inc.student?.section ?? '—',
          inc.faultType?.name ?? '—',
          inc.faultType?.category ?? '—',
          inc.faultType?.severity ?? '—',
          inc.reincidenceLevel,
          dt.date,
          dt.time,
          inc.status,
          inc.hasEvidence ? inc.evidenceCount : 0,
          inc.observations ?? '',
        ];
      }),
      [8, 28, 12, 10, 8, 24, 14, 10, 10, 12, 8, 12, 10, 36]
    );

    await saveWorkbook(workbook, defaultExportFilename('Incidencias'));
  });
}

export async function exportStudentsListExcel(
  students: Student[],
  filtersLabel?: string
): Promise<void> {
  if (students.length === 0) {
    throw new Error('No hay estudiantes para exportar');
  }

  await runExcelExport('Excel de estudiantes', async () => {
    const workbook = createWorkbook('Estudiantes');
    const subtitle = [
      `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
      filtersLabel,
      `Total: ${students.length} alumno(s)`,
    ]
      .filter(Boolean)
      .join(' · ');

    await addDataSheet(
      workbook,
      'Estudiantes',
      'PADRÓN DE ESTUDIANTES',
      subtitle,
      [
        'ID',
        'Código',
        'Nombre completo',
        'Nivel',
        'Grado',
        'Sección',
        'Nivel reincidencia',
        'Responsable',
        'Parentesco',
        'Teléfono contacto',
        'Tel. emergencia',
        'Email contacto',
        'Activo',
      ],
      students.map((s) => [
        s.id,
        s.barcode,
        s.fullName,
        s.level,
        s.grade,
        s.section,
        s.reincidenceLevel ?? 0,
        s.responsibleName ?? '',
        s.responsibleRelationship ?? '',
        s.contactPhone ?? '',
        s.emergencyPhone ?? '',
        s.contactEmail ?? '',
        s.active ? 'Sí' : 'No',
      ]),
      [8, 14, 32, 12, 10, 8, 12, 22, 14, 14, 14, 24, 8]
    );

    await saveWorkbook(workbook, defaultExportFilename('Estudiantes'));
  });
}

export async function exportAuditLogsExcel(logs: AuditLog[]): Promise<void> {
  if (logs.length === 0) {
    throw new Error('No hay registros de auditoría para exportar');
  }

  await runExcelExport('Excel de auditoría', async () => {
    const workbook = createWorkbook('Auditoría');
    await addDataSheet(
      workbook,
      'Auditoría',
      'REGISTRO DE AUDITORÍA',
      `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })} · ${logs.length} registro(s)`,
      ['ID', 'Tabla', 'Operación', 'Usuario ID', 'Fecha y hora', 'Datos anteriores', 'Datos nuevos'],
      logs.map((log) => {
        const dt = formatDateTime(log.timestamp);
        return [
          log.id,
          log.table,
          log.operation,
          log.userId ?? '—',
          `${dt.date} ${dt.time}`,
          log.previousData ? JSON.stringify(log.previousData) : '',
          log.newData ? JSON.stringify(log.newData) : '',
        ];
      }),
      [8, 18, 12, 10, 18, 40, 40]
    );
    await saveWorkbook(workbook, defaultExportFilename('Auditoria'));
  });
}

export async function exportParentMeetingsExcel(meetings: ParentMeeting[]): Promise<void> {
  if (meetings.length === 0) {
    throw new Error('No hay citas para exportar');
  }

  await runExcelExport('Excel de citas', async () => {
    const workbook = createWorkbook('Citas con padres');
    await addDataSheet(
      workbook,
      'Citas',
      'CITAS CON PADRES',
      `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })} · ${meetings.length} cita(s)`,
      [
        'ID',
        'Estudiante',
        'Grado',
        'Sección',
        'Motivo',
        'Fecha',
        'Hora',
        'Estado',
        'Asistencia',
        'Notas',
      ],
      meetings.map((m) => [
        m.id,
        m.student?.fullName ?? '—',
        m.student?.grade ?? '—',
        m.student?.section ?? '—',
        m.motivo,
        m.fecha ? format(new Date(m.fecha), 'dd/MM/yyyy', { locale: es }) : '—',
        m.hora ?? '—',
        m.estado,
        m.asistencia == null ? 'Pendiente' : m.asistencia ? 'Asistió' : 'No asistió',
        m.notas ?? '',
      ]),
      [8, 28, 10, 8, 32, 12, 8, 14, 12, 30]
    );
    await saveWorkbook(workbook, defaultExportFilename('Citas_Padres'));
  });
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  A_tiempo: 'A tiempo',
  Tarde: 'Tarde',
  Justificada: 'Justificada',
  Injustificada: 'Injustificada',
  Sin_registro: 'Sin registro',
};

/** Hoja detalle de asistencia mensual (usado por AttendanceReport) */
export async function buildAttendanceDetailSheet(
  workbook: import('exceljs').Workbook,
  sheetName: string,
  title: string,
  subtitle: string,
  daysArray: number[],
  rows: MonthlyAttendanceRow[],
  totalsGlobal: { onTime: number; late: number; justified: number; unjustified: number }
): Promise<import('exceljs').Worksheet> {
  const sheet = workbook.addWorksheet(sheetName);
  const mergeCols = daysArray.length + 8;

  const startRow = await addBrandedExcelHeader(workbook, sheet, title, subtitle, mergeCols);

  const headers = [
    'Estudiante',
    'Nivel',
    'Grado',
    'Sección',
    ...daysArray.map((d) => `Día ${d}`),
    'A tiempo',
    'Tardanzas',
    'Justificadas',
    'Injustificadas',
  ];
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  const dataStart = startRow + 1;
  rows.forEach((row) => {
    const values = [
      row.student.fullName,
      row.student.level,
      row.student.grade,
      row.student.section,
      ...row.days.map((day) => ATTENDANCE_STATUS_LABELS[day.status] ?? day.status),
      row.totals.onTime,
      row.totals.late,
      row.totals.justified,
      row.totals.unjustified,
    ];
    const dataRow = sheet.addRow(values);
    row.days.forEach((day, index) => {
      const cell = dataRow.getCell(index + 5);
      const colors: Record<string, { bg: string; fg: string }> = {
        A_tiempo: { bg: 'FFD1FAE5', fg: 'FF065F46' },
        Tarde: { bg: 'FFFEF3C7', fg: 'FF92400E' },
        Justificada: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
        Injustificada: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
      };
      const c = colors[day.status];
      if (c) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.bg } };
        cell.font = { size: 9, color: { argb: c.fg } };
      }
    });
  });

  if (rows.length > 0) {
    styleDataRows(sheet, dataStart, dataStart + rows.length - 1, { zebra: true, fontSize: 9 });
  }

  sheet.addRow([]);
  const summaryRow = sheet.addRow([
    'TOTAL GENERAL',
    '',
    '',
    '',
    ...Array(daysArray.length).fill(''),
    totalsGlobal.onTime,
    totalsGlobal.late,
    totalsGlobal.justified,
    totalsGlobal.unjustified,
  ]);
  summaryRow.font = { bold: true, size: 10 };
  summaryRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.summaryBg } };
  });

  freezePane(sheet, startRow);
  const widths = [30, 12, 10, 8, ...daysArray.map(() => 6), 10, 10, 12, 12];
  setColumnWidths(sheet, widths);
  autoFitColumns(sheet, 6, 32);

  const centerRow = startRow + Math.max(6, Math.floor(rows.length / 2) + 3);
  await addExcelWatermark(workbook, sheet, { mergeCols, centerRow });

  return sheet;
}
