import { supabase } from '../supabaseClient';
import { getLimaNow, getLimaTodayDate } from '@/lib/utils/limaDateTime';
import {
  resolvePersonalArrivalStatus,
  resolvePersonalDepartureType,
  scheduleForDate,
} from '@/lib/utils/personalSchedule';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import type {
  Personal,
  PersonalArrivalEstado,
  PersonalArrivalRecord,
  PersonalDepartureType,
} from '@/types/personal';

type RegistroPersonalRow = {
  id_registro: number;
  id_personal: number;
  fecha: string;
  hora_llegada: string | null;
  estado: PersonalArrivalEstado;
  hora_entrada_esperada: string | null;
  hora_salida_esperada: string | null;
  hora_salida: string | null;
  tipo_salida: PersonalDepartureType | null;
  motivo_justificacion: string | null;
  registrado_por: number | null;
};

const SELECT_COLS =
  'id_registro, id_personal, fecha, hora_llegada, estado, hora_entrada_esperada, hora_salida_esperada, hora_salida, tipo_salida, motivo_justificacion, registrado_por';

/** Hora 00:00 = registro sin llegada real (falta marcada o justificada sin escaneo). */
const NO_ARRIVAL_TIME = '00:00:00';

function hhmm(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim().slice(0, 5);
  return t || null;
}

export function mapPersonalArrivalRow(row: RegistroPersonalRow): PersonalArrivalRecord {
  const arrival = hhmm(row.hora_llegada);
  return {
    id: row.id_registro,
    personalId: row.id_personal,
    date: row.fecha,
    arrivalTime: arrival === '00:00' && (row.estado === 'Falta' || row.estado === 'Falta justificada') ? null : arrival,
    status: row.estado,
    expectedEntry: hhmm(row.hora_entrada_esperada),
    expectedExit: hhmm(row.hora_salida_esperada),
    departureTime: hhmm(row.hora_salida),
    departureType: row.tipo_salida,
    justificationReason: row.motivo_justificacion,
    registeredBy: row.registrado_por,
  };
}

export type PersonalScanResult =
  | { ok: true; action: 'arrival' | 'departure'; record: PersonalArrivalRecord; duplicate: boolean }
  | { ok: false; error: string };

