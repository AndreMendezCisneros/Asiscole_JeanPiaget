import { supabase } from '@/lib/supabaseClient';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';
import {
  DEBT_TARDE_THRESHOLD,
  isEventAfterBaseline,
} from '@/lib/utils/debtAlarm';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';
import { fetchAllPages } from '@/lib/utils/supabasePagination';
import type { EducationalLevel } from '@/types';
import type {
  CompromisoAlarma,
  CompromisoAlarmaTipo,
  CompromisoBaselines,
  CompromisoTardanzaListRow,
} from '@/types/compromisoAlarma';

type CompromisoRow = {
  id: number;
  id_estudiante: number;
  tipo: CompromisoAlarmaTipo;
  nombre_apoderado: string;
  documento_url: string | null;
  firmado_en: string;
  registrado_por: number | null;
  observaciones: string | null;
  activo: boolean;
  fecha_creacion: string;
};

function mapRow(row: CompromisoRow): CompromisoAlarma {
  return {
    id: row.id,
    studentId: row.id_estudiante,
    tipo: row.tipo,
    parentName: row.nombre_apoderado,
    documentUrl: row.documento_url,
    signedAt: row.firmado_en,
    registeredBy: row.registrado_por,
    observations: row.observaciones,
    active: row.activo,
    createdAt: row.fecha_creacion,
  };
}

