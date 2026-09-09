import { supabase } from '../supabaseClient';
import type { ArrivalRecord, RegistroLlegadaDB, Student, EducationalLevel, MonthlyAttendanceRow } from '@/types';
import { configService } from './configService';
import { studentsService } from './studentsService';
import { authService } from './authService';
import { getLimaNow, getLimaTodayDate, getLimaMonthBounds, getMonthBounds } from '@/lib/utils/limaDateTime';
import { getCached, invalidateCache, setCached } from '@/lib/utils/memoryCache';
import type { ArrivalLimitsByLevel } from '@/lib/utils/arrivalLimit';
import {
  resolveArrivalLimitForLevel,
  resolveArrivalStatusForStudent,
} from '@/lib/utils/arrivalLimit';
import { SYSTEM_SETTING_KEYS, normalizeTimeValue } from '@/config/systemSettings';
import {
  ARRIVAL_ESTADO,
  MIN_JUSTIFICATION_REASON_LENGTH,
  convertArrivalEstadoToReport,
  emptyAttendanceTotals,
  isProtectedArrivalStatus,
  tallyAttendanceStatus,
} from '@/lib/utils/attendanceJustification';

const ARRIVAL_LIMIT_CACHE_TTL = 15 * 60 * 1000;

/**
 * Servicio para gestionar registros de llegada
 */

/**
 * Convierte un registro de llegada de DB a formato frontend
 */
function mapArrivalRecord(record: RegistroLlegadaDB & { 
  estudiante?: any;
  usuario?: any;
  usuario_salida?: any;
}): ArrivalRecord {
  // Formatear hora de salida si existe
  let departureTime = record.hora_salida || null;
  if (departureTime && departureTime.length > 5) {
    departureTime = departureTime.substring(0, 5);
  }

  return {
    id: record.id_registro,
    studentId: record.id_estudiante,
    student: record.estudiante ? {
      id: record.estudiante.id_estudiante,
      fullName: record.estudiante.nombre_completo,
      grade: record.estudiante.grado,
      section: record.estudiante.seccion,
      level: (record.estudiante.nivel_educativo || 'Secundaria') as EducationalLevel,
      barcode: record.estudiante.codigo_barras,
      profilePhoto: record.estudiante.foto_perfil,
      active: record.estudiante.activo,
      contactPhone: record.estudiante.telefono_contacto || null,
      contactEmail: record.estudiante.email_contacto || null,
      responsibleName: record.estudiante.nombre_responsable || null,
      responsibleRelationship: record.estudiante.parentesco_responsable || null,
      emergencyPhone: record.estudiante.telefono_emergencia || null,
    } : undefined,
    date: record.fecha,
    arrivalTime: record.hora_llegada,
    status: record.estado,
    registeredBy: record.registrado_por,
    registeredByUser: record.usuario ? {
      id: record.usuario.id_usuario,
      username: record.usuario.username,
      fullName: record.usuario.nombre_completo,
      email: record.usuario.email,
      role: record.usuario.rol,
      active: record.usuario.activo,
    } : undefined,
    createdAt: record.fecha_creacion,
    justificationReason: record.motivo_justificacion ?? null,
    justifiedBy: record.justificado_por ?? null,
    justifiedAt: record.fecha_justificacion ?? null,
    departureTime: departureTime,
    departureRegisteredBy: record.registrado_salida_por || null,
    departureType: (record.tipo_salida as 'Normal' | 'Autorizada' | 'Sin registro' | null) || null,
  };
}

const ARRIVAL_LIMITS_CACHE_KEY = 'config:arrival-limits-bundle';

export function invalidateArrivalLimitCache(): void {
  invalidateCache(ARRIVAL_LIMITS_CACHE_KEY);
  invalidateCache(`config:${SYSTEM_SETTING_KEYS.arrivalLimit}`);
  invalidateCache(`config:${SYSTEM_SETTING_KEYS.arrivalLimitPrimary}`);
  invalidateCache(`config:${SYSTEM_SETTING_KEYS.arrivalLimitSecondary}`);
}

function canSyncArrivalEstadoInDb(): boolean {
  const role = authService.getCurrentUser()?.role;
  return role === 'Admin' || role === 'Director' || role === 'Supervisor';
}

function applyScanStatus(
  record: ArrivalRecord,
  limits: ArrivalLimitsByLevel,
  level?: string | null,
): ArrivalRecord {
  if (isProtectedArrivalStatus(record.status)) return record;
  const status = resolveArrivalStatusForStudent(record.arrivalTime, limits, level);
  return status === record.status ? record : { ...record, status };
}

async function resolveRecordStatus(
  record: ArrivalRecord,
  level?: string | null,
  syncToDb = false,
): Promise<ArrivalRecord> {
  if (isProtectedArrivalStatus(record.status)) return record;
  const limits = await fetchArrivalLimits();
  const resolved = applyScanStatus(record, limits, level);
  if (resolved.status === record.status) return record;
  if (syncToDb && canSyncArrivalEstadoInDb() && record.id > 0) {
    const { error } = await supabase
      .from('registros_llegada')
      .update({ estado: resolved.status })
      .eq('id_registro', record.id);
    if (error) console.warn('resolveRecordStatus sync:', error.message);
  }
  return resolved;
}

function buildArrivalLimitsFromConfigs(
  configs: Record<string, { value?: string } | undefined>,
): ArrivalLimitsByLevel {
  const general = normalizeTimeValue(
    configs[SYSTEM_SETTING_KEYS.arrivalLimit]?.value,
    '08:00',
  );
  return {
    general,
    primaria: normalizeTimeValue(
      configs[SYSTEM_SETTING_KEYS.arrivalLimitPrimary]?.value,
      general,
    ),
    secundaria: normalizeTimeValue(
      configs[SYSTEM_SETTING_KEYS.arrivalLimitSecondary]?.value,
      general,
    ),
  };
}

/**
 * Hora límite de llegada según nivel (Primaria / Secundaria / general).
 */
async function getArrivalLimitTime(level?: string): Promise<string> {
  const limits = await fetchArrivalLimits();
  return resolveArrivalLimitForLevel(limits, level);
}

/** Precarga límites de llegada por nivel. */
export async function prefetchArrivalConfig(): Promise<void> {
  await fetchArrivalLimits();
}

export async function fetchArrivalLimitTime(level?: string): Promise<string> {
  return getArrivalLimitTime(level);
}

