import { supabase } from '../supabaseClient';
import type {
  DiaSemana,
  HorarioDia,
  Personal,
  PersonalCategoria,
  PersonalDB,
  PersonalFormData,
  PersonalHorarioDB,
} from '@/types/personal';
import { validateSchedule } from '@/lib/utils/personalSchedule';
import { formatDateKeyLima } from '@/lib/utils/limaDateTime';

const SELECT_COLS =
  'id_personal, codigo_barras, nombre_completo, categoria, cargo, fecha_nacimiento, direccion, telefono, email, foto_perfil, activo, fecha_creacion, personal_horario(id_personal, dia_semana, hora_entrada, hora_salida)';

function hhmm(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().slice(0, 5);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message);
    if (/personal_codigo_barras_key|duplicate key/i.test(msg)) {
      return 'Ya existe un empleado con ese DNI.';
    }
    return msg;
  }
  return fallback;
}

export function mapHorarioRows(rows: PersonalHorarioDB[] | null | undefined): HorarioDia[] {
  return (rows ?? [])
    .map((r) => ({
      day: r.dia_semana as DiaSemana,
      entry: hhmm(r.hora_entrada) ?? '00:00',
      exit: hhmm(r.hora_salida),
    }))
    .sort((a, b) => a.day - b.day);
}

export function mapPersonalRow(row: PersonalDB): Personal {
  return {
    id: row.id_personal,
    barcode: row.codigo_barras,
    fullName: row.nombre_completo,
    category: row.categoria,
    position: row.cargo,
    birthDate: row.fecha_nacimiento,
    address: row.direccion,
    phone: row.telefono,
    email: row.email,
    profilePhoto: row.foto_perfil,
    active: row.activo,
    createdAt: row.fecha_creacion ? formatDateKeyLima(new Date(row.fecha_creacion)) : '',
    schedule: mapHorarioRows(row.personal_horario),
  };
}

function toRowPayload(data: Partial<PersonalFormData>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const opt = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t ? t : null;
  };
  if (data.barcode !== undefined) payload.codigo_barras = data.barcode.trim();
  if (data.fullName !== undefined) payload.nombre_completo = data.fullName.trim();
  if (data.category !== undefined) payload.categoria = data.category;
  if (data.position !== undefined) payload.cargo = opt(data.position);
  if (data.birthDate !== undefined) payload.fecha_nacimiento = opt(data.birthDate);
  if (data.address !== undefined) payload.direccion = opt(data.address);
  if (data.phone !== undefined) payload.telefono = opt(data.phone);
  if (data.email !== undefined) payload.email = opt(data.email);
  if (data.profilePhoto !== undefined) payload.foto_perfil = opt(data.profilePhoto);
  if (data.active !== undefined) payload.activo = data.active;
  return payload;
}

async function replaceSchedule(personalId: number, schedule: HorarioDia[]): Promise<string | null> {
  const { error: delError } = await supabase
    .from('personal_horario')
    .delete()
    .eq('id_personal', personalId);
  if (delError) return errorMessage(delError, 'No se pudo actualizar el horario');
  if (schedule.length === 0) return null;
  const { error } = await supabase.from('personal_horario').insert(
    schedule.map((h) => ({
      id_personal: personalId,
      dia_semana: h.day,
      hora_entrada: h.entry,
      hora_salida: h.exit,
    })),
  );
  return error ? errorMessage(error, 'No se pudo guardar el horario') : null;
}

