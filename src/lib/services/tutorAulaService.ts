import { supabase } from '../supabaseClient';
import { sessionService } from './sessionService';
import { prefetchEvidencePhotoUrls, resolveEvidencePhotoUrl } from '@/lib/utils/evidencePhoto';
import type {
  TutorAttendanceArrival,
  TutorAttendanceStudent,
  TutorDayStudent,
  TutorEvidence,
  TutorIncident,
  TutorSalon,
} from '@/types/tutorAula';

const SESSION_EXPIRED = 'Sesión expirada. Vuelva a iniciar sesión.';

type RpcPayload = Record<string, unknown> & { error?: string | null };

/** Llama una RPC del tutor con el token de sesión; devuelve el payload o el error. */
async function callTutorRpc(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<{ payload: RpcPayload | null; error: string | null }> {
  const token = sessionService.getApiToken();
  if (!token) return { payload: null, error: SESSION_EXPIRED };
  try {
    const { data, error } = await supabase.rpc(fn, { p_token: token, ...args });
    if (error) return { payload: null, error: error.message };
    const payload = (data ?? {}) as RpcPayload;
    if (payload.error) return { payload: null, error: payload.error };
    return { payload, error: null };
  } catch (err: unknown) {
    return { payload: null, error: err instanceof Error ? err.message : 'Error de conexión' };
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Docente tutor: solo lectura de su salón (todo filtrado en el servidor). */
export const tutorAulaService = {
  async getMySalon(): Promise<{ salon: TutorSalon | null; students: number; error: string | null }> {
    const { payload, error } = await callTutorRpc('sie_tutor_mi_salon');
    if (error || !payload) return { salon: null, students: 0, error };
    return {
      salon: (payload.salon as TutorSalon) ?? null,
      students: Number(payload.students ?? 0),
      error: null,
    };
  },

  async getDay(date: string): Promise<{ students: TutorDayStudent[]; error: string | null }> {
    const { payload, error } = await callTutorRpc('sie_tutor_llegadas', { p_fecha: date });
    if (error || !payload) return { students: [], error };
    return { students: asArray<TutorDayStudent>(payload.students), error: null };
  },

  async getIncidents(filters: {
    from: string;
    to: string;
    page: number;
    pageSize: number;
  }): Promise<{ incidents: TutorIncident[]; total: number; error: string | null }> {
    const { payload, error } = await callTutorRpc('sie_tutor_incidencias', {
      p_desde: filters.from,
      p_hasta: filters.to,
      p_limit: filters.pageSize,
      p_offset: (filters.page - 1) * filters.pageSize,
    });
    if (error || !payload) return { incidents: [], total: 0, error };
    return {
      incidents: asArray<TutorIncident>(payload.incidents),
      total: Number(payload.total ?? 0),
      error: null,
    };
  },

  async getEvidences(incidentId: number): Promise<{ evidences: TutorEvidence[]; error: string | null }> {
    const { payload, error } = await callTutorRpc('sie_tutor_evidencias', { p_id_incidencia: incidentId });
    if (error || !payload) return { evidences: [], error };
    const rows = asArray<{ id: number; filename: string | null; path: string; uploadedAt: string | null }>(
      payload.evidences,
    );
    await prefetchEvidencePhotoUrls(rows.map((r) => r.path));
    const evidences = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        filename: r.filename,
        url: await resolveEvidencePhotoUrl(r.path),
        uploadedAt: r.uploadedAt,
      })),
    );
    return { evidences, error: null };
  },

  async getAttendance(from: string, to: string): Promise<{
    students: TutorAttendanceStudent[];
    arrivals: TutorAttendanceArrival[];
    error: string | null;
  }> {
    const { payload, error } = await callTutorRpc('sie_tutor_asistencia', { p_desde: from, p_hasta: to });
    if (error || !payload) return { students: [], arrivals: [], error };
    return {
      students: asArray<TutorAttendanceStudent>(payload.students),
      arrivals: asArray<TutorAttendanceArrival>(payload.arrivals),
      error: null,
    };
  },
};
