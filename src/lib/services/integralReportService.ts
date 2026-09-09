import { incidentsService, pensionesService, tallerAttendanceService } from '@/lib/services';
import { isPensionesEnabled } from '@/config/features';
import { buildTardeAttendanceRows } from '@/lib/utils/attendanceTurno';
import { periodoFromLimaDate } from '@/lib/utils/pensionPeriod';
import type { Incident, MonthlyAttendanceRow, PensionRow, Student } from '@/types';

export type IntegralAttendanceRecord = {
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
  status: string;
};

export type IntegralNotaRow = {
  semanaEtiqueta: string;
  areaNombre: string;
  nota: number;
  notaMaxima: number;
};

export type IntegralStudentBlock = {
  student: Student;
  manana: {
    records: IntegralAttendanceRecord[];
    onTime: number;
    late: number;
    lateJustified: number;
    absentJustified: number;
    justified: number;
    unjustified: number;
  };
  tarde: {
    records: IntegralAttendanceRecord[];
    present: number;
  };
  incidents: Incident[];
  notas: IntegralNotaRow[];
  pensiones: PensionRow[];
  summary: {
    asistenciasManana: number;
    faltas: number;
    tardanzas: number;
    asistenciasTarde: number;
    incidencias: number;
    deuda: number;
  };
};

function monthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endYear = Number(end.slice(0, 4));
  const endMonth = Number(end.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function recordsFromMorningRow(
  row: MonthlyAttendanceRow,
  dateKeys: string[],
): IntegralAttendanceRecord[] {
  return dateKeys.map((date, index) => {
    const day = row.days[index];
    return {
      date,
      arrivalTime: day?.arrivalTime ?? null,
      departureTime: day?.departureTime ?? null,
      status: day?.status ?? 'Sin_registro',
    };
  });
}

function recordsFromTardeRow(
  row: MonthlyAttendanceRow,
  dateKeys: string[],
): IntegralAttendanceRecord[] {
  return dateKeys.map((date, index) => {
    const day = row.days[index];
    return {
      date,
      arrivalTime: day?.arrivalTime ?? null,
      departureTime: day?.departureTime ?? null,
      status: day?.status ?? 'Sin_registro',
    };
  });
}

function pensionDeuda(rows: PensionRow[]): number {
  return rows.reduce((sum, row) => {
    if (row.pagado === 1 || row.estado === 'pagado') return sum;
    return sum + (row.monto ?? 0);
  }, 0);
}

async function fetchPensionesForStudents(
  students: Student[],
  start: string,
  end: string,
): Promise<Map<number, PensionRow[]>> {
  const byStudent = new Map<number, PensionRow[]>();
  if (!isPensionesEnabled() || students.length === 0) return byStudent;

  const months = monthsInRange(start, end);
  const allRows: PensionRow[] = [];

  if (students.length === 1) {
    const years = [...new Set(months.map((periodo) => Number(periodo.slice(0, 4))))];
    for (const year of years) {
      const { rows } = await pensionesService.historialAnio(students[0].id, year);
      allRows.push(...rows);
    }
  } else {
    for (const periodo of months) {
      const { rows } = await pensionesService.listByPeriodo(periodo);
      allRows.push(...rows);
    }
  }

  const studentIds = new Set(students.map((student) => student.id));
  const startPeriod = periodoFromLimaDate(start);
  const endPeriod = periodoFromLimaDate(end);

  for (const row of allRows) {
    if (!studentIds.has(row.idEstudiante)) continue;
    if (row.periodo < startPeriod || row.periodo > endPeriod) continue;
    const list = byStudent.get(row.idEstudiante) ?? [];
    list.push(row);
    byStudent.set(row.idEstudiante, list);
  }

  return byStudent;
}

export async function assembleIntegralBlocks(input: {
  students: Student[];
  morningRows: MonthlyAttendanceRow[];
  start: string;
  end: string;
  dateKeys: string[];
  estudianteId?: number;
  level?: Student['level'];
  grade?: string;
  section?: string;
}): Promise<{ blocks: IntegralStudentBlock[]; error: string | null }> {
  const { students, morningRows, start, end, dateKeys } = input;
  const morningById = new Map(morningRows.map((row) => [row.student.id, row]));

  const { records: tardeRecords } = await tallerAttendanceService.fetchRangeForStudents(
    students.map((student) => student.id),
    start,
    end,
  );
  const tardeRows = buildTardeAttendanceRows(students, tardeRecords, dateKeys);
  const tardeById = new Map(tardeRows.map((row) => [row.student.id, row]));

  const { incidents, error: incidentsError } = await incidentsService.getAll({
    fetchAll: true,
    fechaDesde: start,
    fechaHasta: end,
    estudianteId: input.estudianteId,
    nivelEducativo: input.level,
    grado: input.grade,
    seccion: input.section,
  });
  const incidentsByStudent = new Map<number, Incident[]>();
  for (const incident of incidents) {
    const list = incidentsByStudent.get(incident.studentId) ?? [];
    list.push(incident);
    incidentsByStudent.set(incident.studentId, list);
  }

  const pensionesByStudent = await fetchPensionesForStudents(students, start, end);

  const blocks = students.map((student) => {
    const morning = morningById.get(student.id);
    const tarde = tardeById.get(student.id);
    const mananaRecords = morning ? recordsFromMorningRow(morning, dateKeys) : [];
    const tardeMapped = tarde ? recordsFromTardeRow(tarde, dateKeys) : [];
    const onTime = morning?.totals.onTime ?? 0;
    const late = morning?.totals.late ?? 0;
    const lateJustified = morning?.totals.lateJustified ?? 0;
    const absentJustified = morning?.totals.absentJustified ?? 0;
    const justified = lateJustified;
    const unjustified = morning?.totals.unjustified ?? 0;
    const presentTarde = tarde?.totals.onTime ?? 0;
    const studentIncidents = incidentsByStudent.get(student.id) ?? [];
    const studentPensiones = pensionesByStudent.get(student.id) ?? [];
    const deuda = pensionDeuda(studentPensiones);

    return {
      student,
      manana: {
        records: mananaRecords.filter((record) => record.status !== 'Sin_registro'),
        onTime,
        late,
        lateJustified,
        absentJustified,
        justified,
        unjustified,
      },
      tarde: {
        records: tardeMapped.filter((record) => record.status !== 'Sin_registro'),
        present: presentTarde,
      },
      incidents: studentIncidents,
      notas: [] as IntegralNotaRow[],
      pensiones: studentPensiones,
      summary: {
        asistenciasManana: onTime + late + lateJustified,
        faltas: absentJustified + unjustified,
        tardanzas: late,
        asistenciasTarde: presentTarde,
        incidencias: studentIncidents.length,
        deuda,
      },
    };
  });

  return { blocks, error: incidentsError };
}