export const personalService = {
  async getAll(filters?: {
    active?: boolean;
    category?: PersonalCategoria;
  }): Promise<{ personal: Personal[]; error: string | null }> {
    let q = supabase.from('personal').select(SELECT_COLS).order('nombre_completo', { ascending: true });
    if (filters?.active !== undefined) q = q.eq('activo', filters.active);
    if (filters?.category) q = q.eq('categoria', filters.category);
    const { data, error } = await q;
    if (error) return { personal: [], error: errorMessage(error, 'No se pudo cargar el personal') };
    return { personal: ((data ?? []) as unknown as PersonalDB[]).map(mapPersonalRow), error: null };
  },

  /** Busca un empleado activo por DNI (carnet). Tolera ceros a la izquierda perdidos. */
  async getByBarcode(code: string): Promise<{ personal: Personal | null; error: string | null }> {
    const digits = code.replace(/\s+/g, '').trim();
    if (!digits) return { personal: null, error: null };
    const variants = new Set([digits, digits.replace(/^0+/, '')]);
    if (/^\d{1,8}$/.test(digits)) variants.add(digits.padStart(8, '0'));
    const { data, error } = await supabase
      .from('personal')
      .select(SELECT_COLS)
      .in('codigo_barras', [...variants].filter(Boolean))
      .eq('activo', true)
      .limit(1);
    if (error) return { personal: null, error: errorMessage(error, 'Error al buscar personal') };
    const row = (data ?? [])[0] as unknown as PersonalDB | undefined;
    return { personal: row ? mapPersonalRow(row) : null, error: null };
  },

  async searchByName(query: string, limit = 8): Promise<{ personal: Personal[]; error: string | null }> {
    const term = query.trim().replace(/[%_,()]/g, ' ').trim();
    if (term.length < 2) return { personal: [], error: null };
    let q = supabase.from('personal').select(SELECT_COLS).eq('activo', true);
    for (const word of term.split(/\s+/).filter(Boolean)) {
      q = /^\d+$/.test(word) ? q.ilike('codigo_barras', `%${word}%`) : q.ilike('nombre_completo', `%${word}%`);
    }
    const { data, error } = await q.order('nombre_completo').limit(limit);
    if (error) return { personal: [], error: errorMessage(error, 'Error al buscar personal') };
    return { personal: ((data ?? []) as unknown as PersonalDB[]).map(mapPersonalRow), error: null };
  },

  async create(data: PersonalFormData): Promise<{ personal: Personal | null; error: string | null }> {
    const scheduleError = validateSchedule(data.schedule);
    if (scheduleError) return { personal: null, error: scheduleError };
    const { data: row, error } = await supabase
      .from('personal')
      .insert(toRowPayload(data))
      .select('id_personal')
      .single();
    if (error || !row) return { personal: null, error: errorMessage(error, 'No se pudo crear el empleado') };
    const id = (row as { id_personal: number }).id_personal;
    const horarioError = await replaceSchedule(id, data.schedule);
    if (horarioError) return { personal: null, error: horarioError };
    return this.getById(id);
  },

  async update(
    id: number,
    data: Partial<PersonalFormData>,
  ): Promise<{ success: boolean; error: string | null }> {
    if (data.schedule) {
      const scheduleError = validateSchedule(data.schedule);
      if (scheduleError) return { success: false, error: scheduleError };
    }
    const payload = toRowPayload(data);
    if (Object.keys(payload).length > 0) {
      payload.fecha_actualizacion = new Date().toISOString();
      const { error } = await supabase.from('personal').update(payload).eq('id_personal', id);
      if (error) return { success: false, error: errorMessage(error, 'No se pudo actualizar') };
    }
    if (data.schedule) {
      const horarioError = await replaceSchedule(id, data.schedule);
      if (horarioError) return { success: false, error: horarioError };
    }
    return { success: true, error: null };
  },

  async getById(id: number): Promise<{ personal: Personal | null; error: string | null }> {
    const { data, error } = await supabase.from('personal').select(SELECT_COLS).eq('id_personal', id).single();
    if (error) return { personal: null, error: errorMessage(error, 'Empleado no encontrado') };
    return { personal: mapPersonalRow(data as unknown as PersonalDB), error: null };
  },

  /** DNIs (de la lista) que ya pertenecen a un estudiante: chocarían en el escáner. */
  async findStudentBarcodeCollisions(barcodes: string[]): Promise<string[]> {
    if (barcodes.length === 0) return [];
    const { data, error } = await supabase
      .from('estudiantes')
      .select('codigo_barras')
      .in('codigo_barras', barcodes);
    if (error) return [];
    return (data ?? []).map((r) => (r as { codigo_barras: string }).codigo_barras);
  },

  /**
   * Importa empleados nuevos (por DNI). Los DNIs que ya existen se saltan.
   * Devuelve cuántos se crearon y los errores por fila.
   */
  async bulkImport(
    rows: PersonalFormData[],
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    const { data: existing } = await supabase
      .from('personal')
      .select('codigo_barras')
      .in('codigo_barras', rows.map((r) => r.barcode));
    const existingSet = new Set((existing ?? []).map((r) => (r as { codigo_barras: string }).codigo_barras));
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (existingSet.has(row.barcode)) {
        skipped += 1;
        continue;
      }
      const { error } = await this.create(row);
      if (error) errors.push(`${row.fullName}: ${error}`);
      else created += 1;
    }
    return { created, skipped, errors };
  },
};
