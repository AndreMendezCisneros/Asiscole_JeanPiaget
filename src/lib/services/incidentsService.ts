import { supabase } from '../supabaseClient';
import {
  Incident,
  EducationalLevel,
  EstadoIncidencia,
  EstadoEvidencia,
  FaultSeverity,
} from '@/types';
import type { RevisadoAppEstado } from '@/lib/utils/revisadoAppEstado';
import { fetchAllPages } from '@/lib/utils/supabasePagination';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';
import { isTalleresEnabled } from '@/config/features';
import { getLimaMonthBounds, getMonthBounds, toLimaDayBound } from '@/lib/utils/limaDateTime';
import {
  buildIncidentSelect,
  isMissingTallerSchemaError,
  isMissingRecomendacionError,
  setTallerSchemaAvailable,
  setRecomendacionAvailable,
  shouldIncludeTallerEmbed,
} from './incidentSelect';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';
import {
  isCarnetFaultName,
  isEventAfterBaseline,
  isFaltaInasistenciaName,
} from '@/lib/utils/debtAlarm';
import { compromisosAlarmService } from './compromisosAlarmService';

export interface IncidentsListFilters {
  estudianteId?: number;
  estado?: EstadoIncidencia;
  fechaDesde?: string;
  fechaHasta?: string;
  grado?: string;
  seccion?: string;
  nivelEducativo?: EducationalLevel;
  nivelReincidencia?: number;
  estadoEvidencia?: EstadoEvidencia;
  gravedad?: FaultSeverity;
  revisado?: RevisadoAppEstado;
  bimestre?: number;
  añoEscolar?: number;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  fetchAll?: boolean;
}

export interface IncidentsListSummary {
  total: number;
  activas: number;
  conEvidencia: number;
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&');
}

const SEARCH_MATCH_LIMIT = 200;
const STUDENT_SCOPE_LIMIT = 8000;

interface IncidentQueryScope {
  empty: boolean;
  incidentId?: number;
  studentIds?: number[];
  faultIds?: number[];
  gravityFaultIds?: number[];
}

/** Resuelve filtros de estudiante/búsqueda en tablas base (evita joins lentos en incidencias). */
async function resolveIncidentQueryScope(
  filters?: IncidentsListFilters,
): Promise<IncidentQueryScope> {
  const scope: IncidentQueryScope = { empty: false };
  const search = filters?.search?.trim();

  if (search) {
    const compact = search.replace(/\s/g, '');
    const idNum = Number.parseInt(search, 10);
    if (!Number.isNaN(idNum) && String(idNum) === compact) {
      scope.incidentId = idNum;
      return scope;
    }
  }

  let scopedStudentIds: number[] | null = null;

  if (filters?.nivelEducativo || filters?.grado || filters?.seccion) {
    let studentQuery = supabase
      .from('estudiantes')
      .select('id_estudiante')
      .limit(STUDENT_SCOPE_LIMIT);
    if (filters.nivelEducativo) {
      studentQuery = studentQuery.eq('nivel_educativo', filters.nivelEducativo);
    }
    if (filters.grado) {
      studentQuery = studentQuery.in('grado', gradeFilterValues(filters.grado));
    }
    if (filters.seccion) {
      studentQuery = studentQuery.eq('seccion', filters.seccion);
    }
    const { data, error } = await studentQuery;
    if (error) {
      throw new Error(error.message);
    }
    scopedStudentIds = (data ?? []).map((row) => row.id_estudiante);
    if (scopedStudentIds.length === 0) {
      scope.empty = true;
      return scope;
    }
  }

  if (search) {
    const escaped = escapeIlike(search);
    let studentSearch = supabase
      .from('estudiantes')
      .select('id_estudiante')
      .ilike('nombre_completo', `%${escaped}%`)
      .limit(SEARCH_MATCH_LIMIT);
    if (scopedStudentIds) {
      studentSearch = studentSearch.in('id_estudiante', scopedStudentIds);
    }

    const faultSearch = supabase
      .from('catalogo_faltas')
      .select('id_falta')
      .ilike('nombre_falta', `%${escaped}%`)
      .limit(SEARCH_MATCH_LIMIT);

    const [studentsRes, faultsRes] = await Promise.all([studentSearch, faultSearch]);
    if (studentsRes.error) {
      throw new Error(studentsRes.error.message);
    }
    if (faultsRes.error) {
      throw new Error(faultsRes.error.message);
    }

    scope.studentIds = (studentsRes.data ?? []).map((row) => row.id_estudiante);
    scope.faultIds = (faultsRes.data ?? []).map((row) => row.id_falta);

    if (scope.studentIds.length === 0 && scope.faultIds.length === 0) {
      scope.empty = true;
      return scope;
    }
    return attachGravityScope(scope, filters);
  }

  if (scopedStudentIds) {
    scope.studentIds = scopedStudentIds;
  }

  return attachGravityScope(scope, filters);
}

