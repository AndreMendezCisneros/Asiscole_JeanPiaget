import { supabase } from '../supabaseClient';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import type { Personal, PersonalTallerRecord } from '@/types/personal';

type TallerRow = {
  id_registro: number;
  id_personal: number;
  fecha: string;
  hora_llegada: string;
  hora_salida: string | null;
};

const SELECT_COLS = 'id_registro, id_personal, fecha, hora_llegada, hora_salida';

function mapRow(row: TallerRow): PersonalTallerRecord {
  return {
    id: row.id_registro,
    personalId: row.id_personal,
    date: row.fecha,
    arrivalTime: row.hora_llegada.slice(0, 5),
    departureTime: row.hora_salida ? row.hora_salida.slice(0, 5) : null,
  };
}

export type PersonalTallerScanResult =
  | { ok: true; action: 'arrival' | 'departure'; record: PersonalTallerRecord; duplicate: boolean }
  | { ok: false; error: string };

async function findOpen(personalId: number, date: string) {
  return supabase
    .from('personal_taller')
    .select(SELECT_COLS)
    .eq('id_personal', personalId)
    .eq('fecha', date)
    .is('hora_salida', null)
    .maybeSingle();
}

export const personalTallerService = {
  /**
   * Entrada al taller. La base rechaza la marca si tiene entrada de clase sin
   * salida; si no asistió en la mañana, puede marcar igual.
   */
  async registerArrival(
    personal: Personal,
    userId: number | undefined,
    at?: { date: string; time: string },
  ): Promise<PersonalTallerScanResult> {
    const { date, time } = at ?? getLimaNow();
    const open = await findOpen(personal.id, date);
    if (open.error) return { ok: false, error: open.error.message };
    if (open.data) {
      return { ok: true, action: 'arrival', record: mapRow(open.data as TallerRow), duplicate: true };
    }

    const { data, error } = await supabase
      .from('personal_taller')
      .insert({ id_personal: personal.id, fecha: date, hora_llegada: time, registrado_por: userId ?? null })
      .select(SELECT_COLS)
      .single();
    if (error) {
      if (error.code === '23505') {
        const again = await findOpen(personal.id, date);
        if (again.data) {
          return { ok: true, action: 'arrival', record: mapRow(again.data as TallerRow), duplicate: true };
        }
      }
      if (error.message.includes('salida de clase')) {
        return { ok: false, error: `${personal.fullName}: primero marque su salida de clase (modo Clase → Salida).` };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, action: 'arrival', record: mapRow(data as TallerRow), duplicate: false };
  },

  /** Salida del taller: cierra el tramo abierto del día. */
  async registerDeparture(
    personal: Personal,
    userId: number | undefined,
    at?: { date: string; time: string },
  ): Promise<PersonalTallerScanResult> {
    const { date, time } = at ?? getLimaNow();
    const open = await findOpen(personal.id, date);
    if (open.error) return { ok: false, error: open.error.message };
    if (!open.data) {
      return { ok: false, error: `${personal.fullName} no tiene entrada al taller abierta hoy.` };
    }
    const { data, error } = await supabase
      .from('personal_taller')
      .update({
        hora_salida: time,
        registrado_salida_por: userId ?? null,
        fecha_salida: new Date().toISOString(),
      })
      .eq('id_registro', (open.data as TallerRow).id_registro)
      .is('hora_salida', null)
      .select(SELECT_COLS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, action: 'departure', record: mapRow(data as TallerRow), duplicate: false };
  },

  async getRecords(filters: { from: string; to: string }): Promise<{ records: PersonalTallerRecord[]; error: string | null }> {
    const pageSize = 1000;
    const all: PersonalTallerRecord[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('personal_taller')
        .select(SELECT_COLS)
        .gte('fecha', filters.from)
        .lte('fecha', filters.to)
        .order('fecha', { ascending: true })
        .order('id_registro', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) return { records: [], error: error.message };
      const rows = (data ?? []) as TallerRow[];
      all.push(...rows.map(mapRow));
      if (rows.length < pageSize) break;
    }
    return { records: all, error: null };
  },
};
