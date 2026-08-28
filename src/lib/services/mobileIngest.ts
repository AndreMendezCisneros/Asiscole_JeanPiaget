import type { ArrivalRecord, FaultType, Incident, Student } from '@/types';

export type MobileIngestTipo = 'entrada' | 'salida' | 'incidencia' | 'aviso';

export type MobileIngestEventBody = {
  tenant_id: string;
  tipo: MobileIngestTipo;
  id_estudiante: number;
  id_registro: number;
  payload: Record<string, string | undefined>;
};

export function buildMobileIngestBody(input: {
  tenantId: string;
  tipo: MobileIngestTipo;
  student: Student;
  idRegistro: number;
  payloadExtra?: Record<string, string | undefined>;
}): MobileIngestEventBody {
  return {
    tenant_id: input.tenantId,
    tipo: input.tipo,
    id_estudiante: input.student.id,
    id_registro: input.idRegistro,
    payload: {
      nombre_completo: input.student.fullName,
      grado: input.student.grade,
      seccion: input.student.section,
      nivel_educativo: input.student.level,
      ...input.payloadExtra,
    },
  };
}

export function buildArrivalIngestBody(
  tenantId: string,
  student: Student,
  record: ArrivalRecord,
  opts?: { taller?: boolean },
): MobileIngestEventBody {
  const isTaller = Boolean(opts?.taller);
  return buildMobileIngestBody({
    tenantId,
    tipo: 'entrada',
    student,
    idRegistro: record.id,
    payloadExtra: {
      fecha: record.date,
      hora_llegada: record.arrivalTime || undefined,
      estado: isTaller ? 'Taller' : record.status || undefined,
      ...(isTaller
        ? {
            contexto: 'taller',
            nota: `${student.fullName} llegó a su taller a las ${record.arrivalTime || ''}`.trim(),
          }
        : {}),
    },
  });
}

export function buildDepartureIngestBody(
  tenantId: string,
  student: Student,
  record: ArrivalRecord,
  opts?: { taller?: boolean },
): MobileIngestEventBody {
  const isTaller = Boolean(opts?.taller);
  return buildMobileIngestBody({
    tenantId,
    tipo: 'salida',
    student,
    idRegistro: record.id,
    payloadExtra: {
      fecha: record.date,
      hora_salida: record.departureTime || undefined,
      tipo_salida: record.departureType || undefined,
      estado: isTaller ? 'Taller' : record.status || undefined,
      ...(isTaller
        ? {
            contexto: 'taller',
            nota: `${student.fullName} salió de su taller a las ${record.departureTime || ''}`.trim(),
          }
        : {}),
    },
  });
}

export function buildIncidentIngestBody(
  tenantId: string,
  student: Student,
  incident: Incident,
  fault: FaultType,
): MobileIngestEventBody {
  const registered = (incident.registeredAt || '').trim();
  const fecha = registered.slice(0, 10) || undefined;
  let hora: string | undefined;
  if (registered) {
    try {
      const d = new Date(registered);
      if (!Number.isNaN(d.getTime())) {
        hora = d.toLocaleTimeString('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      }
    } catch {
      /* ignore */
    }
  }

  return buildMobileIngestBody({
    tenantId,
    tipo: 'incidencia',
    student,
    idRegistro: incident.id,
    payloadExtra: {
      fecha,
      hora,
      nombre_falta: fault.name,
      categoria: fault.category,
      observaciones: incident.observations || undefined,
    },
  });
}

export function buildPensionIngestBody(
  tenantId: string,
  student: Student,
  input: { periodo: string; monto?: number | null; idRegistro?: number },
): MobileIngestEventBody {
  const [y, m] = input.periodo.split('-');
  const periodoLabel = m && y ? `${m}/${y}` : input.periodo;
  const montoTxt =
    input.monto != null && Number.isFinite(input.monto)
      ? ` Monto referencial: S/ ${Number(input.monto).toFixed(2)}.`
      : '';
  const textoLibre =
    `La pensión del periodo ${periodoLabel} de ${student.fullName} figura sin pago. ` +
    `Por favor regularice el pago en el colegio o entidad bancaria indicada.${montoTxt}`;
  return buildMobileIngestBody({
    tenantId,
    tipo: 'aviso',
    student,
    idRegistro: input.idRegistro ?? (Number(`${y || 0}${m || 0}${student.id}`) || student.id),
    payloadExtra: {
      periodo: input.periodo,
      contexto: 'pension',
      texto_libre: textoLibre,
    },
  });
}

export type CitaIngestAlcance = 'individual' | 'apafa' | 'piso' | 'salon';

export function citaAlcanceFromMeetingTipo(
  tipo: 'individual' | 'all' | 'grade' | 'section' | 'students',
): CitaIngestAlcance {
  if (tipo === 'all') return 'apafa';
  if (tipo === 'grade') return 'piso';
  if (tipo === 'section') return 'salon';
  return 'individual';
}

function formatCitaFecha(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split('-');
  if (!d || !m || !y) return fecha;
  return `${d}/${m}/${y}`;
}

export function buildCitaTextoLibre(
  student: Student,
  input: {
    motivo: string;
    fecha: string;
    hora: string;
    alcance: CitaIngestAlcance;
  },
): string {
  const fechaTxt = formatCitaFecha(input.fecha);
  const horaTxt = input.hora.slice(0, 5);
  const motivo = input.motivo.trim();
  const cierre = ' Revise el detalle en la aplicación Asiscole.';
  if (input.alcance === 'apafa') {
    return (
      `Se convoca a junta de padres (APAFA) el ${fechaTxt} a las ${horaTxt}. ` +
      `Motivo: ${motivo}. Estudiante: ${student.fullName}.${cierre}`
    );
  }
  if (input.alcance === 'piso') {
    return (
      `Se convoca a los padres del grado ${student.grade} (${student.level}) el ${fechaTxt} a las ${horaTxt}. ` +
      `Motivo: ${motivo}. Estudiante: ${student.fullName}.${cierre}`
    );
  }
  if (input.alcance === 'salon') {
    return (
      `Se convoca a los padres de la sección ${student.section}, grado ${student.grade}, el ${fechaTxt} a las ${horaTxt}. ` +
      `Motivo: ${motivo}. Estudiante: ${student.fullName}.${cierre}`
    );
  }
  return (
    `Se citó a los padres de ${student.fullName} el ${fechaTxt} a las ${horaTxt}. ` +
    `Motivo: ${motivo}.${cierre}`
  );
}

export function buildCitaIngestBody(
  tenantId: string,
  student: Student,
  input: {
    citaId: number;
    motivo: string;
    fecha: string;
    hora: string;
    alcance: CitaIngestAlcance;
  },
): MobileIngestEventBody {
  return buildMobileIngestBody({
    tenantId,
    tipo: 'aviso',
    student,
    idRegistro: input.citaId,
    payloadExtra: {
      contexto: 'cita',
      fecha: input.fecha.slice(0, 10),
      hora: input.hora.slice(0, 5),
      motivo: input.motivo.trim(),
      alcance: input.alcance,
      texto_libre: buildCitaTextoLibre(student, input),
    },
  });
}