export async function fetchArrivalLimits(): Promise<ArrivalLimitsByLevel> {
  const cached = getCached<ArrivalLimitsByLevel>(ARRIVAL_LIMITS_CACHE_KEY);
  if (cached) return cached;

  const keys = [
    SYSTEM_SETTING_KEYS.arrivalLimit,
    SYSTEM_SETTING_KEYS.arrivalLimitPrimary,
    SYSTEM_SETTING_KEYS.arrivalLimitSecondary,
  ];
  const { configs, error } = await configService.getByKeys(keys);
  if (error) {
    const fallback: ArrivalLimitsByLevel = {
      general: '08:00',
      primaria: '08:00',
      secundaria: '08:00',
    };
    return fallback;
  }

  const limits = buildArrivalLimitsFromConfigs(configs);
  setCached(ARRIVAL_LIMITS_CACHE_KEY, limits, ARRIVAL_LIMIT_CACHE_TTL);
  for (const key of keys) {
    if (configs[key]) {
      setCached(`config:${key}`, configs[key], ARRIVAL_LIMIT_CACHE_TTL);
    }
  }
  return limits;
}

/** Límites para portal público de padres (sin sesión). */
export async function fetchPublicArrivalLimits(): Promise<ArrivalLimitsByLevel> {
  try {
    const { data, error } = await supabase.rpc('limites_llegada_publicos');
    if (!error && data && typeof data === 'object') {
      const payload = data as Record<string, unknown>;
      const general = normalizeTimeValue(payload.general, '08:00');
      return {
        general,
        primaria: normalizeTimeValue(payload.primaria, general),
        secundaria: normalizeTimeValue(payload.secundaria, general),
      };
    }
  } catch {
    /* RPC opcional hasta aplicar PATCH SQL */
  }
  return fetchArrivalLimits().catch(() => ({
    general: '08:00',
    primaria: '08:00',
    secundaria: '08:00',
  }));
}

function getNowHHMM(): string {
  // Usar la hora actual en la zona horaria de Lima
  const now = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
  const [time] = now.split(' ')[1].split(':');
  const [hh, mm] = time.split(':');
  return `${hh}:${mm}`;
}

export type CreateArrivalOptions = {
  date?: string;
  arrivalTime?: string;
  status?: 'A tiempo' | 'Tarde';
  /** Nivel del estudiante para aplicar hora_limite_llegada_primaria / _secundaria. */
  studentLevel?: string | null;
};

export type CreateArrivalResult = {
  record: ArrivalRecord | null;
  error: string | null;
  /** El estudiante ya tenía llegada registrada hoy (otro tutor o re-escaneo). */
  alreadyRegistered?: boolean;
};

const ARRIVAL_ROW_SELECT =
  'id_registro, id_estudiante, fecha, hora_llegada, hora_salida, tipo_salida, estado, fecha_creacion, registrado_por, motivo_justificacion, justificado_por, fecha_justificacion';

/** Evita carrera solo para el mismo estudiante; distintos escanean en paralelo. */
const arrivalCreateLocks = new Map<number, Promise<CreateArrivalResult>>();

function trimTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 5 ? value.substring(0, 5) : value;
}

function mapArrivalRow(data: {
  id_registro: number;
  id_estudiante: number;
  fecha: string;
  hora_llegada: string;
  hora_salida?: string | null;
  tipo_salida?: string | null;
  estado: string;
  fecha_creacion: string;
  registrado_por: number | null;
  motivo_justificacion?: string | null;
  justificado_por?: number | null;
  fecha_justificacion?: string | null;
}): ArrivalRecord {
  const arrivalTime = trimTime(data.hora_llegada) || data.hora_llegada;

  return {
    id: data.id_registro,
    studentId: data.id_estudiante,
    date: data.fecha,
    arrivalTime,
    status: data.estado as ArrivalRecord['status'],
    registeredBy: data.registrado_por ?? 0,
    createdAt: data.fecha_creacion,
    justificationReason: data.motivo_justificacion ?? null,
    justifiedBy: data.justificado_por ?? null,
    justifiedAt: data.fecha_justificacion ?? null,
    departureTime: trimTime(data.hora_salida),
    departureType: (data.tipo_salida as ArrivalRecord['departureType']) ?? null,
  };
}

/**
 * Llegada del día para un estudiante (evita duplicados entre tutores o re-escaneos).
 */
