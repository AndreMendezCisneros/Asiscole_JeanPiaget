import { supabase } from '../supabaseClient';
import { Student, EducationalLevel, DocenteClassroom } from '@/types';
import { resolveStudentProfilePhotoUrl } from '@/lib/utils/profilePhoto';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';
import {
  TUTOR_NAME_SEARCH_LIMIT,
  foldSearchText,
  isDniLikeQuery,
  normalizeSearchQuery,
  orderSearchTokensBySelectivity,
  sortStudentsForSearch,
  studentMatchesSearchTokens,
  tokenizeSearchQuery,
} from '@/lib/utils/studentSearch';
import { sessionService } from './sessionService';

function requireApiToken(): string | null {
  return sessionService.getApiToken();
}

function mapProfilePhoto(raw: string | null | undefined): string | null | undefined {
  const resolved = resolveStudentProfilePhotoUrl(raw);
  return resolved ?? raw ?? null;
}

function mapRpcStudent(raw: Record<string, unknown>): Student {
  return {
    id: Number(raw.id),
    fullName: String(raw.fullName ?? ''),
    grade: String(raw.grade ?? ''),
    section: String(raw.section ?? ''),
    level: raw.level as EducationalLevel,
    barcode: String(raw.barcode ?? ''),
    profilePhoto: mapProfilePhoto(raw.profilePhoto as string | null | undefined),
    reincidenceLevel: (Number(raw.reincidenceLevel) || 0) as Student['reincidenceLevel'],
    faultsLast60Days: Number(raw.faultsLast60Days) || 0,
    active: raw.active !== false,
    contactPhone: (raw.contactPhone as string | null) ?? null,
    contactEmail: (raw.contactEmail as string | null) ?? null,
    responsibleName: (raw.responsibleName as string | null) ?? null,
    responsibleRelationship: (raw.responsibleRelationship as string | null) ?? null,
    emergencyPhone: (raw.emergencyPhone as string | null) ?? null,
    estadoPension: (raw.estadoPension as Student['estadoPension']) ?? 'sin_dato',
  };
}

function mapRpcStudents(rows: unknown): Student[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => mapRpcStudent(row as Record<string, unknown>));
}

/** Variantes de DNI/código para tolerar ceros a la izquierda y espacios. */
export function buildStudentLookupVariants(code: string): string[] {
  const trimmed = code.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed, trimmed.replace(/\s+/g, '')]);
  const digits = trimmed.replace(/\D/g, '');

  if (digits) {
    variants.add(digits);
    const withoutLeadingZeros = digits.replace(/^0+/, '') || digits;
    variants.add(withoutLeadingZeros);
    if (digits.length <= 8) variants.add(digits.padStart(8, '0'));
    if (withoutLeadingZeros.length <= 8) {
      variants.add(withoutLeadingZeros.padStart(8, '0'));
    }
  }

  return [...variants];
}

export interface StudentsListStats {
  sinIncidencias: number;
  nivelModerado: number;
  nivelAlto: number;
}

function mapRpcStudentsStats(raw: unknown): StudentsListStats {
  const stats = raw as Record<string, unknown> | null | undefined;
  return {
    sinIncidencias: Number(stats?.sinIncidencias) || 0,
    nivelModerado: Number(stats?.nivelModerado) || 0,
    nivelAlto: Number(stats?.nivelAlto) || 0,
  };
}

/**
 * Servicio de estudiantes (acceso solo vía RPC con token de sesión)
 */
