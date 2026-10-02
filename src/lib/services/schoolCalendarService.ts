import { supabase } from '@/lib/supabaseClient';

/** Días no lectivos activos entre dos fechas. Si falla la lectura, devuelve vacío (solo se omiten fines de semana). */
export async function fetchNonSchoolDays(from: string, to: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('calendario_no_lectivo')
    .select('fecha')
    .eq('activo', true)
    .gte('fecha', from.slice(0, 10))
    .lte('fecha', to.slice(0, 10));
  if (error || !data) return new Set();
  return new Set(data.map((row: { fecha: string }) => String(row.fecha).slice(0, 10)));
}