export const compromisosAlarmService = {
  async getBaselines(studentId: number): Promise<{
    baselines: CompromisoBaselines;
    error: string | null;
  }> {
    try {
      await ensureSupabaseReady();
      const { data, error } = await supabase
        .from('compromisos_alarma')
        .select(
          'id, id_estudiante, tipo, nombre_apoderado, documento_url, firmado_en, registrado_por, observaciones, activo, fecha_creacion',
        )
        .eq('id_estudiante', studentId)
        .eq('activo', true)
        .order('firmado_en', { ascending: false });

      if (error) {
        if (/compromisos_alarma|does not exist|42P01/i.test(error.message)) {
          return {
            baselines: { tardanza: null, falta: null, pago: null },
            error: null,
          };
        }
        return {
          baselines: { tardanza: null, falta: null, pago: null },
          error: error.message,
        };
      }

      const baselines: CompromisoBaselines = {
        tardanza: null,
        falta: null,
        pago: null,
      };
      for (const raw of data ?? []) {
        const row = raw as CompromisoRow;
        if (!baselines[row.tipo]) {
          baselines[row.tipo] = row.firmado_en;
        }
      }
      return { baselines, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al leer compromisos';
      return { baselines: { tardanza: null, falta: null, pago: null }, error: message };
    }
  },

  /**
   * Alumnos con al menos 1 tardanza (Tarde / TJ) desde el último compromiso.
   */
  async listStudentsWithTardanzas(filters?: {
    level?: EducationalLevel;
    grade?: string;
    section?: string;
    date?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    rows: CompromisoTardanzaListRow[];
    total: number;
    citationCount: number;
    error: string | null;
  }> {
    try {
      await ensureSupabaseReady();
      const page = Math.max(1, filters?.page ?? 1);
      const pageSize = Math.max(5, Math.min(50, filters?.pageSize ?? 10));

      type EstJoin = {
        id_estudiante: number;
        codigo_barras: string | null;
        nombre_completo: string | null;
        grado: string | null;
        seccion: string | null;
        nivel_educativo: string | null;
        activo: boolean | null;
        nombre_responsable: string | null;
      };

      type ArrivalJoin = {
        id_estudiante: number;
        fecha: string;
        estudiantes?: EstJoin | EstJoin[] | null;
      };

      const { data: arrivals, error: arrErr } = await fetchAllPages<ArrivalJoin>((from, to) => {
        let arrivalQ = supabase
          .from('registros_llegada')
          .select(
            `
          id_registro,
          id_estudiante,
          fecha,
          estado,
          estudiantes:id_estudiante (
            id_estudiante,
            codigo_barras,
            nombre_completo,
            grado,
            seccion,
            nivel_educativo,
            activo,
            nombre_responsable
          )
        `,
          )
          .in('estado', ['Tarde', 'Tarde justificada'])
          .order('fecha', { ascending: false })
          .range(from, to);

        if (filters?.date) arrivalQ = arrivalQ.eq('fecha', filters.date);
        return arrivalQ;
      });

      if (arrErr) {
        return { rows: [], total: 0, citationCount: 0, error: arrErr };
      }

      const byStudent = new Map<number, { est: EstJoin; dates: string[] }>();
      const gradeValues = filters?.grade ? gradeFilterValues(filters.grade) : null;

      for (const raw of arrivals ?? []) {
        const row = raw as ArrivalJoin;
        const estRaw = row.estudiantes;
        const est = Array.isArray(estRaw) ? estRaw[0] : estRaw;
        if (!est || est.activo === false) continue;
        if (filters?.level && String(est.nivel_educativo) !== filters.level) continue;
        if (gradeValues && !gradeValues.includes(String(est.grado ?? ''))) continue;
        if (filters?.section && String(est.seccion) !== filters.section) continue;

        const sid = Number(row.id_estudiante);
        const fecha = String(row.fecha ?? '').slice(0, 10);
        if (!fecha) continue;
        const cur = byStudent.get(sid);
        if (cur) cur.dates.push(fecha);
        else byStudent.set(sid, { est, dates: [fecha] });
      }

      const ids = [...byStudent.keys()];
      const baselineByStudent = new Map<number, string | null>();
      if (ids.length > 0) {
        const { data: comps } = await supabase
          .from('compromisos_alarma')
          .select('id_estudiante, firmado_en')
          .eq('tipo', 'tardanza')
          .eq('activo', true)
          .in('id_estudiante', ids)
          .order('firmado_en', { ascending: false });

        for (const c of comps ?? []) {
          const sid = Number((c as { id_estudiante: number }).id_estudiante);
          if (baselineByStudent.has(sid)) continue;
          baselineByStudent.set(
            sid,
            String((c as { firmado_en: string }).firmado_en ?? '') || null,
          );
        }
      }

      const search = (filters?.search ?? '').trim().toLowerCase();
      const allRows: CompromisoTardanzaListRow[] = [];
      for (const [sid, pack] of byStudent) {
        const baseline = baselineByStudent.get(sid) ?? null;
        const counted = pack.dates.filter((d) => isEventAfterBaseline(d, baseline));
        if (counted.length === 0) continue;

        const name = String(pack.est.nombre_completo ?? '');
        const barcode = String(pack.est.codigo_barras ?? '');
        if (
          search &&
          !name.toLowerCase().includes(search) &&
          !barcode.toLowerCase().includes(search)
        ) {
          continue;
        }

        const sortedDates = [...counted].sort();
        allRows.push({
          studentId: sid,
          fullName: name,
          grade: String(pack.est.grado ?? ''),
          section: String(pack.est.seccion ?? ''),
          level: String(pack.est.nivel_educativo ?? ''),
          barcode,
          responsibleName: pack.est.nombre_responsable ?? null,
          tardeCount: counted.length,
          lastTardeDate: sortedDates[sortedDates.length - 1] ?? null,
          needsCitation: counted.length >= DEBT_TARDE_THRESHOLD,
        });
      }

      allRows.sort((a, b) => {
        if (b.needsCitation !== a.needsCitation) {
          return Number(b.needsCitation) - Number(a.needsCitation);
        }
        if (b.tardeCount !== a.tardeCount) return b.tardeCount - a.tardeCount;
        return a.fullName.localeCompare(b.fullName, 'es');
      });

      const citationCount = allRows.filter((r) => r.needsCitation).length;
      const total = allRows.length;
      const start = (page - 1) * pageSize;
      return {
        rows: allRows.slice(start, start + pageSize),
        total,
        citationCount,
        error: null,
      };
    } catch (e: unknown) {
      return {
        rows: [],
        total: 0,
        citationCount: 0,
        error: e instanceof Error ? e.message : 'Error al listar tardanzas',
      };
    }
  },

  async syncPagoBaselinesForPension(
    studentId: number,
    isMoroso: boolean,
  ): Promise<void> {
    if (isMoroso) return;
    try {
      await ensureSupabaseReady();
      await supabase
        .from('compromisos_alarma')
        .update({ activo: false })
        .eq('id_estudiante', studentId)
        .eq('tipo', 'pago')
        .eq('activo', true);
    } catch {
      /* silencioso */
    }
  },

  async listForStudent(
    studentId: number,
  ): Promise<{ items: CompromisoAlarma[]; error: string | null }> {
    try {
      await ensureSupabaseReady();
      const { data, error } = await supabase
        .from('compromisos_alarma')
        .select(
          'id, id_estudiante, tipo, nombre_apoderado, documento_url, firmado_en, registrado_por, observaciones, activo, fecha_creacion',
        )
        .eq('id_estudiante', studentId)
        .order('firmado_en', { ascending: false })
        .limit(50);
      if (error) return { items: [], error: error.message };
      return { items: (data as CompromisoRow[]).map(mapRow), error: null };
    } catch (e: unknown) {
      return {
        items: [],
        error: e instanceof Error ? e.message : 'Error al listar compromisos',
      };
    }
  },

  async registerSigned(input: {
    studentId: number;
    tipo: CompromisoAlarmaTipo;
    parentName: string;
    registeredBy?: number | null;
    observations?: string | null;
    documentUrl?: string | null;
    signedAt?: string | null;
  }): Promise<{ item: CompromisoAlarma | null; error: string | null }> {
    try {
      await ensureSupabaseReady();
      const parentName = input.parentName.trim();
      if (parentName.length < 3) {
        return { item: null, error: 'Indique el nombre del apoderado (mín. 3 caracteres).' };
      }

      await supabase
        .from('compromisos_alarma')
        .update({ activo: false })
        .eq('id_estudiante', input.studentId)
        .eq('tipo', input.tipo)
        .eq('activo', true);

      const { data, error } = await supabase
        .from('compromisos_alarma')
        .insert({
          id_estudiante: input.studentId,
          tipo: input.tipo,
          nombre_apoderado: parentName,
          documento_url: input.documentUrl ?? null,
          firmado_en: input.signedAt || new Date().toISOString(),
          registrado_por: input.registeredBy ?? null,
          observaciones: input.observations?.trim() || null,
          activo: true,
        })
        .select(
          'id, id_estudiante, tipo, nombre_apoderado, documento_url, firmado_en, registrado_por, observaciones, activo, fecha_creacion',
        )
        .single();

      if (error) return { item: null, error: error.message };
      return { item: mapRow(data as CompromisoRow), error: null };
    } catch (e: unknown) {
      return {
        item: null,
        error: e instanceof Error ? e.message : 'Error al registrar el compromiso',
      };
    }
  },
};
