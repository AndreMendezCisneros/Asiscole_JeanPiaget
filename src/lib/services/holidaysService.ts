import { supabase } from '../supabaseClient';

export type CalendarioNoLectivoTipo = 'nacional' | 'colegio';
export type CalendarioNoLectivoOrigen = 'seed' | 'manual';

export interface CalendarioNoLectivo {
  id: number;
  fecha: string;
  nombre: string;
  tipo: CalendarioNoLectivoTipo;
  activo: boolean;
  origen: CalendarioNoLectivoOrigen;
  fechaCreacion?: string;
}

export interface CalendarioNoLectivoDB {
  id: number;
  fecha: string;
  nombre: string;
  tipo: CalendarioNoLectivoTipo;
  activo: boolean;
  origen: CalendarioNoLectivoOrigen;
  fecha_creacion?: string;
}

/** Feriados nacionales Perú 2026 (idempotente al insertar). */
export const FERIADOS_NACIONALES_PE_2026: Array<{ fecha: string; nombre: string }> = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-04-02', nombre: 'Jueves Santo' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajo' },
  { fecha: '2026-06-07', nombre: 'Batalla de Arica y Día de la Bandera' },
  { fecha: '2026-06-29', nombre: 'San Pedro y San Pablo' },
  { fecha: '2026-07-23', nombre: 'Día de la Fuerza Aérea del Perú' },
  { fecha: '2026-07-28', nombre: 'Fiestas Patrias' },
  { fecha: '2026-07-29', nombre: 'Fiestas Patrias' },
  { fecha: '2026-08-06', nombre: 'Batalla de Junín' },
  { fecha: '2026-08-30', nombre: 'Santa Rosa de Lima' },
  { fecha: '2026-10-08', nombre: 'Combate de Angamos' },
  { fecha: '2026-11-01', nombre: 'Día de Todos los Santos' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2026-12-09', nombre: 'Batalla de Ayacucho' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
];

function mapRow(row: CalendarioNoLectivoDB): CalendarioNoLectivo {
  return {
    id: row.id,
    fecha: String(row.fecha).slice(0, 10),
    nombre: row.nombre,
    tipo: row.tipo,
    activo: row.activo,
    origen: row.origen,
    fechaCreacion: row.fecha_creacion,
  };
}

/**
 * Días sin clases / feriados (tabla calendario_no_lectivo).
 */
export const holidaysService = {
  async listByYear(year: number): Promise<{ items: CalendarioNoLectivo[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('calendario_no_lectivo')
        .select('id, fecha, nombre, tipo, activo, origen, fecha_creacion')
        .gte('fecha', `${year}-01-01`)
        .lte('fecha', `${year}-12-31`)
        .order('fecha', { ascending: true });

      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return { items: [], error: null };
        }
        return { items: [], error: error.message };
      }
      return { items: (data as CalendarioNoLectivoDB[]).map(mapRow), error: null };
    } catch (e) {
      return { items: [], error: e instanceof Error ? e.message : 'Error al listar feriados' };
    }
  },

  async listActiveInRange(
    start: string,
    end: string
  ): Promise<{ items: CalendarioNoLectivo[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('calendario_no_lectivo')
        .select('id, fecha, nombre, tipo, activo, origen, fecha_creacion')
        .eq('activo', true)
        .gte('fecha', start)
        .lte('fecha', end)
        .order('fecha', { ascending: true });

      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) {
          return { items: [], error: null };
        }
        return { items: [], error: error.message };
      }
      return { items: (data as CalendarioNoLectivoDB[]).map(mapRow), error: null };
    } catch (e) {
      return { items: [], error: e instanceof Error ? e.message : 'Error al listar feriados' };
    }
  },

  async create(input: {
    fecha: string;
    nombre: string;
    tipo: CalendarioNoLectivoTipo;
  }): Promise<{ item: CalendarioNoLectivo | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('calendario_no_lectivo')
        .insert({
          fecha: input.fecha,
          nombre: input.nombre.trim(),
          tipo: input.tipo,
          activo: true,
          origen: 'manual',
        })
        .select('id, fecha, nombre, tipo, activo, origen, fecha_creacion')
        .single();

      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          return { item: null, error: 'Ya existe un día sin clases en esa fecha' };
        }
        return { item: null, error: error.message };
      }
      return { item: mapRow(data as CalendarioNoLectivoDB), error: null };
    } catch (e) {
      return { item: null, error: e instanceof Error ? e.message : 'Error al crear' };
    }
  },

  async setActivo(
    id: number,
    activo: boolean
  ): Promise<{ item: CalendarioNoLectivo | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('calendario_no_lectivo')
        .update({ activo })
        .eq('id', id)
        .select('id, fecha, nombre, tipo, activo, origen, fecha_creacion')
        .single();
      if (error) return { item: null, error: error.message };
      return { item: mapRow(data as CalendarioNoLectivoDB), error: null };
    } catch (e) {
      return { item: null, error: e instanceof Error ? e.message : 'Error al actualizar' };
    }
  },

  async remove(id: number): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.from('calendario_no_lectivo').delete().eq('id', id);
      return { error: error?.message ?? null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Error al eliminar' };
    }
  },

  async seedNacionales2026(): Promise<{ inserted: number; error: string | null }> {
    try {
      const rows = FERIADOS_NACIONALES_PE_2026.map((f) => ({
        fecha: f.fecha,
        nombre: f.nombre,
        tipo: 'nacional' as const,
        activo: true,
        origen: 'seed' as const,
      }));
      const { data, error } = await supabase
        .from('calendario_no_lectivo')
        .upsert(rows, { onConflict: 'fecha', ignoreDuplicates: true })
        .select('id');
      if (error) return { inserted: 0, error: error.message };
      return { inserted: data?.length ?? 0, error: null };
    } catch (e) {
      return { inserted: 0, error: e instanceof Error ? e.message : 'Error al cargar feriados' };
    }
  },
};