export const personalAttendanceService = {
  async getRecordForDate(
    personalId: number,
    date: string,
  ): Promise<{ record: PersonalArrivalRecord | null; error: string | null }> {
    const { data, error } = await supabase
      .from('registros_llegada_personal')
      .select(SELECT_COLS)
      .eq('id_personal', personalId)
      .eq('fecha', date)
      .maybeSingle();
    if (error) return { record: null, error: error.message };
    return { record: data ? mapPersonalArrivalRow(data as RegistroPersonalRow) : null, error: null };
  },

  /**
   * Llegada con estado según el horario del día (tarde al minuto siguiente;
   * día sin horario → "Fuera de horario"). Una por empleado y día.
   */
  async registerArrival(
    personal: Personal,
    userId: number | undefined,
    at?: { date: string; time: string },
  ): Promise<PersonalScanResult> {
    const { date, time } = at ?? getLimaNow();
    const existing = await this.getRecordForDate(personal.id, date);
    if (existing.error) return { ok: false, error: existing.error };
    if (existing.record && existing.record.status !== 'Falta') {
      return { ok: true, action: 'arrival', record: existing.record, duplicate: true };
    }

    const horario = scheduleForDate(personal.schedule, date);
    const estado = resolvePersonalArrivalStatus(time, horario?.entry ?? null);
    const payload = {
      id_personal: personal.id,
      fecha: date,
      hora_llegada: time,
      estado,
      hora_entrada_esperada: horario?.entry ?? null,
      hora_salida_esperada: horario?.exit ?? null,
      registrado_por: userId ?? null,
    };

    // Si el cierre ya lo marcó como Falta (escaneo tardío del mismo día), se corrige con la llegada real.
    const query = existing.record
      ? supabase.from('registros_llegada_personal').update(payload).eq('id_registro', existing.record.id)
      : supabase.from('registros_llegada_personal').insert(payload);
    const { data, error } = await query.select(SELECT_COLS).single();

    if (error) {
      if (error.code === '23505') {
        const again = await this.getRecordForDate(personal.id, date);
        if (again.record) return { ok: true, action: 'arrival', record: again.record, duplicate: true };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, action: 'arrival', record: mapPersonalArrivalRow(data as RegistroPersonalRow), duplicate: false };
  },

  /** Salida: requiere llegada del día; "Anticipada" si sale antes de su hora de salida. */
  async registerDeparture(
    personal: Personal,
    userId: number | undefined,
    at?: { date: string; time: string },
    departureType?: PersonalDepartureType,
  ): Promise<PersonalScanResult> {
    const { date, time } = at ?? getLimaNow();
    const existing = await this.getRecordForDate(personal.id, date);
    if (existing.error) return { ok: false, error: existing.error };
    const record = existing.record;
    if (!record || !record.arrivalTime) {
      return { ok: false, error: `${personal.fullName} aún no tiene llegada hoy. Registre primero la llegada.` };
    }
    if (record.departureTime) {
      return { ok: true, action: 'departure', record, duplicate: true };
    }
    const tipo = departureType ?? resolvePersonalDepartureType(time, record.expectedExit);
    const { data, error } = await supabase
      .from('registros_llegada_personal')
      .update({
        hora_salida: time,
        tipo_salida: tipo,
        registrado_salida_por: userId ?? null,
        fecha_salida: new Date().toISOString(),
      })
      .eq('id_registro', record.id)
      .is('hora_salida', null)
      .select(SELECT_COLS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, action: 'departure', record: mapPersonalArrivalRow(data as RegistroPersonalRow), duplicate: false };
  },

  async getRecords(filters: {
    from: string;
    to: string;
    personalId?: number;
  }): Promise<{ records: PersonalArrivalRecord[]; error: string | null }> {
    const pageSize = 1000;
    const all: PersonalArrivalRecord[] = [];
    for (let from = 0; ; from += pageSize) {
      let q = supabase
        .from('registros_llegada_personal')
        .select(SELECT_COLS)
        .gte('fecha', filters.from)
        .lte('fecha', filters.to)
        .order('fecha', { ascending: true })
        .order('id_registro', { ascending: true })
        .range(from, from + pageSize - 1);
      if (filters.personalId) q = q.eq('id_personal', filters.personalId);
      const { data, error } = await q;
      if (error) return { records: [], error: error.message };
      const rows = (data ?? []) as RegistroPersonalRow[];
      all.push(...rows.map(mapPersonalArrivalRow));
      if (rows.length < pageSize) break;
    }
    return { records: all, error: null };
  },

  /** Corrige la hora de llegada (recalcula el estado con la hora esperada guardada). */
  async updateArrivalTime(
    record: PersonalArrivalRecord,
    newTime: string,
  ): Promise<{ record: PersonalArrivalRecord | null; error: string | null }> {
    if (record.status === 'Tarde justificada' || record.status === 'Falta justificada') {
      return { record: null, error: 'El registro ya está justificado.' };
    }
    const estado = resolvePersonalArrivalStatus(newTime, record.expectedEntry);
    const { data, error } = await supabase
      .from('registros_llegada_personal')
      .update({ hora_llegada: newTime, estado })
      .eq('id_registro', record.id)
      .select(SELECT_COLS)
      .single();
    if (error) return { record: null, error: error.message };
    return { record: mapPersonalArrivalRow(data as RegistroPersonalRow), error: null };
  },

  async justifyTardiness(
    recordId: number,
    userId: number,
    reason: string,
  ): Promise<{ success: boolean; error: string | null }> {
    if (reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH) {
      return { success: false, error: `El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.` };
    }
    const { data, error } = await supabase
      .from('registros_llegada_personal')
      .update({
        estado: 'Tarde justificada',
        motivo_justificacion: reason.trim(),
        justificado_por: userId,
        fecha_justificacion: new Date().toISOString(),
      })
      .eq('id_registro', recordId)
      .eq('estado', 'Tarde')
      .select('id_registro');
    if (error) return { success: false, error: error.message };
    if (!data?.length) return { success: false, error: 'La tardanza ya no está pendiente.' };
    return { success: true, error: null };
  },

  /**
   * Justifica una inasistencia: convierte la "Falta" del cierre o crea el registro
   * si aún no existe. También anula la incidencia automática de ese día.
   */
  async justifyAbsence(input: {
    personal: Personal;
    date: string;
    userId: number;
    reason: string;
  }): Promise<{ success: boolean; error: string | null }> {
    const reason = input.reason.trim();
    if (reason.length < MIN_JUSTIFICATION_REASON_LENGTH) {
      return { success: false, error: `El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.` };
    }
    const existing = await this.getRecordForDate(input.personal.id, input.date);
    if (existing.error) return { success: false, error: existing.error };
    const justification = {
      estado: 'Falta justificada',
      motivo_justificacion: reason,
      justificado_por: input.userId,
      fecha_justificacion: new Date().toISOString(),
    };

    if (existing.record) {
      if (existing.record.status !== 'Falta') {
        return { success: false, error: 'Ese día tiene llegada registrada; no es una inasistencia.' };
      }
      const { error } = await supabase
        .from('registros_llegada_personal')
        .update(justification)
        .eq('id_registro', existing.record.id);
      if (error) return { success: false, error: error.message };
    } else {
      const horario = scheduleForDate(input.personal.schedule, input.date);
      const { error } = await supabase.from('registros_llegada_personal').insert({
        id_personal: input.personal.id,
        fecha: input.date,
        hora_llegada: NO_ARRIVAL_TIME,
        hora_entrada_esperada: horario?.entry ?? null,
        hora_salida_esperada: horario?.exit ?? null,
        registrado_por: input.userId,
        ...justification,
      });
      if (error) return { success: false, error: error.message };
    }

    // La incidencia "Falta" automática de ese día pasa a Justificada.
    const dayStart = `${input.date}T00:00:00-05:00`;
    const dayEnd = `${input.date}T23:59:59-05:00`;
    await supabase
      .from('incidencias_personal')
      .update({
        estado: 'Justificada',
        motivo_anulacion: reason,
        id_usuario_anulacion: input.userId,
        fecha_anulacion: new Date().toISOString(),
      })
      .eq('id_personal', input.personal.id)
      .eq('estado', 'Activa')
      .gte('fecha_hora_registro', dayStart)
      .lte('fecha_hora_registro', dayEnd)
      .like('observaciones', 'Generada automáticamente%');

    return { success: true, error: null };
  },

  today(): string {
    return getLimaTodayDate();
  },
};