export async function getTodayArrivalForStudent(
  studentId: number,
  date?: string,
  studentLevel?: string | null,
): Promise<{ record: ArrivalRecord | null; error: string | null }> {
  try {
    const targetDate = date ?? getLimaNow().date;

    const { data, error } = await supabase
      .from('registros_llegada')
      .select(ARRIVAL_ROW_SELECT)
      .eq('id_estudiante', studentId)
      .eq('fecha', targetDate)
      .order('hora_llegada', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { record: null, error: error.message };
    }

    if (!data) {
      return { record: null, error: null };
    }

    const record = await resolveRecordStatus(mapArrivalRow(data), studentLevel, false);
    return { record, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al consultar llegada';
    return { record: null, error: message };
  }
}

async function createArrivalRecordInner(
  studentId: number,
  registeredBy?: number,
  options?: CreateArrivalOptions
): Promise<CreateArrivalResult> {
  try {
    const { date: formattedDate, time: formattedTime } =
      options?.date && options?.arrivalTime
        ? { date: options.date, time: options.arrivalTime }
        : getLimaNow();

    let level = options?.studentLevel ?? null;
    if (!level) {
      const { data: estRow } = await supabase
        .from('estudiantes')
        .select('nivel_educativo')
        .eq('id_estudiante', studentId)
        .maybeSingle();
      level = estRow?.nivel_educativo ?? null;
    }

    const { record: existing } = await getTodayArrivalForStudent(
      studentId,
      formattedDate,
      level,
    );
    if (existing) {
      return { record: existing, error: null, alreadyRegistered: true };
    }

    const insertData: Record<string, unknown> = {
      id_estudiante: studentId,
      fecha: formattedDate,
      hora_llegada: formattedTime,
      fecha_creacion: new Date().toISOString(),
    };

    if (registeredBy) {
      insertData.registrado_por = registeredBy;
    }

    invalidateArrivalLimitCache();
    const limits = await fetchArrivalLimits();
    insertData.estado = resolveArrivalStatusForStudent(
      normalizeTimeValue(formattedTime, '00:00'),
      limits,
      level,
    );

    const { data, error } = await supabase
      .from('registros_llegada')
      .insert(insertData)
      .select(ARRIVAL_ROW_SELECT)
      .single();

    if (error) {
      // Carrera entre dos tutores: el otro insertó primero.
      if (error.code === '23505') {
        const { record: raced } = await getTodayArrivalForStudent(
          studentId,
          formattedDate,
          level,
        );
        if (raced) {
          return { record: raced, error: null, alreadyRegistered: true };
        }
      }
      console.error('Error al registrar llegada:', error);
      return { record: null, error: error.message };
    }

    const record = await resolveRecordStatus(mapArrivalRow(data), level, false);
    return { record, error: null };
  } catch (error: any) {
    console.error('Error al registrar llegada:', error);
    return { record: null, error: error.message };
  }
}

/**
 * Registrar una llegada. Varios tutores/estudiantes en paralelo;
 * solo se serializa si es el mismo estudiante al mismo tiempo.
 */
export async function createArrivalRecord(
  studentId: number,
  registeredBy?: number,
  options?: CreateArrivalOptions
): Promise<CreateArrivalResult> {
  const inFlight = arrivalCreateLocks.get(studentId);
  if (inFlight) {
    const result = await inFlight;
    if (result.record && !result.alreadyRegistered) {
      return { record: result.record, error: null, alreadyRegistered: true };
    }
    return result;
  }

  const task = createArrivalRecordInner(studentId, registeredBy, options).finally(() => {
    if (arrivalCreateLocks.get(studentId) === task) {
      arrivalCreateLocks.delete(studentId);
    }
  });

  arrivalCreateLocks.set(studentId, task);
  return task;
}

/**
 * Obtener registros de llegada con filtros
 */
export async function getArrivals(filters?: {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  studentId?: number;
  status?: ArrivalRecord['status'] | ArrivalRecord['status'][];
  limit?: number;
}): Promise<{ records: ArrivalRecord[]; error: string | null }> {
  try {
    // Nota: La relación usuario_salida se agregará después de ejecutar el script SQL
    // Por ahora, hacemos la consulta sin esa relación para evitar errores
    let query = supabase
      .from('registros_llegada')
      .select(`
        *,
        estudiante:estudiantes!registros_llegada_id_estudiante_fkey(*),
        usuario:usuarios!registros_llegada_registrado_por_fkey(*)
      `)
      .order('fecha', { ascending: false })
      .order('hora_llegada', { ascending: false });

    if (filters?.date) {
      try {
        // Intentar parsear la fecha en diferentes formatos
        let formattedDate = filters.date;
        
        // Si la fecha viene en formato YYYY-MM-DD, usarla directamente
        if (/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
          formattedDate = filters.date;
        } 
        // Si viene en formato DD/MM/YYYY, convertir a YYYY-MM-DD
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(filters.date)) {
          const [dd, mm, yyyy] = filters.date.split('/');
          formattedDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
        // Si es una fecha ISO (de toISOString())
        else if (filters.date.includes('T')) {
          formattedDate = filters.date.split('T')[0];
        }
        
        query = query.eq('fecha', formattedDate);
      } catch (error) {
        console.error('Error al formatear la fecha:', error);
        // Si hay un error, intentar usar la fecha directamente
        query = query.eq('fecha', filters.date);
      }
    }

    if (filters?.dateFrom) {
      query = query.gte('fecha', filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte('fecha', filters.dateTo);
    }

    if (filters?.studentId) {
      query = query.eq('id_estudiante', filters.studentId);
    }

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('estado', filters.status);
      } else {
        query = query.eq('estado', filters.status);
      }
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener registros de llegada:', error);
      return { records: [], error: error.message };
    }

    const limits = await fetchArrivalLimits();
    const records = (data || []).map((row) => {
      if (row.hora_llegada && row.hora_llegada.length > 5) {
        row.hora_llegada = row.hora_llegada.substring(0, 5);
      }
      const mapped = mapArrivalRecord(row);
      const nivel = mapped.student?.level ?? row.estudiante?.nivel_educativo ?? null;
      return applyScanStatus(mapped, limits, nivel);
    });

    return { records, error: null };
  } catch (error: any) {
    console.error('Error al obtener registros de llegada:', error);
    return { records: [], error: error.message };
  }
}

const CLASSROOM_ARRIVAL_BATCH_SIZE = 100;

type ClassroomArrivalRow = Pick<
  RegistroLlegadaDB,
  'id_registro' | 'id_estudiante' | 'fecha' | 'hora_llegada' | 'hora_salida' | 'estado' | 'tipo_salida' | 'registrado_por' | 'fecha_creacion'
>;

function mapClassroomArrivalRow(row: ClassroomArrivalRow): ArrivalRecord {
  let arrivalTime = row.hora_llegada;
  if (arrivalTime && arrivalTime.length > 5) {
    arrivalTime = arrivalTime.substring(0, 5);
  }
  let departureTime = row.hora_salida || null;
  if (departureTime && departureTime.length > 5) {
    departureTime = departureTime.substring(0, 5);
  }
  return {
    id: row.id_registro,
    studentId: row.id_estudiante,
    date: row.fecha,
    arrivalTime,
    status: row.estado,
    registeredBy: row.registrado_por,
    createdAt: row.fecha_creacion,
    departureTime,
    departureType: row.tipo_salida ?? null,
  };
}

/**
 * Llegadas del día para un conjunto de estudiantes (p. ej. lista de salón docente).
 */