async function attachGravityScope(
  scope: IncidentQueryScope,
  filters?: IncidentsListFilters,
): Promise<IncidentQueryScope> {
  if (scope.empty || !filters?.gravedad) {
    return scope;
  }
  const { data, error } = await supabase
    .from('catalogo_faltas')
    .select('id_falta')
    .eq('es_grave', filters.gravedad === 'Grave')
    .limit(SEARCH_MATCH_LIMIT);
  if (error) {
    throw new Error(error.message);
  }
  const gravityIds = (data ?? []).map((row) => row.id_falta);
  if (gravityIds.length === 0) {
    scope.empty = true;
    return scope;
  }
  scope.gravityFaultIds = gravityIds;
  return scope;
}

async function resolveDateRange(filters?: IncidentsListFilters): Promise<{
  fechaDesde?: string;
  fechaHasta?: string;
}> {
  let fechaDesde = filters?.fechaDesde;
  let fechaHasta = filters?.fechaHasta;

  if (filters?.bimestre && filters?.añoEscolar) {
    const { getBimestreDates } = await import('@/lib/utils/bimestreUtils');
    const { inicio, fin } = getBimestreDates(filters.bimestre as 1 | 2 | 3 | 4, filters.añoEscolar);
    fechaDesde = inicio.toISOString();
    fechaHasta = fin.toISOString();
  }

  return {
    fechaDesde: toLimaDayBound(fechaDesde, false),
    fechaHasta: toLimaDayBound(fechaHasta, true),
  };
}

function applyIncidentFilters(
  query: any,
  filters: IncidentsListFilters | undefined,
  dateRange: { fechaDesde?: string; fechaHasta?: string },
  scope: IncidentQueryScope,
) {
  if (scope.empty) {
    return query.eq('id_incidencia', -1);
  }

  if (scope.incidentId != null) {
    return query.eq('id_incidencia', scope.incidentId);
  }

  if (filters?.estudianteId) {
    query = query.eq('id_estudiante', filters.estudianteId);
  }

  if (filters?.estado) {
    query = query.eq('estado', filters.estado);
  }

  if (dateRange.fechaDesde) {
    query = query.gte('fecha_hora_registro', dateRange.fechaDesde);
  }

  if (dateRange.fechaHasta) {
    query = query.lte('fecha_hora_registro', dateRange.fechaHasta);
  }

  if (filters?.nivelReincidencia !== undefined) {
    query = query.eq('nivel_reincidencia', filters.nivelReincidencia);
  }

  if (filters?.estadoEvidencia) {
    query = query.eq('estado_evidencia', filters.estadoEvidencia);
  }

  if (scope.gravityFaultIds?.length) {
    query = query.in('id_falta', scope.gravityFaultIds);
  }

  if (filters?.revisado === 'confirmado') {
    query = query.eq('confirmada_app', true);
  } else if (filters?.revisado === 'visto') {
    query = query.eq('revisado_app', true).eq('confirmada_app', false);
  } else if (filters?.revisado === 'no') {
    query = query.eq('revisado_app', false).eq('confirmada_app', false);
  }

  if (scope.studentIds?.length && scope.faultIds?.length) {
    query = query.or(
      `id_estudiante.in.(${scope.studentIds.join(',')}),id_falta.in.(${scope.faultIds.join(',')})`,
    );
  } else if (scope.studentIds?.length) {
    query = query.in('id_estudiante', scope.studentIds);
  } else if (scope.faultIds?.length) {
    query = query.in('id_falta', scope.faultIds);
  }

  return query;
}

/**
 * Servicio de incidencias
 */