export const studentsService = {
  /** Caché local en memoria del escáner; ya no precarga toda la nómina. */
  async prefetchBarcodeIndex(): Promise<Map<string, Student>> {
    return new Map();
  },

  lookupBarcodeInIndex(index: Map<string, Student>, barcode: string): Student | null {
    for (const variant of buildStudentLookupVariants(barcode)) {
      const hit = index.get(variant);
      if (hit) return hit;
    }
    return null;
  },

  invalidateScannerBarcodeIndex(): void {
    /* sin índice global */
  },

  /**
   * Busca estudiante por carnet/DNI probando variantes (espacios, ceros a la izquierda).
   */
  async lookupByBarcodeOrDni(
    code: string,
    options?: { skipReincidence?: boolean },
  ): Promise<{ student: Student | null; error: string | null }> {
    const variants = buildStudentLookupVariants(code);
    if (variants.length === 0) {
      return { student: null, error: 'Ingrese un DNI o código de barras' };
    }

    let lastError = 'Estudiante no encontrado con ese DNI o código';
    for (const variant of variants) {
      const { student, error } = await this.getByBarcode(variant, options);
      if (student) return { student, error: null };
      if (error) lastError = error;
    }

    return { student: null, error: lastError };
  },

  async getByBarcode(
    barcode: string,
    options?: { skipReincidence?: boolean }
  ): Promise<{ student: Student | null; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { student: null, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_buscar_estudiante_carnet', {
        p_token: token,
        p_codigo: barcode.trim(),
        p_skip_reincidencia: options?.skipReincidence ?? false,
      });

      if (error) {
        return { student: null, error: error.message };
      }

      const payload = data as { student?: Record<string, unknown> | null; error?: string | null };
      if (payload?.error) {
        return { student: null, error: payload.error };
      }
      if (!payload?.student) {
        return { student: null, error: 'Estudiante no encontrado' };
      }

      return { student: mapRpcStudent(payload.student), error: null };
    } catch (error: unknown) {
      console.error('Error en getByBarcode:', error);
      const message = error instanceof Error ? error.message : 'Error al buscar estudiante';
      return { student: null, error: message };
    }
  },

  async searchByName(query: string, limit: number = 10): Promise<{ students: Student[]; error: string | null }> {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      return { students: [], error: null };
    }

    const token = requireApiToken();
    if (!token) {
      return { students: [], error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_buscar_estudiantes_nombre', {
        p_token: token,
        p_query: trimmed,
        p_limit: limit,
      });

      if (error) {
        return { students: [], error: error.message };
      }

      const payload = data as { students?: unknown; error?: string | null };
      if (payload?.error) {
        return { students: [], error: payload.error };
      }

      return { students: mapRpcStudents(payload?.students), error: null };
    } catch (error: unknown) {
      console.error('Error en searchByName:', error);
      const message = error instanceof Error ? error.message : 'Error al buscar estudiantes';
      return { students: [], error: message };
    }
  },

  /**
   * Búsqueda del escáner tutor: nombre + DNI/carnet en una sola consulta.
   * Prioriza la frase completa; si hay varios apellidos, busca por el más selectivo.
   */
  async searchForTutorScanner(
    query: string,
    limit: number = TUTOR_NAME_SEARCH_LIMIT,
  ): Promise<{ students: Student[]; error: string | null }> {
    const trimmed = normalizeSearchQuery(query);
    if (trimmed.length < 2) {
      return { students: [], error: null };
    }

    const tokens = tokenizeSearchQuery(trimmed);
    const matchTokens = tokens.length > 0 ? tokens : [trimmed];
    const isDniLike = isDniLikeQuery(trimmed);

    let nameError: string | null = null;
    const merged = new Map<number, Student>();

    const absorb = (result: { students: Student[]; error: string | null }) => {
      if (result.error) nameError = result.error;
      for (const student of result.students) {
        merged.set(student.id, student);
      }
    };

    absorb(await this.searchByName(trimmed, limit));

    const foldedFull = foldSearchText(trimmed);
    if (foldedFull.length >= 2 && foldedFull !== trimmed.toLowerCase()) {
      absorb(await this.searchByName(foldedFull, limit));
    }

    if (tokens.length > 1) {
      const reversed = [...tokens].reverse().join(' ');
      if (reversed !== trimmed) {
        absorb(await this.searchByName(reversed, limit));
      }

      for (const token of orderSearchTokensBySelectivity(tokens)) {
        const tokenResult = await this.searchByName(token, limit);
        if (tokenResult.error) nameError = tokenResult.error;
        for (const student of tokenResult.students) {
          if (studentMatchesSearchTokens(student, matchTokens)) {
            merged.set(student.id, student);
          }
        }
        if (merged.size >= limit) break;
      }
    } else if (tokens.length === 1) {
      const folded = foldSearchText(tokens[0]);
      if (folded.length >= 2 && folded !== tokens[0].toLowerCase()) {
        absorb(await this.searchByName(folded, limit));
      }
    }

    const dniResult = isDniLike
      ? await this.lookupByBarcodeOrDni(trimmed, { skipReincidence: true })
      : { student: null as Student | null, error: null as string | null };

    if (dniResult.student) {
      merged.set(dniResult.student.id, dniResult.student);
    }

    const dniStudentId = dniResult.student?.id;
    const students = sortStudentsForSearch(
      [...merged.values()].filter(
        (student) =>
          student.id === dniStudentId || studentMatchesSearchTokens(student, matchTokens),
      ),
      matchTokens,
    ).slice(0, limit);

    return { students, error: nameError ?? dniResult.error };
  },

  /** Búsqueda del escáner docente: limitada por salones vía RPC. */
  async searchForDocenteScanner(
    query: string,
    limit: number = 12,
  ): Promise<{ students: Student[]; error: string | null }> {
    const trimmed = query.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) {
      return { students: [], error: null };
    }
    return this.searchByName(trimmed, limit);
  },

  /** Lista estudiantes activos de un salón asignado al docente (vía RPC). */
  async listForDocenteClassroom(
    classroom: DocenteClassroom,
  ): Promise<{ students: Student[]; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { students: [], error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_docente_listar_estudiantes_salon', {
        p_token: token,
        p_level: classroom.level,
        p_grade: classroom.grade,
        p_section: classroom.section,
      });

      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('sie_docente_listar_estudiantes_salon') || error.code === 'PGRST202') {
          return {
            students: [],
            error:
              'Función de listado no instalada en Supabase. Ejecute scripts/PATCH_DOCENTE_LISTAR_SALON.sql en el SQL Editor.',
          };
        }
        return { students: [], error: error.message };
      }

      const payload = data as { students?: unknown; error?: string | null };
      if (payload?.error) {
        return { students: [], error: payload.error };
      }

      return { students: mapRpcStudents(payload?.students), error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar estudiantes';
      return { students: [], error: message };
    }
  },

  async getAll(filters?: {
    grade?: string;
    section?: string;
    level?: EducationalLevel;
    active?: boolean;
    search?: string;
    /** Página 1-based (solo listados paginados) */
    page?: number;
    /** Tamaño de página; por defecto 10 */
    pageSize?: number;
    /** Reportes / exportación: traer todos los que coincidan con filtros */
    fetchAll?: boolean;
  }): Promise<{
    students: Student[];
    total: number;
    stats: StudentsListStats;
    error: string | null;
  }> {
    const token = requireApiToken();
    if (!token) {
      return {
        students: [],
        total: 0,
        stats: { sinIncidencias: 0, nivelModerado: 0, nivelAlto: 0 },
        error: 'Sesión expirada. Vuelva a iniciar sesión.',
      };
    }

    const pageSize = filters?.pageSize ?? 10;
    const page = Math.max(1, filters?.page ?? 1);
    const offset = (page - 1) * pageSize;

    try {
      const fetchAll = filters?.fetchAll ?? false;
      const { data, error } = await supabase.rpc('sie_lista_estudiantes', {
        p_token: token,
        p_filtros: {
          grade: filters?.grade ?? null,
          section: filters?.section ?? null,
          level: filters?.level ?? null,
          active: filters?.active ?? null,
          search: filters?.search ?? null,
          fetchAll,
          ...(fetchAll ? {} : { limit: pageSize, offset }),
        },
      });

      if (error) {
        return {
          students: [],
          total: 0,
          stats: { sinIncidencias: 0, nivelModerado: 0, nivelAlto: 0 },
          error: error.message,
        };
      }

      const payload = data as {
        students?: unknown;
        total?: number;
        stats?: unknown;
        error?: string | null;
      };
      if (payload?.error) {
        return {
          students: [],
          total: 0,
          stats: { sinIncidencias: 0, nivelModerado: 0, nivelAlto: 0 },
          error: payload.error,
        };
      }

      return {
        students: mapRpcStudents(payload?.students),
        total: Number(payload?.total) || 0,
        stats: mapRpcStudentsStats(payload?.stats),
        error: null,
      };
    } catch (error: unknown) {
      console.error('Error en getAll:', error);
      const message = error instanceof Error ? error.message : 'Error al obtener estudiantes';
      return {
        students: [],
        total: 0,
        stats: { sinIncidencias: 0, nivelModerado: 0, nivelAlto: 0 },
        error: message,
      };
    }
  },

  /**
   * Consulta directa a `estudiantes` sin JOIN a la vista pesada de reincidencia.
   * Úsala en reportes que NO muestran nivel/faltas de reincidencia (asistencia,
   * meetings, control de llegada/salida, etc.). Mucho más rápida que la RPC
   * `sie_lista_estudiantes` con `fetchAll: true`.
   *
   * Modos:
   *  - Sin `page`/`pageSize`: pagina internamente en bloques de 1000 y trae todo.
   *  - Con `page`/`pageSize`: trae solo esa página + devuelve `total` con COUNT exact.
   *  - Con `withReincidence: true`: enriquece cada estudiante con `reincidenceLevel`
   *    y `faultsLast60Days` consultando `v_estudiantes_nivel_actual` en una sola
   *    query adicional (`.in('id_estudiante', ids)`), lo cual es super rápido
   *    porque el filtro es una lista corta.
   */
  async listLite(filters?: {
    active?: boolean;
    level?: EducationalLevel;
    grade?: string;
    section?: string;
    search?: string;
    limit?: number;
    /** Página 1-based; si se define, activa modo paginado */
    page?: number;
    /** Tamaño de página en modo paginado (default 1000 en fetchAll, 10 paginado) */
    pageSize?: number;
    /** Añade reincidencia consultando la vista solo para los IDs de la página */
    withReincidence?: boolean;
  }): Promise<{ students: Student[]; total: number; error: string | null }> {
    try {
      const isPaginated = filters?.page !== undefined;
      const pageSize = filters?.pageSize ?? filters?.limit ?? (isPaginated ? 10 : 1000);
      const page = Math.max(1, filters?.page ?? 1);

      const buildBaseQuery = (from: number, to: number, withCount: boolean) => {
        let q = supabase
          .from('estudiantes')
          .select(
            'id_estudiante, codigo_barras, nombre_completo, grado, seccion, nivel_educativo, foto_perfil, activo, telefono_contacto, email_contacto, nombre_responsable, parentesco_responsable, telefono_emergencia',
            withCount ? { count: 'exact' } : undefined,
          )
          .order('nombre_completo', { ascending: true })
          .range(from, to);

        if (filters?.active !== undefined) q = q.eq('activo', filters.active);
        if (filters?.level) q = q.eq('nivel_educativo', filters.level);
        if (filters?.grade) q = q.in('grado', gradeFilterValues(filters.grade));
        if (filters?.section) q = q.eq('seccion', filters.section);
        if (filters?.search && filters.search.trim()) {
          const term = filters.search.trim().replace(/[%_]/g, (m) => `\\${m}`);
          q = q.or(`nombre_completo.ilike.%${term}%,codigo_barras.ilike.%${term}%`);
        }
        return q;
      };

      const mapRow = (row: Record<string, unknown>): Student => ({
        id: Number(row.id_estudiante),
        fullName: String(row.nombre_completo ?? ''),
        grade: String(row.grado ?? ''),
        section: String(row.seccion ?? ''),
        level: (row.nivel_educativo as EducationalLevel) ?? 'Secundaria',
        barcode: String(row.codigo_barras ?? ''),
        profilePhoto: mapProfilePhoto(row.foto_perfil as string | null | undefined),
        reincidenceLevel: 0,
        faultsLast60Days: 0,
        active: row.activo !== false,
        contactPhone: (row.telefono_contacto as string | null) ?? null,
        contactEmail: (row.email_contacto as string | null) ?? null,
        responsibleName: (row.nombre_responsable as string | null) ?? null,
        responsibleRelationship: (row.parentesco_responsable as string | null) ?? null,
        emergencyPhone: (row.telefono_emergencia as string | null) ?? null,
        estadoPension: 'sin_dato',
      });

      const enrichWithReincidence = async (students: Student[]): Promise<Student[]> => {
        if (!filters?.withReincidence || students.length === 0) return students;
        const ids = students.map((s) => s.id);
        const { data: rein, error: reinError } = await supabase
          .from('v_estudiantes_nivel_actual')
          .select('id_estudiante, nivel_actual, total_faltas_60_dias')
          .in('id_estudiante', ids);
        if (reinError) return students; // no bloquear la lista si la vista falla
        const byId = new Map<number, { nivel: number; faltas: number }>();
        for (const r of rein ?? []) {
          byId.set(Number((r as Record<string, unknown>).id_estudiante), {
            nivel: Number((r as Record<string, unknown>).nivel_actual) || 0,
            faltas: Number((r as Record<string, unknown>).total_faltas_60_dias) || 0,
          });
        }
        return students.map((s) => {
          const r = byId.get(s.id);
          if (!r) return s;
          return {
            ...s,
            reincidenceLevel: r.nivel as Student['reincidenceLevel'],
            faultsLast60Days: r.faltas,
          };
        });
      };

      if (isPaginated) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await buildBaseQuery(from, to, true);
        if (error) return { students: [], total: 0, error: error.message };
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const students = await enrichWithReincidence(rows.map(mapRow));
        return { students, total: count ?? students.length, error: null };
      }

      // Modo fetchAll: pagina interna de 1000 en 1000
      const all: Student[] = [];
      let from = 0;
      for (let guard = 0; guard < 20; guard += 1) {
        const { data, error } = await buildBaseQuery(from, from + pageSize - 1, false);
        if (error) return { students: [], total: 0, error: error.message };
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        all.push(...rows.map(mapRow));
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      const enriched = await enrichWithReincidence(all);
      return { students: enriched, total: enriched.length, error: null };
    } catch (error: unknown) {
      console.error('Error en listLite:', error);
      const message = error instanceof Error ? error.message : 'Error al listar estudiantes';
      return { students: [], total: 0, error: message };
    }
  },

  async getById(id: number): Promise<{ student: Student | null; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { student: null, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_estudiante_por_id', {
        p_token: token,
        p_id: id,
      });

      if (error) {
        return { student: null, error: error.message };
      }

      const payload = data as { student?: Record<string, unknown> | null; error?: string | null };
      if (payload?.error) {
        return { student: null, error: payload.error };
      }
      if (!payload?.student) {
        return { student: null, error: 'Estudiante no encontrado' };
      }

      return { student: mapRpcStudent(payload.student), error: null };
    } catch (error: unknown) {
      console.error('Error en getById:', error);
      const message = error instanceof Error ? error.message : 'Error al obtener estudiante';
      return { student: null, error: message };
    }
  },

  async getLinkedForParent(): Promise<{ students: Student[]; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { students: [], error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_padre_mis_estudiantes', { p_token: token });
      if (error) {
        return { students: [], error: error.message };
      }

      const payload = data as { students?: unknown; error?: string | null };
      if (payload?.error) {
        return { students: [], error: payload.error };
      }

      return { students: mapRpcStudents(payload?.students), error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar estudiantes';
      return { students: [], error: message };
    }
  },

  async create(student: {
    codigo_barras: string;
    nombre_completo: string;
    grado: string;
    seccion: string;
    nivel_educativo: EducationalLevel;
    foto_perfil?: string;
    telefono_contacto?: string;
    email_contacto?: string;
    nombre_responsable?: string;
    parentesco_responsable?: string;
    telefono_emergencia?: string;
  }): Promise<{ student: Student | null; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { student: null, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_crear_estudiante', {
        p_token: token,
        p_payload: student,
      });

      if (error) {
        return { student: null, error: error.message };
      }

      const payload = data as { student?: Record<string, unknown>; error?: string | null };
      if (payload?.error || !payload?.student) {
        return { student: null, error: payload?.error || 'Error al crear estudiante' };
      }

      return { student: mapRpcStudent(payload.student), error: null };
    } catch (error: unknown) {
      console.error('Error en create:', error);
      const message = error instanceof Error ? error.message : 'Error al crear estudiante';
      return { student: null, error: message };
    }
  },

  async uploadProfilePhoto(file: File): Promise<{ url: string | null; error: string | null }> {
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const normalizedMime =
        file.type === 'image/jpg' || (ext === 'jpg' && !file.type) ? 'image/jpeg' : file.type;

      if (!normalizedMime.match(/^image\/(jpeg|png|webp)$/)) {
        return { url: null, error: 'Solo se permiten archivos JPG, PNG o WebP' };
      }

      if (file.size > 5242880) {
        return { url: null, error: 'El archivo no puede superar los 5MB' };
      }

      const fileName = `${Date.now()}.${ext || 'jpg'}`;
      const filePath = `profile/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('fotos-perfil').upload(filePath, file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: normalizedMime,
      });

      if (uploadError) {
        console.error('Error al subir foto de perfil:', uploadError);
        return { url: null, error: uploadError.message };
      }

      const { data: urlData } = supabase.storage.from('fotos-perfil').getPublicUrl(filePath);
      return { url: urlData.publicUrl, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al subir foto';
      console.error('Error en uploadProfilePhoto:', error);
      return { url: null, error: message };
    }
  },

  async update(
    id: number,
    updates: Partial<{
      nombre_completo: string;
      grado: string;
      seccion: string;
      nivel_educativo: EducationalLevel;
      foto_perfil: string;
      activo: boolean;
      telefono_contacto?: string;
      email_contacto?: string;
      nombre_responsable?: string;
      parentesco_responsable?: string;
      telefono_emergencia?: string;
    }>
  ): Promise<{ success: boolean; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { success: false, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_actualizar_estudiante', {
        p_token: token,
        p_id: id,
        p_payload: updates,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const payload = data as { ok?: boolean; error?: string | null };
      if (payload?.error) {
        return { success: false, error: payload.error };
      }

      return { success: payload?.ok !== false, error: null };
    } catch (error: unknown) {
      console.error('Error en update:', error);
      const message = error instanceof Error ? error.message : 'Error al actualizar estudiante';
      return { success: false, error: message };
    }
  },
};
