import { supabase } from '../supabaseClient';
import { getLimaNow, getLimaTodayDate } from '@/lib/utils/limaDateTime';
import {
  resolvePersonalArrivalStatus,
  resolvePersonalDepartureType,
  scheduleForDate,
} from '@/lib/utils/personalSchedule';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import { compressImageForUpload } from '@/lib/utils/compressImage';
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
  motivo_salida: string | null;
  registrado_por: number | null;
  justificado_por_nombre?: string | null;
  fecha_justificacion?: string | null;
  evidencia_ruta?: string | null;
  evidencia_nombre?: string | null;
  evidencia_mime?: string | null;
  evidencia_fecha?: string | null;
  salida_autorizada_por_nombre?: string | null;
  fecha_autorizacion_salida?: string | null;
  salida_evidencia_ruta?: string | null;
  salida_evidencia_nombre?: string | null;
  salida_evidencia_mime?: string | null;
  salida_evidencia_fecha?: string | null;
};

const SELECT_COLS =
  'id_registro, id_personal, fecha, hora_llegada, estado, hora_entrada_esperada, hora_salida_esperada, hora_salida, tipo_salida, motivo_justificacion, motivo_salida, registrado_por, justificado_por_nombre, fecha_justificacion, evidencia_ruta, evidencia_nombre, evidencia_mime, evidencia_fecha, salida_autorizada_por_nombre, fecha_autorizacion_salida, salida_evidencia_ruta, salida_evidencia_nombre, salida_evidencia_mime, salida_evidencia_fecha';

const EVIDENCE_BUCKET = 'evidencias';
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

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
    departureReason: row.motivo_salida,
    registeredBy: row.registrado_por,
    justifiedByName: row.justificado_por_nombre ?? null,
    justifiedAt: row.fecha_justificacion ?? null,
    evidence: row.evidencia_ruta
      ? {
          path: row.evidencia_ruta,
          fileName: row.evidencia_nombre ?? 'evidencia',
          mime: row.evidencia_mime ?? '',
          uploadedAt: row.evidencia_fecha ?? null,
        }
      : null,
    departureAuthorizedByName: row.salida_autorizada_por_nombre ?? null,
    departureAuthorizedAt: row.fecha_autorizacion_salida ?? null,
    departureEvidence: row.salida_evidencia_ruta
      ? {
          path: row.salida_evidencia_ruta,
          fileName: row.salida_evidencia_nombre ?? 'evidencia',
          mime: row.salida_evidencia_mime ?? '',
          uploadedAt: row.salida_evidencia_fecha ?? null,
        }
      : null,
  };
}

/** Evidencia de la justificación (llegada) o del permiso de salida. */
export type EvidenceTarget = 'justificacion' | 'salida';

const EVIDENCE_COLUMNS: Record<EvidenceTarget, { prefix: string; folder: string }> = {
  justificacion: { prefix: 'evidencia', folder: 'personal' },
  salida: { prefix: 'salida_evidencia', folder: 'personal-salida' },
};