export const incidentsService = {
  /**
   * Crear nueva incidencia
   * El nivel de reincidencia se calcula automáticamente por el trigger de la base de datos
   */
  async create(
    incident: {
      studentId: number;
      faultTypeId: number;
      registeredBy: number;
      observations?: string;
      tallerId?: string;
    },
    options?: { minimal?: boolean },
  ): Promise<{ incident: Incident | null; error: string | null }> {
    try {
      const includeTallerCol = shouldIncludeTallerEmbed(isTalleresEnabled());
      const insertQuery = supabase.from('incidencias').insert({
        id_estudiante: incident.studentId,
        id_falta: incident.faultTypeId,
        id_usuario_registro: incident.registeredBy,
        observaciones: incident.observations || null,
        ...(includeTallerCol && incident.tallerId
          ? { taller_id: incident.tallerId }
          : {}),
      });

      if (options?.minimal) {
        const includeTaller = shouldIncludeTallerEmbed(isTalleresEnabled());
        const minimalSelect = includeTaller
          ? 'id_incidencia, fecha_hora_registro, nivel_reincidencia, observaciones, estado, taller_id'
          : 'id_incidencia, fecha_hora_registro, nivel_reincidencia, observaciones, estado';
        let { data, error } = await insertQuery.select(minimalSelect).single();
        if (error && includeTaller && isMissingTallerSchemaError(error)) {
          setTallerSchemaAvailable(false);
          ({ data, error } = await insertQuery
            .select(
              'id_incidencia, fecha_hora_registro, nivel_reincidencia, observaciones, estado',
            )
            .single());
        }
        if (error) {
          console.error('Error al crear incidencia:', error);
          return { incident: null, error: error.message };
        }
        return {
          incident: {
            id: data.id_incidencia,
            studentId: incident.studentId,
            faultTypeId: incident.faultTypeId,
            registeredBy: incident.registeredBy,
            registeredAt: data.fecha_hora_registro,
            observations: data.observaciones ?? incident.observations ?? null,
            reincidenceLevel: (data.nivel_reincidencia ?? 0) as Incident['reincidenceLevel'],
            hasEvidence: false,
            evidenceCount: 0,
            status: (data.estado || 'Activa') as Incident['status'],
            tallerId:
              (data as { taller_id?: string | null }).taller_id ??
              incident.tallerId ??
              null,
          },
          error: null,
        };
      }

      const includeTaller = shouldIncludeTallerEmbed(isTalleresEnabled());
      let selectClause = buildIncidentSelect({ full: true, includeTaller });
      let { data, error } = await insertQuery.select(selectClause).single();
      if (error && includeTaller && isMissingTallerSchemaError(error)) {
        setTallerSchemaAvailable(false);
        selectClause = buildIncidentSelect({ full: true, includeTaller: false });
        ({ data, error } = await insertQuery.select(selectClause).single());
      }
      if (error && isMissingRecomendacionError(error)) {
        setRecomendacionAvailable(false);
        selectClause = buildIncidentSelect({
          full: true,
          includeTaller: shouldIncludeTallerEmbed(isTalleresEnabled()),
          includeRecomendacion: false,
        });
        ({ data, error } = await insertQuery.select(selectClause).single());
      }

      if (error) {
        console.error('Error al crear incidencia:', error);
        return { incident: null, error: error.message };
      }

      return { incident: this.mapDBToIncident(data), error: null };
    } catch (error: any) {
      console.error('Error en create:', error);
      return { incident: null, error: error.message || 'Error al crear incidencia' };
    }
  },

  /**
   * Obtener incidencias con filtros (paginado por defecto; fetchAll solo para exportación).
   */
  async getAll(
    filters?: IncidentsListFilters,
  ): Promise<{ incidents: Incident[]; total: number; error: string | null }> {
    try {
      await ensureSupabaseReady();
      const dateRange = await resolveDateRange(filters);
      const scope = await resolveIncidentQueryScope(filters);
      if (scope.empty) {
        return { incidents: [], total: 0, error: null };
      }

      const useFullSelect = Boolean(filters?.fetchAll && filters?.estudianteId);

      if (filters?.fetchAll) {
        const { data, error } = await fetchAllPages<Incident>(async (from, to) => {
          const pageSize = to - from + 1;
          const pageResult = await this.fetchIncidentPage(
            filters,
            dateRange,
            scope,
            from,
            pageSize,
            useFullSelect,
          );
          return {
            data: pageResult.incidents,
            error: pageResult.error
              ? { message: pageResult.error, details: '', hint: '', code: '' }
              : null,
          };
        });

        if (error) {
          return { incidents: [], total: 0, error };
        }

        return { incidents: data, total: data.length, error: null };
      }

      const pageSize = filters?.pageSize ?? 10;
      const page = Math.max(1, filters?.page ?? 1);
      const offset =
        filters?.offset != null ? filters.offset : (page - 1) * pageSize;

      const usesPagePagination = filters?.page != null || filters?.pageSize != null;

      return this.fetchIncidentPage(
        filters,
        dateRange,
        scope,
        usesPagePagination ? offset : undefined,
        usesPagePagination ? pageSize : filters?.limit,
        useFullSelect,
      );
    } catch (error: any) {
      console.error('Error en getAll:', error);
      return { incidents: [], total: 0, error: error.message || 'Error al obtener incidencias' };
    }
  },

  async fetchIncidentPage(
    filters: IncidentsListFilters | undefined,
    dateRange: { fechaDesde?: string; fechaHasta?: string },
    scope: IncidentQueryScope,
    offset: number | undefined,
    limit: number | undefined,
    fullSelect = false,
  ): Promise<{ incidents: Incident[]; total: number; error: string | null }> {
    const includeTaller = shouldIncludeTallerEmbed(isTalleresEnabled());
    const run = async (withTaller: boolean, withRecomendacion = true) => {
      const selectClause = buildIncidentSelect({
        full: fullSelect,
        includeTaller: withTaller,
        includeRecomendacion: withRecomendacion,
      });
      let query = supabase.from('incidencias').select(selectClause, { count: 'exact' });
      query = applyIncidentFilters(query, filters, dateRange, scope);
      query = query.order('fecha_hora_registro', { ascending: false });
      if (offset != null && limit != null) {
        query = query.range(offset, offset + limit - 1);
      } else if (limit != null) {
        query = query.limit(limit);
      }
      return query;
    };

    let { data, error, count } = await run(includeTaller);

    if (error && includeTaller && isMissingTallerSchemaError(error)) {
      setTallerSchemaAvailable(false);
      ({ data, error, count } = await run(false));
    }

    if (error && isMissingRecomendacionError(error)) {
      setRecomendacionAvailable(false);
      ({ data, error, count } = await run(includeTaller, false));
    }

    if (error) {
      console.error('Error al obtener incidencias:', error);
      return { incidents: [], total: 0, error: error.message };
    }

    const incidents: Incident[] = (data || []).map((inc: any) => this.mapDBToIncident(inc));

    // PostgREST a veces devuelve count=null o 0 incorrecto cuando hay embeds.
    let total = typeof count === 'number' ? count : null;
    if (total == null || (total === 0 && incidents.length > 0)) {
      try {
        let countQuery = supabase
          .from('incidencias')
          .select('id_incidencia', { count: 'exact', head: true });
        countQuery = applyIncidentFilters(countQuery, filters, dateRange, scope);
        const head = await countQuery;
        if (!head.error && typeof head.count === 'number' && head.count >= 0) {
          // Solo reemplazar si el head es coherente con las filas vistas
          if (head.count > 0 || incidents.length === 0) {
            total = head.count;
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (total == null || (total === 0 && incidents.length > 0)) {
      total = (offset ?? 0) + incidents.length;
    }

    return { incidents, total, error: null };
  },

  /** Totales para KPIs del listado (consultas ligeras en paralelo). */
  async getListSummary(
    filters?: Omit<IncidentsListFilters, 'page' | 'pageSize' | 'offset' | 'limit' | 'fetchAll'>,
  ): Promise<{ summary: IncidentsListSummary; error: string | null }> {
    try {
      await ensureSupabaseReady();
      const dateRange = await resolveDateRange(filters);
      const scope = await resolveIncidentQueryScope(filters);

      if (scope.empty) {
        return {
          summary: { total: 0, activas: 0, conEvidencia: 0 },
          error: null,
        };
      }

      const countFiltered = async (extra?: Record<string, string>) => {
        let query = supabase
          .from('incidencias')
          .select('id_incidencia', { count: 'exact', head: true });
        query = applyIncidentFilters(query, filters, dateRange, scope) as typeof query;
        if (extra?.estado) {
          query = query.eq('estado', extra.estado);
        }
        if (extra?.estado_evidencia) {
          query = query.eq('estado_evidencia', extra.estado_evidencia);
        }
        const { count, error } = await query;
        if (error) {
          // Columnas revisado_app / confirmada_app pueden faltar en algunos entornos
          const msg = error.message || '';
          if (
            /revisado_app|confirmada_app/i.test(msg) &&
            filters?.revisado
          ) {
            throw new Error(msg);
          }
          if (/revisado_app|confirmada_app/i.test(msg)) {
            // Reintentar sin filtros de revisado (no aplican si no hay columna)
            let retry = supabase
              .from('incidencias')
              .select('id_incidencia', { count: 'exact', head: true });
            const filtersWithoutRevisado = filters ? { ...filters, revisado: undefined } : filters;
            retry = applyIncidentFilters(retry, filtersWithoutRevisado, dateRange, scope) as typeof retry;
            if (extra?.estado) retry = retry.eq('estado', extra.estado);
            if (extra?.estado_evidencia) retry = retry.eq('estado_evidencia', extra.estado_evidencia);
            const second = await retry;
            if (second.error) throw new Error(second.error.message);
            return second.count ?? 0;
          }
          throw new Error(msg);
        }
        return count ?? 0;
      };

      const [total, activas, conEvidencia] = await Promise.all([
        countFiltered(),
        countFiltered({ estado: 'Activa' }),
        countFiltered({ estado_evidencia: 'Con evidencia' }),
      ]);

      // Si el total salió 0, reintentar un COUNT mínimo sin filtros extra por si falló el scope
      if (total === 0 && !scope.empty && !filters?.search && !filters?.grado && !filters?.seccion) {
        const { count: rawTotal, error: rawErr } = await supabase
          .from('incidencias')
          .select('id_incidencia', { count: 'exact', head: true });
        if (!rawErr && typeof rawTotal === 'number' && rawTotal > 0) {
          const { count: rawActivas } = await supabase
            .from('incidencias')
            .select('id_incidencia', { count: 'exact', head: true })
            .eq('estado', 'Activa');
          const { count: rawEv } = await supabase
            .from('incidencias')
            .select('id_incidencia', { count: 'exact', head: true })
            .eq('estado_evidencia', 'Con evidencia');
          return {
            summary: {
              total: rawTotal,
              activas: rawActivas ?? 0,
              conEvidencia: rawEv ?? 0,
            },
            error: null,
          };
        }
      }

      return {
        summary: { total, activas, conEvidencia },
        error: null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al obtener resumen';
      return {
        summary: { total: 0, activas: 0, conEvidencia: 0 },
        error: message,
      };
    }
  },

  /**
   * Conteo ligero de faltas / carnet / tardanzas que disparan alarma de deuda.
   * Solo cuenta eventos posteriores al último compromiso firmado (por tipo).
   * Falta / Falta académica; carnet = "No porta carnet institucional"; Tarde en llegadas.
   */
  async countDebtTriggerFaults(studentId: number): Promise<{
    faltaCount: number;
    carnetCount: number;
    tardeCount: number;
    alertPago: boolean;
    error: string | null;
  }> {
    try {
      await ensureSupabaseReady();
      const { baselines } = await compromisosAlarmService.getBaselines(studentId);

      const [incRes, faltaArrivalRes, tardeArrivalRes] = await Promise.all([
        supabase
          .from('incidencias')
          .select(
            'id_incidencia, fecha_hora_registro, catalogos_faltas:id_falta ( nombre_falta )',
          )
          .eq('id_estudiante', studentId)
          .neq('estado', 'Anulada'),
        supabase
          .from('registros_llegada')
          .select('id_registro, fecha')
          .eq('id_estudiante', studentId)
          .eq('estado', 'Falta'),
        supabase
          .from('registros_llegada')
          .select('id_registro, fecha')
          .eq('id_estudiante', studentId)
          // TJ no apaga la alarma: cuenta Tarde y Tarde justificada.
          .in('estado', ['Tarde', 'Tarde justificada']),
      ]);

      if (incRes.error) {
        return {
          faltaCount: 0,
          carnetCount: 0,
          tardeCount: 0,
          alertPago: false,
          error: incRes.error.message,
        };
      }

      let faltaCount = 0;
      let carnetCount = 0;
      for (const row of incRes.data ?? []) {
        const typed = row as {
          fecha_hora_registro?: string | null;
          catalogos_faltas?: { nombre_falta?: string } | null;
        };
        const name = typed.catalogos_faltas?.nombre_falta;
        const at = typed.fecha_hora_registro;
        if (isFaltaInasistenciaName(name)) {
          if (isEventAfterBaseline(at, baselines.falta)) faltaCount += 1;
        } else if (isCarnetFaultName(name)) {
          // Carnet sigue el mismo ciclo de “falta de compromiso” vía tipo falta
          // (documento de compromiso tipo falta cubre inasistencias; carnet usa baseline falta).
          if (isEventAfterBaseline(at, baselines.falta)) carnetCount += 1;
        }
      }

      if (!faltaArrivalRes.error) {
        for (const row of faltaArrivalRes.data ?? []) {
          const fecha = (row as { fecha?: string }).fecha;
          if (isEventAfterBaseline(fecha, baselines.falta)) faltaCount += 1;
        }
      }

      let tardeCount = 0;
      if (!tardeArrivalRes.error) {
        for (const row of tardeArrivalRes.data ?? []) {
          const fecha = (row as { fecha?: string }).fecha;
          if (isEventAfterBaseline(fecha, baselines.tardanza)) tardeCount += 1;
        }
      }

      // Pago: se calcula en el escáner con estadoPension + baseline pago.
      const alertPago = false;

      return { faltaCount, carnetCount, tardeCount, alertPago, error: null };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Error al contar faltas de deuda';
      return {
        faltaCount: 0,
        carnetCount: 0,
        tardeCount: 0,
        alertPago: false,
        error: message,
      };
    }
  },

  /**
   * Anular incidencia
   */
  async annul(
    id: number,
    idUsuario: number,
    motivo: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      if (motivo.length < 20) {
        return { success: false, error: 'El motivo debe tener al menos 20 caracteres' };
      }

      // Usar la función de la base de datos
      const { data, error } = await supabase.rpc('anular_incidencia', {
        p_id_incidencia: id,
        p_id_usuario: idUsuario,
        p_motivo: motivo,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en annul:', error);
      return { success: false, error: error.message || 'Error al anular incidencia' };
    }
  },

  /**
   * Justificar incidencia
   * Cambia el estado a "Justificada" y guarda el motivo
   */
  async justify(
    id: number,
    idUsuario: number,
    motivo: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      if (motivo.length < 10) {
        return { success: false, error: 'El motivo de justificación debe tener al menos 10 caracteres' };
      }

      // Actualizar la incidencia
      const { error } = await supabase
        .from('incidencias')
        .update({
          estado: 'Justificada',
          motivo_anulacion: motivo, // Usamos el mismo campo para guardar el motivo
          id_usuario_anulacion: idUsuario, // Usamos el mismo campo para guardar quién justificó
          fecha_anulacion: new Date().toISOString(), // Usamos el mismo campo para guardar la fecha
        })
        .eq('id_incidencia', id)
        .eq('estado', 'Activa'); // Solo permitir justificar incidencias activas

      if (error) {
        console.error('Error al justificar incidencia:', error);
        return { success: false, error: error.message || 'Error al justificar incidencia' };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en justify:', error);
      return { success: false, error: error.message || 'Error al justificar incidencia' };
    }
  },

  /**
   * Registrar impresión de incidencia
   */
  async registerPrint(id: number): Promise<{ success: boolean; error: string | null }> {
    try {
      // Leer el contador actual e incrementarlo (Supabase JS no expone .raw)
      const { data: current, error: fetchError } = await supabase
        .from('incidencias')
        .select('veces_impreso')
        .eq('id_incidencia', id)
        .single();

      if (fetchError) {
        return { success: false, error: fetchError.message || 'Error al registrar impresión' };
      }

      const nuevoConteo = ((current?.veces_impreso as number) || 0) + 1;

      const { error } = await supabase
        .from('incidencias')
        .update({
          veces_impreso: nuevoConteo,
          fecha_ultima_impresion: new Date().toISOString(),
        })
        .eq('id_incidencia', id);

      if (error) {
        return { success: false, error: error.message || 'Error al registrar impresión' };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en registerPrint:', error);
      return { success: false, error: error.message || 'Error al registrar impresión' };
    }
  },

  /**
   * Mapear datos de DB a tipo Incident
   */
  mapDBToIncident(data: any): Incident {
    const estudiante = data.estudiantes || data.id_estudiante;
    const falta = data.catalogos_faltas || data.id_falta;
    const usuario = data.usuarios_registro || data.id_usuario_registro;
    const taller = data.talleres || data.taller_id;

    return {
      id: data.id_incidencia,
      studentId: data.id_estudiante,
      student: estudiante && typeof estudiante === 'object' ? {
        id: estudiante.id_estudiante,
        fullName: estudiante.nombre_completo,
        grade: estudiante.grado,
        section: estudiante.seccion,
        level: (estudiante.nivel_educativo || 'Secundaria') as EducationalLevel,
        barcode: estudiante.codigo_barras,
        profilePhoto: estudiante.foto_perfil,
        active: estudiante.activo,
      } : undefined,
      faultTypeId: data.id_falta,
      faultType: falta && typeof falta === 'object' ? {
        id: falta.id_falta,
        name: falta.nombre_falta,
        description: falta.descripcion,
        recommendation: falta.recomendacion ?? null,
        category: falta.categoria,
        severity: falta.es_grave ? 'Grave' : 'Leve',
        points: falta.puntos_reincidencia,
        active: falta.activo,
      } : undefined,
      registeredBy: data.id_usuario_registro,
      registeredByUser: usuario && typeof usuario === 'object' ? {
        id: usuario.id_usuario,
        username: usuario.username,
        fullName: usuario.nombre_completo,
        email: usuario.email,
        role: usuario.rol,
        active: usuario.activo,
      } : undefined,
      registeredAt: data.fecha_hora_registro,
      observations: data.observaciones,
      reincidenceLevel: data.nivel_reincidencia as any,
      hasEvidence: data.estado_evidencia === 'Con evidencia',
      evidenceCount: data.cantidad_fotos,
      status: data.estado,
      annulledBy: data.id_usuario_anulacion,
      annulledAt: data.fecha_anulacion,
      annulmentReason: data.motivo_anulacion,
      tallerId: data.taller_id ?? null,
      tallerNombre: taller && typeof taller === 'object' ? taller.nombre ?? null : null,
      revisadoApp: Boolean(data.revisado_app),
      revisadoAppAt: data.revisado_app_en ?? null,
      confirmadaApp: Boolean(data.confirmada_app),
      confirmadaAppAt: data.confirmada_app_en ?? null,
    };
  },

  /**
   * Incidencias de un mes para el calendario público de padres (RPC SECURITY DEFINER).
   */
  async fetchMonthIncidentsForStudent(
    studentId: number,
    year?: number,
    month?: number,
  ): Promise<Incident[]> {
    return fetchMonthIncidentsForStudent(studentId, year, month);
  },
};

type RpcPublicIncidentRow = {
  id: number;
  studentId: number;
  date: string;
  registeredAt: string;
  faultName: string;
  status: string;
};

export async function fetchMonthIncidentsForStudent(
  studentId: number,
  year?: number,
  month?: number,
): Promise<Incident[]> {
  const bounds =
    year != null && month != null ? getMonthBounds(year, month) : getLimaMonthBounds();
  const y = year ?? bounds.year;
  const m = month ?? bounds.month;

  const { data, error } = await supabase.rpc('incidencias_mes_por_estudiante', {
    p_student_id: studentId,
    p_year: y,
    p_month: m,
  });

  if (error) {
    if (error.code !== 'PGRST202' && !error.message?.includes('does not exist')) {
      console.warn('fetchMonthIncidentsForStudent:', error.message);
    }
    return [];
  }

  const rows = (Array.isArray(data) ? data : []) as RpcPublicIncidentRow[];
  return rows.map((row) => ({
    id: Number(row.id),
    studentId: Number(row.studentId),
    faultTypeId: 0,
    faultType: {
      id: 0,
      name: row.faultName || 'Incidencia registrada',
      description: null,
      category: 'Conducta',
      severity: 'Leve',
      points: 0,
      active: true,
    },
    registeredBy: 0,
    registeredAt: row.registeredAt || `${row.date}T00:00:00`,
    observations: null,
    reincidenceLevel: 0,
    hasEvidence: false,
    evidenceCount: 0,
    status: (row.status as EstadoIncidencia) || 'Activa',
  }));
}