export async function getArrivalsForStudents(
  studentIds: number[],
  date?: string,
): Promise<{ records: ArrivalRecord[]; error: string | null }> {
  const uniqueIds = [...new Set(studentIds)].filter((id) => id > 0);
  if (uniqueIds.length === 0) {
    return { records: [], error: null };
  }

  const dateKey = date ?? getLimaTodayDate();

  try {
    const rows: ClassroomArrivalRow[] = [];

    for (let i = 0; i < uniqueIds.length; i += CLASSROOM_ARRIVAL_BATCH_SIZE) {
      const batch = uniqueIds.slice(i, i + CLASSROOM_ARRIVAL_BATCH_SIZE);
      const { data, error } = await supabase
        .from('registros_llegada')
        .select(
          'id_registro, id_estudiante, fecha, hora_llegada, hora_salida, estado, tipo_salida, registrado_por, fecha_creacion',
        )
        .in('id_estudiante', batch)
        .eq('fecha', dateKey);

      if (error) {
        console.error('Error al obtener llegadas del salón:', error);
        return { records: [], error: error.message };
      }
      rows.push(...((data ?? []) as ClassroomArrivalRow[]));
    }

    const limits = await fetchArrivalLimits();
    const records = rows.map((row) => applyScanStatus(mapClassroomArrivalRow(row), limits, null));

    return { records, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener asistencia';
    console.error('Error en getArrivalsForStudents:', error);
    return { records: [], error: message };
  }
}

const ARRIVAL_REPORT_BATCH_SIZE = 150;

type ArrivalReportRow = Pick<
  RegistroLlegadaDB,
  'id_estudiante' | 'fecha' | 'hora_llegada' | 'estado' | 'motivo_justificacion'
>;

async function fetchArrivalsForReport(
  studentIds: number[],
  startStr: string,
  endStr: string,
): Promise<{ rows: ArrivalReportRow[]; error: string | null }> {
  if (studentIds.length === 0) {
    return { rows: [], error: null };
  }

  const allRows: ArrivalReportRow[] = [];
  for (let i = 0; i < studentIds.length; i += ARRIVAL_REPORT_BATCH_SIZE) {
    const batch = studentIds.slice(i, i + ARRIVAL_REPORT_BATCH_SIZE);
    const { data, error } = await supabase
      .from('registros_llegada')
      .select('id_estudiante, fecha, hora_llegada, estado, motivo_justificacion')
      .in('id_estudiante', batch)
      .gte('fecha', startStr)
      .lte('fecha', endStr);

    if (error) {
      return { rows: [], error: error.message };
    }
    if (data?.length) {
      allRows.push(...(data as ArrivalReportRow[]));
    }
  }

  return { rows: allRows, error: null };
}

/**
 * Obtener reporte mensual de asistencia
 */
export async function getMonthlyAttendance(filters: {
  month: number; // 1-12
  year: number;
  level?: EducationalLevel;
  grade?: string;
  section?: string;
  bimestre?: number; // 1-4
  añoEscolar?: number;
}): Promise<{ rows: MonthlyAttendanceRow[]; daysInMonth: number; error: string | null }> {
  try {
    const startDate = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const endDate = new Date(Date.UTC(filters.year, filters.month, 0));
    const daysInMonth = endDate.getUTCDate();
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Obtener estudiantes del filtro (vía RPC con token de sesión)
    const { students: studentsList, error: studentsError } = await studentsService.getAll({
      active: true,
      fetchAll: true,
      level: filters.level,
      grade: filters.grade,
      section: filters.section,
    });

    if (studentsError) {
      console.error('Error al obtener estudiantes para reporte mensual:', studentsError);
      return { rows: [], daysInMonth, error: studentsError };
    }

    const studentsData = studentsList.map((st) => ({
      id_estudiante: st.id,
      nombre_completo: st.fullName,
      grado: st.grade,
      seccion: st.section,
      nivel_educativo: st.level,
      codigo_barras: st.barcode,
      foto_perfil: st.profilePhoto,
      activo: st.active,
    }));

    const studentIds = (studentsData || []).map((st) => st.id_estudiante);
    if (studentIds.length === 0) {
      return { rows: [], daysInMonth, error: null };
    }

    const { rows: arrivalsData, error: arrivalsError } = await fetchArrivalsForReport(
      studentIds,
      startStr,
      endStr,
    );

    if (arrivalsError) {
      console.error('Error al obtener registros mensuales de llegada:', arrivalsError);
      return { rows: [], daysInMonth, error: arrivalsError };
    }

    const recordsMap = new Map<number, Map<number, ArrivalReportRow>>();
    arrivalsData.forEach((record) => {
      const dateObj = new Date(record.fecha);
      const day = dateObj.getUTCDate();
      if (!recordsMap.has(record.id_estudiante)) {
        recordsMap.set(record.id_estudiante, new Map());
      }
      recordsMap.get(record.id_estudiante)!.set(day, record);
    });

    const rows: MonthlyAttendanceRow[] = (studentsData || []).map((student) => {
      const dayStatusMap = recordsMap.get(student.id_estudiante) || new Map();
      const totals = emptyAttendanceTotals();

      const days = Array.from({ length: daysInMonth }, (_, idx) => {
        const day = idx + 1;
        const record = dayStatusMap.get(day);
        const status = convertArrivalEstadoToReport(record?.estado);
        tallyAttendanceStatus(totals, status);
        return {
          day,
          status,
          arrivalTime: record?.hora_llegada,
          justificationReason: record?.motivo_justificacion ?? undefined,
        };
      });

      return {
        student: {
          id: student.id_estudiante,
          fullName: student.nombre_completo,
          grade: student.grado,
          section: student.seccion,
          level: student.nivel_educativo,
          barcode: student.codigo_barras,
          profilePhoto: student.foto_perfil,
          active: student.activo,
        },
        days,
        totals,
      };
    });

    return { rows, daysInMonth, error: null };
  } catch (error: any) {
    console.error('Error en getMonthlyAttendance:', error);
    return { rows: [], daysInMonth: 0, error: error.message || 'Error al generar reporte mensual' };
  }
}

/**
 * Obtener estadísticas de llegadas del día
 */
/**
 * Obtener reporte bimestral de asistencia
 */
export async function getBimestralAttendance(filters: {
  bimestre: number; // 1-4
  añoEscolar: number;
  level?: EducationalLevel;
  grade?: string;
  section?: string;
}): Promise<{ rows: MonthlyAttendanceRow[]; daysInBimestre: number; error: string | null }> {
  try {
    // Importar utilidades de bimestres
    const { getBimestreDates } = await import('@/lib/utils/bimestreUtils');
    const { inicio, fin } = getBimestreDates(filters.bimestre as 1 | 2 | 3 | 4, filters.añoEscolar);
    
    const startStr = inicio.toISOString().split('T')[0];
    const endStr = fin.toISOString().split('T')[0];
    
    // Calcular días totales en el bimestre
    const daysInBimestre = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { students: studentsList, error: studentsError } = await studentsService.getAll({
      active: true,
      fetchAll: true,
      level: filters.level,
      grade: filters.grade,
      section: filters.section,
    });

    if (studentsError) {
      console.error('Error al obtener estudiantes para reporte bimestral:', studentsError);
      return { rows: [], daysInBimestre, error: studentsError };
    }

    const studentsData = studentsList.map((st) => ({
      id_estudiante: st.id,
      nombre_completo: st.fullName,
      grado: st.grade,
      seccion: st.section,
      nivel_educativo: st.level,
      codigo_barras: st.barcode,
      foto_perfil: st.profilePhoto,
      activo: st.active,
    }));

    const studentIds = (studentsData || []).map((st) => st.id_estudiante);
    if (studentIds.length === 0) {
      return { rows: [], daysInBimestre, error: null };
    }

    const { rows: arrivalsData, error: arrivalsError } = await fetchArrivalsForReport(
      studentIds,
      startStr,
      endStr,
    );

    if (arrivalsError) {
      console.error('Error al obtener registros bimestrales de llegada:', arrivalsError);
      return { rows: [], daysInBimestre, error: arrivalsError };
    }

    const recordsMap = new Map<number, Map<string, ArrivalReportRow>>();
    arrivalsData.forEach((record) => {
      const dateKey = record.fecha;
      if (!recordsMap.has(record.id_estudiante)) {
        recordsMap.set(record.id_estudiante, new Map());
      }
      recordsMap.get(record.id_estudiante)!.set(dateKey, record);
    });

    // Crear array de todas las fechas del bimestre
    const allDates: string[] = [];
    const currentDate = new Date(inicio);
    while (currentDate <= fin) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const rows: MonthlyAttendanceRow[] = (studentsData || []).map((student) => {
      const dayStatusMap = recordsMap.get(student.id_estudiante) || new Map();
      const totals = emptyAttendanceTotals();

      const days = allDates.map((dateStr) => {
        const record = dayStatusMap.get(dateStr);
        const status = convertArrivalEstadoToReport(record?.estado);
        const dateObj = new Date(dateStr);
        const day = dateObj.getDate();
        tallyAttendanceStatus(totals, status);
        return {
          day,
          status,
          arrivalTime: record?.hora_llegada,
          justificationReason: record?.motivo_justificacion ?? undefined,
        };
      });

      return {
        student: {
          id: student.id_estudiante,
          fullName: student.nombre_completo,
          grade: student.grado,
          section: student.seccion,
          level: student.nivel_educativo,
          barcode: student.codigo_barras,
          profilePhoto: student.foto_perfil,
          active: student.activo,
        },
        days,
        totals,
      };
    });

    return { rows, daysInBimestre, error: null };
  } catch (error: any) {
    console.error('Error en getBimestralAttendance:', error);
    return { rows: [], daysInBimestre: 0, error: error.message || 'Error al generar reporte bimestral' };
  }
}

/** YYYY-MM-DD + delta días (calendario, sin TZ del navegador). */
function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function weekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Obtener tendencia de asistencia (últimos 5 días hábiles).
 * Usa conteos `head` por día/estado para no truncar en el límite de 1000 filas de PostgREST.
 */
export async function getWeeklyAttendanceTrend(): Promise<{
  weeklyData: Array<{
    day: string;
    date: string;
    total: number;
    onTime: number;
    late: number;
  }>;
  error: string | null;
}> {
  try {
    const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const todayKey = getLimaTodayDate();

    const weekDays: { label: string; dateKey: string }[] = [];
    let daysBack = 0;

    while (weekDays.length < 5 && daysBack <= 14) {
      const dateKey = shiftDateKey(todayKey, -daysBack);
      const dayOfWeek = weekdayFromDateKey(dateKey);
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekDays.push({
          label: dayLabels[dayOfWeek],
          dateKey,
        });
      }
      daysBack++;
    }

    weekDays.reverse();

    if (weekDays.length === 0) {
      return { weeklyData: [], error: null };
    }

    const weeklyData = await Promise.all(
      weekDays.map(async ({ label, dateKey }) => {
        const [onTimeRes, lateRes] = await Promise.all([
          supabase
            .from('registros_llegada')
            .select('id_registro', { count: 'exact', head: true })
            .eq('fecha', dateKey)
            .eq('estado', ARRIVAL_ESTADO.ON_TIME),
          supabase
            .from('registros_llegada')
            .select('id_registro', { count: 'exact', head: true })
            .eq('fecha', dateKey)
            .eq('estado', ARRIVAL_ESTADO.LATE),
        ]);

        if (onTimeRes.error) throw onTimeRes.error;
        if (lateRes.error) throw lateRes.error;

        const onTime = onTimeRes.count ?? 0;
        const late = lateRes.count ?? 0;
        return {
          day: label,
          date: dateKey,
          total: onTime + late,
          onTime,
          late,
        };
      }),
    );

    return { weeklyData, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener tendencia de asistencia';
    console.error('Error en getWeeklyAttendanceTrend:', error);
    return { weeklyData: [], error: message };
  }
}

/**
 * Obtener estadísticas de llegadas del día
 */
export async function getTodayStats(): Promise<{
  stats: {
    total: number;
    onTime: number;
    late: number;
  } | null;
  error: string | null;
}> {
  try {
    // Obtener la fecha actual en la zona horaria de Lima
    const todayLima = new Date().toLocaleString('es-PE', { 
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [dd, mm, yyyy] = todayLima.split('/');
    const today = `${yyyy}-${mm}-${dd}`;

    const { data, error } = await supabase
      .from('registros_llegada')
      .select('estado')
      .eq('fecha', today);

    if (error) {
      console.error('Error al obtener estadísticas:', error);
      return { stats: null, error: error.message };
    }

    const stats = {
      total: data.length,
      onTime: data.filter((r) => r.estado === 'A tiempo').length,
      late: data.filter((r) => r.estado === 'Tarde').length,
    };

    return { stats, error: null };
  } catch (error: any) {
    console.error('Error al obtener estadísticas:', error);
    return { stats: null, error: error.message };
  }
}

/**
 * Registrar salida de estudiante
 */
export async function createDepartureRecord(
  registroId: number,
  registeredBy?: number,
  tipoSalida: 'Normal' | 'Autorizada' = 'Normal'
): Promise<{ success: boolean; error: string | null }> {
  const { successCount, error } = await createBulkDepartureRecords(
    [registroId],
    registeredBy,
    tipoSalida,
  );
  return { success: successCount > 0 && !error, error };
}

/**
 * Registrar salida de varios estudiantes a la vez (misma hora y tipo)
 */
export async function createBulkDepartureRecords(
  registroIds: number[],
  registeredBy?: number,
  tipoSalida: 'Normal' | 'Autorizada' = 'Normal',
): Promise<{
  successCount: number;
  skipped: number;
  error: string | null;
  updatedIds: number[];
  departureTime: string | null;
}> {
  const uniqueIds = [...new Set(registroIds)].filter((id) => id > 0);
  if (uniqueIds.length === 0) {
    return { successCount: 0, skipped: 0, error: null, updatedIds: [], departureTime: null };
  }

  try {
    const now = new Date();
    const hours = now.toLocaleString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', hour12: false });
    const minutes = now.toLocaleString('es-PE', { timeZone: 'America/Lima', minute: '2-digit' });
    const formattedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;

    const updateData: Record<string, unknown> = {
      hora_salida: formattedTime,
      fecha_salida: new Date().toISOString(),
      tipo_salida: tipoSalida,
    };

    if (registeredBy) {
      updateData.registrado_salida_por = registeredBy;
    }

    const { data, error } = await supabase
      .from('registros_llegada')
      .update(updateData)
      .in('id_registro', uniqueIds)
      .is('hora_salida', null)
      .select('id_registro');

    if (error) {
      return {
        successCount: 0,
        skipped: uniqueIds.length,
        error: error.message,
        updatedIds: [],
        departureTime: null,
      };
    }

    const updatedIds = (data ?? []).map((row) => Number(row.id_registro)).filter((id) => id > 0);
    return {
      successCount: updatedIds.length,
      skipped: uniqueIds.length - updatedIds.length,
      error: null,
      updatedIds,
      departureTime: formattedTime,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al registrar salidas';
    console.error('Error en createBulkDepartureRecords:', error);
    return {
      successCount: 0,
      skipped: uniqueIds.length,
      error: message,
      updatedIds: [],
      departureTime: null,
    };
  }
}

/**
 * Obtener estudiantes sin salida registrada para una fecha específica
 */
export async function getStudentsWithoutDeparture(date: string): Promise<{
  records: ArrivalRecord[];
  error: string | null;
}> {
  try {
    const { records, error } = await getArrivals({ date });
    
    if (error) {
      return { records: [], error };
    }

    // Filtrar registros que no tienen hora_salida
    const withoutDeparture = records.filter(record => !record.departureTime);
    
    return { records: withoutDeparture, error: null };
  } catch (error: any) {
    console.error('Error en getStudentsWithoutDeparture:', error);
    return { records: [], error: error.message || 'Error al obtener estudiantes sin salida' };
  }
}

/**
 * Obtener alertas de estudiantes sin salida registrada
 * Retorna estudiantes que llegaron pero no tienen salida registrada después de la hora límite
 */
export async function getDepartureAlerts(date?: string, horaLimite?: string): Promise<{
  alerts: Array<{
    record: ArrivalRecord;
    hoursSinceArrival: number;
    isCritical: boolean;
  }>;
  error: string | null;
}> {
  try {
    const targetDate = date || getTodayDate();

    let limitHour = horaLimite || '15:00';
    if (!horaLimite) {
      const { config } = await configService.getByKey('hora_limite_salida');
      limitHour = normalizeTimeValue(config?.value, '15:00');
    }

    const { data, error } = await supabase
      .from('registros_llegada')
      .select(`
        id_registro, id_estudiante, fecha, hora_llegada, hora_salida, estado, fecha_creacion, registrado_por,
        estudiante:estudiantes!registros_llegada_id_estudiante_fkey(
          id_estudiante, nombre_completo, grado, seccion, nivel_educativo, codigo_barras, activo
        )
      `)
      .eq('fecha', targetDate)
      .is('hora_salida', null)
      .order('hora_llegada', { ascending: false })
      .limit(500);

    if (error) {
      return { alerts: [], error: error.message };
    }

    const now = new Date();
    const [limitH, limitM] = limitHour.split(':').map(Number);
    const limitTime = new Date();
    limitTime.setHours(limitH, limitM, 0, 0);

    const alerts = (data ?? [])
      .map((row) => {
        const record = mapArrivalRecord(row as RegistroLlegadaDB & { estudiante?: unknown });
        const [arrivalH, arrivalM] = record.arrivalTime.split(':').map(Number);
        const arrivalTime = new Date();
        arrivalTime.setHours(arrivalH, arrivalM, 0, 0);

        const hoursSinceArrival = (now.getTime() - arrivalTime.getTime()) / (1000 * 60 * 60);
        const isCritical = now > limitTime;

        return {
          record,
          hoursSinceArrival: Math.max(0, hoursSinceArrival),
          isCritical,
        };
      })
      .filter((alert) => alert.isCritical || alert.hoursSinceArrival > 2);

    return { alerts, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener alertas de salida';
    console.error('Error en getDepartureAlerts:', error);
    return { alerts: [], error: message };
  }
}

function getTodayDate(): string {
  return getLimaTodayDate();
}

/** Asistencia de un mes (Lima) para portal público de padres. */
export async function fetchMonthArrivalsForStudent(
  studentId: number,
  year?: number,
  month?: number,
  studentLevel?: string | null,
): Promise<ArrivalRecord[]> {
  const bounds =
    year != null && month != null ? getMonthBounds(year, month) : getLimaMonthBounds();
  const y = year ?? bounds.year;
  const m = month ?? bounds.month;

  let rawRecords: ArrivalRecord[] = [];

  const { data: rpcData, error: rpcError } = await supabase.rpc('asistencia_mes_por_estudiante', {
    p_student_id: studentId,
    p_year: y,
    p_month: m,
  });

  if (!rpcError && rpcData != null) {
    const rows = Array.isArray(rpcData) ? rpcData : [];
    rawRecords = rows.map((row) => mapRpcArrival(row as RpcArrivalRow));
    rawRecords = await mergePublicDepartureTimes(rawRecords, studentId, y, m, bounds);
  } else {
    if (rpcError && rpcError.code !== 'PGRST202' && !rpcError.message?.includes('does not exist')) {
      console.warn('fetchMonthArrivalsForStudent rpc:', rpcError.message);
    }

    const { start, end } = bounds;
    const { data, error } = await supabase
      .from('registros_llegada')
      .select('id_registro, id_estudiante, fecha, hora_llegada, hora_salida, tipo_salida, estado, fecha_creacion, registrado_por')
      .eq('id_estudiante', studentId)
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false });

    if (error) {
      console.warn('fetchMonthArrivalsForStudent:', error.message);
      return [];
    }
    rawRecords = (data || []).map(mapArrivalRow);
  }

  const limits = await fetchPublicArrivalLimits();
  return rawRecords.map((record) => applyScanStatus(record, limits, studentLevel));
}

/**
 * Busca un estudiante por DNI/código de barras y devuelve su llegada de hoy
 * (si existe) junto con los últimos 14 días. Uso público — sin autenticación.
 */
type RpcArrivalRow = {
  id: number;
  studentId: number;
  date: string;
  arrivalTime: string;
  status: string;
  departureTime?: string | null;
  hora_salida?: string | null;
  departureType?: ArrivalRecord['departureType'];
  tipo_salida?: ArrivalRecord['departureType'];
};

type RpcParentLookup = {
  found: boolean;
  student?: {
    id: number;
    fullName: string;
    grade: string;
    section: string;
    level: EducationalLevel;
    barcode: string;
    profilePhoto: string | null;
    active: boolean;
  };
  arrivalToday?: RpcArrivalRow | null;
  recentArrivals?: RpcArrivalRow[];
};

type RpcDepartureRow = {
  id?: number;
  date?: string;
  departureTime?: string | null;
  departureType?: ArrivalRecord['departureType'];
  hora_salida?: string | null;
  tipo_salida?: ArrivalRecord['departureType'];
};

async function mergePublicDepartureTimes(
  records: ArrivalRecord[],
  studentId: number,
  year: number,
  month: number,
  bounds: { start: string; end: string },
): Promise<ArrivalRecord[]> {
  if (records.length === 0 || records.every((record) => record.departureTime)) {
    return records;
  }

  const { data: rpcSalidas } = await supabase.rpc('asistencia_salida_mes_por_estudiante', {
    p_student_id: studentId,
    p_year: year,
    p_month: month,
  });
  const salidaRows = Array.isArray(rpcSalidas) ? (rpcSalidas as RpcDepartureRow[]) : [];

  if (salidaRows.length === 0) {
    const { data: extra } = await supabase
      .from('registros_llegada')
      .select('id_registro, fecha, hora_salida, tipo_salida')
      .eq('id_estudiante', studentId)
      .gte('fecha', bounds.start)
      .lte('fecha', bounds.end);
    if (extra?.length) {
      const byId = new Map(extra.map((row) => [row.id_registro, row]));
      const byDate = new Map(extra.map((row) => [String(row.fecha).slice(0, 10), row]));
      return records.map((record) => {
        const match = byId.get(record.id) ?? byDate.get(String(record.date).slice(0, 10));
        if (!match) return record;
        return {
          ...record,
          departureTime: record.departureTime ?? trimTime(match.hora_salida),
          departureType:
            record.departureType ?? (match.tipo_salida as ArrivalRecord['departureType']) ?? null,
        };
      });
    }
    return records;
  }

  const byId = new Map(salidaRows.filter((row) => row.id != null).map((row) => [row.id, row]));
  const byDate = new Map(
    salidaRows
      .filter((row) => row.date)
      .map((row) => [String(row.date).slice(0, 10), row] as const),
  );

  return records.map((record) => {
    const match = byId.get(record.id) ?? byDate.get(String(record.date).slice(0, 10));
    if (!match) return record;
    return {
      ...record,
      departureTime: record.departureTime ?? trimTime(match.departureTime ?? match.hora_salida),
      departureType: record.departureType ?? match.departureType ?? match.tipo_salida ?? null,
    };
  });
}

function mapRpcArrival(row: RpcArrivalRow): ArrivalRecord {
  return {
    id: row.id,
    studentId: row.studentId,
    date: row.date,
    arrivalTime: trimTime(row.arrivalTime) || row.arrivalTime,
    status: row.status as ArrivalRecord['status'],
    registeredBy: 0,
    createdAt: row.date,
    departureTime: trimTime(row.departureTime ?? row.hora_salida),
    departureType: row.departureType ?? row.tipo_salida ?? null,
  };
}

async function getPublicInfoByDniRpc(dni: string): Promise<{
  arrival: ArrivalRecord | null;
  recentArrivals: ArrivalRecord[];
  student: Student | null;
  error: string | null;
} | null> {
  const { data, error } = await supabase.rpc('buscar_asistencia_por_dni', { p_dni: dni.trim() });
  if (error) {
    // Función no desplegada aún: usar fallback directo.
    if (error.code === 'PGRST202' || error.message?.includes('does not exist')) {
      return null;
    }
    return { arrival: null, recentArrivals: [], student: null, error: error.message };
  }

  const payload = data as RpcParentLookup;
  if (!payload?.found || !payload.student) {
    return {
      arrival: null,
      recentArrivals: [],
      student: null,
      error: 'No se encontró ningún estudiante con ese DNI.',
    };
  }

  const student: Student = {
    id: payload.student.id,
    fullName: payload.student.fullName,
    grade: payload.student.grade,
    section: payload.student.section,
    level: payload.student.level,
    barcode: payload.student.barcode,
    profilePhoto: payload.student.profilePhoto,
    active: payload.student.active,
    reincidenceLevel: 0,
    faultsLast60Days: 0,
  };

  const limits = await fetchPublicArrivalLimits();
  const recentArrivals = await fetchMonthArrivalsForStudent(
    student.id,
    undefined,
    undefined,
    student.level,
  );
  const arrival = payload.arrivalToday
    ? (() => {
        const mapped = mapRpcArrival(payload.arrivalToday!);
        const fromMonth = recentArrivals.find(
          (row) => row.id === mapped.id || String(row.date).slice(0, 10) === String(mapped.date).slice(0, 10),
        );
        const withExit = {
          ...mapped,
          departureTime: mapped.departureTime ?? fromMonth?.departureTime ?? null,
          departureType: mapped.departureType ?? fromMonth?.departureType ?? null,
        };
        const status = resolveArrivalStatusForStudent(
          withExit.arrivalTime,
          limits,
          student.level,
        );
        return status === withExit.status ? withExit : { ...withExit, status };
      })()
    : null;

  return {
    arrival,
    recentArrivals,
    student,
    error: null,
  };
}

export async function getPublicInfoByDNI(dni: string): Promise<{
  arrival: ArrivalRecord | null;
  recentArrivals: ArrivalRecord[];
  student: Student | null;
  error: string | null;
}> {
  try {
    const fromRpc = await getPublicInfoByDniRpc(dni);
    if (fromRpc) return fromRpc;

    const { student, error: studentErr } = await studentsService.getByBarcode(dni.trim(), { skipReincidence: true });
    if (studentErr || !student) {
      return { arrival: null, recentArrivals: [], student: null, error: 'No se encontró ningún estudiante con ese DNI.' };
    }

    const today = getLimaTodayDate();

    const [todayRes, recentArrivals] = await Promise.all([
      getTodayArrivalForStudent(student.id, today, student.level),
      fetchMonthArrivalsForStudent(student.id, undefined, undefined, student.level),
    ]);

    return {
      arrival: todayRes.record,
      recentArrivals,
      student,
      error: null,
    };
  } catch (err) {
    return { arrival: null, recentArrivals: [], student: null, error: err instanceof Error ? err.message : 'Error al buscar el estudiante' };
  }
}

/**
 * Carga pública (sin auth) de un registro de llegada con datos del estudiante
 * y la asistencia del mes en curso. Se usa en /llegada/:id para padres.
 */
export async function getPublicArrivalInfo(recordId: number): Promise<{
  arrival: ArrivalRecord | null;
  recentArrivals: ArrivalRecord[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('registros_llegada')
      .select(`
        id_registro, id_estudiante, fecha, hora_llegada, hora_salida, tipo_salida, estado, fecha_creacion, registrado_por,
        estudiante:estudiantes!registros_llegada_id_estudiante_fkey(
          id_estudiante, nombre_completo, grado, seccion, nivel_educativo,
          foto_perfil, activo, codigo_barras, nombre_responsable, parentesco_responsable,
          telefono_contacto, email_contacto, telefono_emergencia
        )
      `)
      .eq('id_registro', recordId)
      .maybeSingle();

    if (error) return { arrival: null, recentArrivals: [], error: error.message };
    if (!data) return { arrival: null, recentArrivals: [], error: 'Registro no encontrado.' };

    const arrival = mapArrivalRecord(data as any);
    const level =
      arrival.student?.level ??
      (data as { estudiante?: { nivel_educativo?: string } }).estudiante?.nivel_educativo ??
      null;
    const resolvedArrival = await resolveRecordStatus(arrival, level, false);
    const recentArrivals = await fetchMonthArrivalsForStudent(
      arrival.studentId,
      undefined,
      undefined,
      level,
    );
    return { arrival: resolvedArrival, recentArrivals, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al cargar el registro';
    return { arrival: null, recentArrivals: [], error: message };
  }
}

function trimJustificationReason(motivo: string): string {
  return motivo.trim().replace(/\s+/g, ' ');
}

export async function getAttendanceJustifications(filters?: {
  pending?: boolean;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  studentId?: number;
  limit?: number;
}): Promise<{ records: ArrivalRecord[]; error: string | null }> {
  const pending = filters?.pending ?? true;
  return getArrivals({
    date: filters?.date,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    studentId: filters?.studentId,
    status: pending
      ? ARRIVAL_ESTADO.LATE
      : [ARRIVAL_ESTADO.LATE_JUSTIFIED, ARRIVAL_ESTADO.ABSENCE_JUSTIFIED],
    limit: filters?.limit ?? 500,
  });
}

/** Alumnos activos sin llegada (o con estado Falta) en una fecha, para justificar IJ. */
export async function getPendingAbsencesForDate(filters: {
  date: string;
  level?: EducationalLevel;
  grade?: string;
  section?: string;
}): Promise<{ records: ArrivalRecord[]; error: string | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
    return { records: [], error: 'La fecha no es válida.' };
  }

  try {
    let studentQuery = supabase
      .from('estudiantes')
      .select(
        'id_estudiante, nombre_completo, grado, seccion, nivel_educativo, codigo_barras, foto_perfil, activo',
      )
      .eq('activo', true)
      .order('nombre_completo', { ascending: true })
      .range(0, 1999);

    if (filters.level) studentQuery = studentQuery.eq('nivel_educativo', filters.level);
    if (filters.grade) studentQuery = studentQuery.eq('grado', filters.grade);
    if (filters.section) studentQuery = studentQuery.eq('seccion', filters.section);

    const arrivalsQuery = supabase
      .from('registros_llegada')
      .select('id_registro, id_estudiante, estado')
      .eq('fecha', filters.date)
      .range(0, 1999);

    const [studentsRes, arrivalsRes] = await Promise.all([studentQuery, arrivalsQuery]);

    if (studentsRes.error) {
      return { records: [], error: studentsRes.error.message };
    }
    if (arrivalsRes.error) {
      return { records: [], error: arrivalsRes.error.message };
    }

    const present = new Map<number, { id: number; estado: string }>();
    for (const row of arrivalsRes.data ?? []) {
      present.set(row.id_estudiante, { id: row.id_registro, estado: String(row.estado) });
    }

    const pending: ArrivalRecord[] = [];
    for (const row of studentsRes.data ?? []) {
      const arrival = present.get(row.id_estudiante);
      if (arrival && arrival.estado !== 'Falta') continue;

      const student: Student = {
        id: row.id_estudiante,
        fullName: row.nombre_completo,
        grade: row.grado,
        section: row.seccion,
        level: (row.nivel_educativo || 'Secundaria') as EducationalLevel,
        barcode: row.codigo_barras,
        profilePhoto: row.foto_perfil,
        active: row.activo !== false,
      };

      pending.push({
        id: arrival?.id ?? -student.id,
        studentId: student.id,
        student,
        date: filters.date,
        arrivalTime: '',
        status: 'Falta',
        registeredBy: null,
        createdAt: filters.date,
      });
    }

    return { records: pending, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al listar inasistencias';
    return { records: [], error: message };
  }
}

export async function justifyTardiness(
  recordId: number,
  userId: number,
  motivo: string,
): Promise<{ record: ArrivalRecord | null; error: string | null }> {
  const reason = trimJustificationReason(motivo);
  if (reason.length < MIN_JUSTIFICATION_REASON_LENGTH) {
    return {
      record: null,
      error: `El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.`,
    };
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('registros_llegada')
      .select(ARRIVAL_ROW_SELECT)
      .eq('id_registro', recordId)
      .maybeSingle();

    if (fetchError) return { record: null, error: fetchError.message };
    if (!current) return { record: null, error: 'No se encontró el registro de llegada.' };
    if (current.estado === ARRIVAL_ESTADO.LATE_JUSTIFIED) {
      return { record: mapArrivalRow(current as never), error: null };
    }
    if (current.estado !== ARRIVAL_ESTADO.LATE) {
      return { record: null, error: 'Solo se pueden justificar tardanzas pendientes.' };
    }

    const { data, error } = await supabase
      .from('registros_llegada')
      .update({
        estado: ARRIVAL_ESTADO.LATE_JUSTIFIED,
        motivo_justificacion: reason,
        justificado_por: userId,
        fecha_justificacion: new Date().toISOString(),
      })
      .eq('id_registro', recordId)
      .eq('estado', ARRIVAL_ESTADO.LATE)
      .select(ARRIVAL_ROW_SELECT)
      .maybeSingle();

    if (error) return { record: null, error: error.message };
    if (!data) return { record: null, error: 'La tardanza ya no está pendiente.' };
    return { record: mapArrivalRow(data as never), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al justificar la tardanza';
    return { record: null, error: message };
  }
}

export async function createJustifiedAbsence(input: {
  studentId: number;
  date: string;
  motivo: string;
  userId: number;
}): Promise<{ record: ArrivalRecord | null; error: string | null }> {
  const reason = trimJustificationReason(input.motivo);
  if (reason.length < MIN_JUSTIFICATION_REASON_LENGTH) {
    return {
      record: null,
      error: `El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { record: null, error: 'La fecha no es válida.' };
  }

  try {
    const { record: existing, error: existingError } = await getTodayArrivalForStudent(
      input.studentId,
      input.date,
    );
    if (existingError) return { record: null, error: existingError };
    if (existing) {
      if (existing.status === ARRIVAL_ESTADO.LATE) {
        return {
          record: null,
          error: 'Ese día hay una tardanza. Justifíquela desde la lista de tardanzas pendientes.',
        };
      }
      if (isProtectedArrivalStatus(existing.status)) {
        return { record: existing, error: 'Ese día ya está justificado.' };
      }
      return {
        record: null,
        error: 'Ese día ya hay asistencia registrada; no se puede marcar falta justificada.',
      };
    }

    const insertData = {
      id_estudiante: input.studentId,
      fecha: input.date,
      hora_llegada: '00:00:00',
      estado: ARRIVAL_ESTADO.ABSENCE_JUSTIFIED,
      registrado_por: input.userId,
      fecha_creacion: new Date().toISOString(),
      motivo_justificacion: reason,
      justificado_por: input.userId,
      fecha_justificacion: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('registros_llegada')
      .insert(insertData)
      .select(ARRIVAL_ROW_SELECT)
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          record: null,
          error: 'Ya existe un registro de asistencia para ese estudiante y fecha.',
        };
      }
      return { record: null, error: error.message };
    }

    return { record: mapArrivalRow(data as never), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al registrar la falta justificada';
    return { record: null, error: message };
  }
}

export const arrivalService = {
  createArrivalRecord,
  getTodayArrivalForStudent,
  getArrivals,
  getArrivalsForStudents,
  getMonthlyAttendance,
  getBimestralAttendance,
  getWeeklyAttendanceTrend,
  getTodayStats,
  createDepartureRecord,
  createBulkDepartureRecords,
  getStudentsWithoutDeparture,
  getDepartureAlerts,
  prefetchArrivalConfig,
  fetchArrivalLimitTime,
  fetchArrivalLimits,
  invalidateArrivalLimitCache,
  fetchPublicArrivalLimits,
  getPublicArrivalInfo,
  getPublicInfoByDNI,
  fetchMonthArrivalsForStudent,
  getAttendanceJustifications,
  getPendingAbsencesForDate,
  justifyTardiness,
  createJustifiedAbsence,
};