/** Normaliza el tipo del archivo de evidencia: JPG, PNG o PDF; null si no se acepta. */
export function evidenceMimeOf(file: Pick<File, 'name' | 'type'>): 'image/jpeg' | 'image/png' | 'application/pdf' | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = file.type.toLowerCase();
  if (type === 'application/pdf' || ext === 'pdf') return 'application/pdf';
  if (type === 'image/png' || ext === 'png') return 'image/png';
  if (type === 'image/jpeg' || type === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
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
   * Llegada con estado según el horario del día: tarde al minuto siguiente de
   * su entrada; después de su hora de salida → inasistencia (Falta, con la hora
   * real); día sin horario → "Fuera de horario". Una por empleado y día.
   * Si la inasistencia automática ya lo marcó, la llegada real la reemplaza.
   */
  async registerArrival(
    personal: Personal,
    userId: number | undefined,
    at?: { date: string; time: string },
  ): Promise<PersonalScanResult> {
    const { date, time } = at ?? getLimaNow();
    const existing = await this.getRecordForDate(personal.id, date);
    if (existing.error) return { ok: false, error: existing.error };
    // Ya marcó (incluye la "Falta" con hora real por llegar después de su salida).
    if (existing.record && (existing.record.status !== 'Falta' || existing.record.arrivalTime)) {
      return { ok: true, action: 'arrival', record: existing.record, duplicate: true };
    }

    const horario = scheduleForDate(personal.schedule, date);
    const estado = resolvePersonalArrivalStatus(time, horario?.entry ?? null, horario?.exit ?? null);
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

  /**
   * Salida: requiere llegada del día. Se compara con la hora de salida del
   * horario VIGENTE (no la foto tomada al llegar). Antes de su hora →
   * "Anticipada" (sin autorización) o "Autorizada" si se marca con permiso y motivo.
   */
  async registerDeparture(
    personal: Personal,
    userId: number | undefined,
    at?: { date: string; time: string },
    permission?: { reason: string },
  ): Promise<PersonalScanResult> {
    const { date, time } = at ?? getLimaNow();
    const existing = await this.getRecordForDate(personal.id, date);
    if (existing.error) return { ok: false, error: existing.error };
    const record = existing.record;
    if (!record || !record.arrivalTime) {
      return { ok: false, error: `${personal.fullName} aún no tiene llegada hoy. Registre primero la llegada.` };
    }
    if (record.status === 'Falta') {
      return { ok: false, error: `${personal.fullName} llegó después de su hora de salida (inasistencia); no se registra salida.` };
    }
    if (record.departureTime) {
      return { ok: true, action: 'departure', record, duplicate: true };
    }
    if (permission && permission.reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH) {
      return { ok: false, error: `El motivo del permiso debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.` };
    }
    const expectedExit = scheduleForDate(personal.schedule, date)?.exit ?? record.expectedExit;
    const tipo = resolvePersonalDepartureType(time, expectedExit, Boolean(permission));
    const authorized = tipo === 'Autorizada';
    const { data, error } = await supabase
      .from('registros_llegada_personal')
      .update({
        hora_salida: time,
        tipo_salida: tipo,
        hora_salida_esperada: expectedExit,
        registrado_salida_por: userId ?? null,
        fecha_salida: new Date().toISOString(),
        ...(authorized
          ? {
              motivo_salida: permission?.reason.trim(),
              salida_autorizada_por: userId ?? null,
              fecha_autorizacion_salida: new Date().toISOString(),
            }
          : {}),
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

  /** Autoriza después una salida anticipada (pasa de "sin autorización" a "autorizada"). */
  async authorizeEarlyDeparture(
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
        tipo_salida: 'Autorizada',
        motivo_salida: reason.trim(),
        salida_autorizada_por: userId,
        fecha_autorizacion_salida: new Date().toISOString(),
      })
      .eq('id_registro', recordId)
      .eq('tipo_salida', 'Anticipada')
      .select('id_registro');
    if (error) return { success: false, error: error.message };
    if (!data?.length) return { success: false, error: 'La salida ya no está como anticipada sin autorización.' };
    return { success: true, error: null };
  },

  async justifyTardiness(
    recordId: number,
    userId: number,
    reason: string,
  ): Promise<{ success: boolean; error: string | null; recordId?: number }> {
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
    return { success: true, error: null, recordId };
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
  }): Promise<{ success: boolean; error: string | null; recordId?: number }> {
    const reason = input.reason.trim();
    if (reason.length < MIN_JUSTIFICATION_REASON_LENGTH) {
      return { success: false, error: `El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.` };
    }
    const existing = await this.getRecordForDate(input.personal.id, input.date);
    if (existing.error) return { success: false, error: existing.error };
    let recordId: number | undefined;
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
      recordId = existing.record.id;
    } else {
      const horario = scheduleForDate(input.personal.schedule, input.date);
      const { data: inserted, error } = await supabase.from('registros_llegada_personal').insert({
        id_personal: input.personal.id,
        fecha: input.date,
        hora_llegada: NO_ARRIVAL_TIME,
        hora_entrada_esperada: horario?.entry ?? null,
        hora_salida_esperada: horario?.exit ?? null,
        registrado_por: input.userId,
        ...justification,
      }).select('id_registro').single();
      if (error) return { success: false, error: error.message };
      recordId = (inserted as { id_registro: number }).id_registro;
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

    return { success: true, error: null, recordId };
  },

  /**
   * Sube (o reemplaza) la evidencia de una justificación: foto JPG/PNG o PDF, máx. 5 MB.
   * Va al bucket "evidencias", carpeta personal/{id_registro}/.
   */
  async uploadJustificationEvidence(
    recordId: number,
    file: File,
    userId: number,
    target: EvidenceTarget = 'justificacion',
  ): Promise<{ success: boolean; error: string | null }> {
    const { prefix, folder } = EVIDENCE_COLUMNS[target];
    const mime = evidenceMimeOf(file);
    if (!mime) return { success: false, error: 'Solo se permiten fotos (JPG o PNG) o PDF.' };
    const upload = mime === 'application/pdf' ? file : await compressImageForUpload(file);
    if (upload.size > MAX_EVIDENCE_BYTES) return { success: false, error: 'El archivo no puede superar los 5 MB.' };

    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
    const path = `${folder}/${recordId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, upload, { cacheControl: '3600', upsert: false, contentType: mime });
    if (upErr) return { success: false, error: 'No se pudo subir el archivo.' };

    const { data: prev } = await supabase
      .from('registros_llegada_personal')
      .select(`${prefix}_ruta`)
      .eq('id_registro', recordId)
      .maybeSingle();
    const { data, error } = await supabase
      .from('registros_llegada_personal')
      .update({
        [`${prefix}_ruta`]: path,
        [`${prefix}_nombre`]: file.name,
        [`${prefix}_mime`]: mime,
        [`${prefix}_subida_por`]: userId,
        [`${prefix}_fecha`]: new Date().toISOString(),
      })
      .eq('id_registro', recordId)
      .select('id_registro');
    if (error || !data?.length) {
      await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
      return { success: false, error: error?.message ?? 'No se encontró el registro.' };
    }
    const oldPath = (prev as unknown as Record<string, string | null> | null)?.[`${prefix}_ruta`];
    if (oldPath && oldPath !== path) await supabase.storage.from(EVIDENCE_BUCKET).remove([oldPath]);
    return { success: true, error: null };
  },

  /** URL (firmada si se puede) para ver o descargar la evidencia. */
  async evidenceUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
    return supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(path).data.publicUrl;
  },

  today(): string {
    return getLimaTodayDate();
  },
};
