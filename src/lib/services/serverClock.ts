import { supabase } from '../supabaseClient';

export type LimaClock = {
  date: string;
  time: string;
};

/**
 * Fecha y hora de Lima según Postgres (`sie_reloj_lima`), no el reloj de la laptop.
 */
export async function fetchServerLimaClock(): Promise<LimaClock> {
  const { data, error } = await supabase.rpc('sie_reloj_lima');
  if (error) {
    throw new Error('No se pudo leer la hora del servidor. Ejecute sql/migraciones/RELOJ_LIMA_SERVIDOR.sql');
  }

  const row = Array.isArray(data) ? data[0] : data;
  const date = String(row?.fecha ?? '').slice(0, 10);
  const time = String(row?.hora ?? '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('El reloj del servidor no devolvió fecha y hora.');
  }
  return { date, time };
}
