-- =============================================================================
-- Reportes: una sola lectura, sin RLS por fila.
-- La versión anterior (SECURITY INVOKER) tardaba lo mismo que el frontend
-- porque Postgres reevaluaba permisos en cada fila.
-- Ejecutar de nuevo en el SQL Editor (reemplaza la función).
-- v2: statusCounts, avgHorasJustificacion, sectionActivity, topStudents,
--     dailyTrend y level5 en byGrade. Las claves anteriores no cambian.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_incidencias_activa_fecha
  ON public.incidencias (fecha_hora_registro DESC)
  WHERE estado = 'Activa';

CREATE OR REPLACE FUNCTION public.sie_reportes_bundle(
  p_fecha_desde timestamptz,
  p_fecha_hasta timestamptz,
  p_nivel text DEFAULT NULL,
  p_grados text[] DEFAULT NULL,
  p_hoy timestamptz DEFAULT NULL,
  p_inicio_semana timestamptz DEFAULT NULL,
  p_meses jsonb DEFAULT '[]'::jsonb,
  p_dias jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH auth AS (
    SELECT public.sie_es_staff_sesion() IS TRUE AS ok
  ),
  params AS (
    SELECT
      p_fecha_desde AS desde,
      p_fecha_hasta AS hasta,
      coalesce(
        p_hoy,
        date_trunc('day', timezone('America/Lima', now())) AT TIME ZONE 'America/Lima'
      ) AS hoy,
      coalesce(
        p_inicio_semana,
        date_trunc('week', timezone('America/Lima', now())) AT TIME ZONE 'America/Lima'
      ) AS semana,
      date_trunc('month', coalesce(p_hoy, now())) AS mes_ini
  ),
  base AS MATERIALIZED (
    SELECT
      i.nivel_reincidencia,
      i.fecha_hora_registro,
      i.id_estudiante,
      e.nombre_completo,
      coalesce(cf.nombre_falta, 'Desconocida') AS nombre_falta,
      coalesce(nullif(trim(e.grado::text), ''), 'Sin grado') AS grado,
      coalesce(nullif(trim(e.seccion::text), ''), 'Sin sección') AS seccion,
      coalesce(nullif(trim(e.nivel_educativo::text), ''), 'Secundaria') AS nivel_educativo
    FROM auth
    JOIN params p ON auth.ok
    JOIN public.incidencias i
      ON i.estado = 'Activa'
     AND i.fecha_hora_registro >= p.desde
     AND i.fecha_hora_registro <= p.hasta
    JOIN public.estudiantes e ON e.id_estudiante = i.id_estudiante
    LEFT JOIN public.catalogo_faltas cf ON cf.id_falta = i.id_falta
    WHERE (p_nivel IS NULL OR e.nivel_educativo::text = p_nivel)
      AND (p_grados IS NULL OR cardinality(p_grados) = 0 OR e.grado::text = ANY (p_grados))
  ),
  -- Todas las incidencias del periodo, sin filtrar estado (tasa de resolución).
  base_all AS MATERIALIZED (
    SELECT
      i.estado::text AS estado,
      i.fecha_hora_registro,
      i.fecha_anulacion
    FROM auth
    JOIN params p ON auth.ok
    JOIN public.incidencias i
      ON i.fecha_hora_registro >= p.desde
     AND i.fecha_hora_registro <= p.hasta
    JOIN public.estudiantes e ON e.id_estudiante = i.id_estudiante
    WHERE (p_nivel IS NULL OR e.nivel_educativo::text = p_nivel)
      AND (p_grados IS NULL OR cardinality(p_grados) = 0 OR e.grado::text = ANY (p_grados))
  ),
  status_totals AS (
    SELECT
      count(*)::int AS registradas,
      count(*) FILTER (WHERE estado = 'Activa')::int AS activas,
      count(*) FILTER (WHERE estado = 'Justificada')::int AS justificadas,
      count(*) FILTER (WHERE estado = 'Anulada')::int AS anuladas,
      count(*) FILTER (WHERE estado = 'En revisión')::int AS en_revision,
      round((
        avg(extract(epoch FROM (fecha_anulacion - fecha_hora_registro)) / 3600.0)
          FILTER (
            WHERE estado = 'Justificada'
              AND fecha_anulacion IS NOT NULL
              AND fecha_anulacion >= fecha_hora_registro
          )
      )::numeric, 1) AS avg_horas_justificacion
    FROM base_all
  ),
  -- Alumnos del alcance: activos o con incidencias activas en el periodo.
  students_scope AS (
    SELECT
      e.id_estudiante,
      e.activo IS TRUE AS activo,
      coalesce(nullif(trim(e.grado::text), ''), 'Sin grado') AS grado,
      coalesce(nullif(trim(e.seccion::text), ''), 'Sin sección') AS seccion,
      coalesce(nullif(trim(e.nivel_educativo::text), ''), 'Secundaria') AS nivel_educativo
    FROM auth
    JOIN public.estudiantes e ON auth.ok
    WHERE (p_nivel IS NULL OR e.nivel_educativo::text = p_nivel)
      AND (p_grados IS NULL OR cardinality(p_grados) = 0 OR e.grado::text = ANY (p_grados))
      AND (
        e.activo IS TRUE
        OR EXISTS (SELECT 1 FROM base b WHERE b.id_estudiante = e.id_estudiante)
      )
  ),
  incidents_by_student AS (
    SELECT id_estudiante, count(*)::int AS c
    FROM base
    GROUP BY id_estudiante
  ),
  tardies_by_student AS (
    SELECT r.id_estudiante, count(*)::int AS c
    FROM auth
    JOIN params p ON auth.ok
    JOIN public.registros_llegada r
      ON r.fecha >= (p.desde AT TIME ZONE 'America/Lima')::date
     AND r.fecha <= (p.hasta AT TIME ZONE 'America/Lima')::date
     AND r.estado IN ('Tarde', 'Tarde justificada')
    GROUP BY r.id_estudiante
  ),
  section_activity AS (
    SELECT coalesce(jsonb_agg(s.obj ORDER BY s.sort_level, s.grade, s.section), '[]'::jsonb) AS arr
    FROM (
      SELECT
        ss.grado AS grade,
        ss.seccion AS section,
        CASE WHEN ss.nivel_educativo = 'Primaria' THEN 0 ELSE 1 END AS sort_level,
        jsonb_build_object(
          'section', ss.seccion,
          'grade', ss.grado,
          'level', ss.nivel_educativo,
          'label', ss.nivel_educativo || ' • ' || ss.grado || ' ' || ss.seccion,
          'enrolled', count(*) FILTER (WHERE ss.activo)::int,
          'incidents', coalesce(sum(ib.c), 0)::int,
          'tardies', coalesce(sum(tb.c), 0)::int
        ) AS obj
      FROM students_scope ss
      LEFT JOIN incidents_by_student ib ON ib.id_estudiante = ss.id_estudiante
      LEFT JOIN tardies_by_student tb ON tb.id_estudiante = ss.id_estudiante
      GROUP BY ss.nivel_educativo, ss.grado, ss.seccion
    ) s
  ),
  top_students AS (
    SELECT coalesce(jsonb_agg(x.obj ORDER BY x.cnt DESC, x.max_level DESC, x.last_at DESC), '[]'::jsonb) AS arr
    FROM (
      SELECT
        count(*)::int AS cnt,
        max(nivel_reincidencia) AS max_level,
        max(fecha_hora_registro) AS last_at,
        jsonb_build_object(
          'studentId', id_estudiante,
          'fullName', min(nombre_completo),
          'level', min(nivel_educativo),
          'grade', min(grado),
          'section', min(seccion),
          'incidents', count(*)::int,
          'maxReincidence', max(nivel_reincidencia),
          'lastIncidentAt', max(fecha_hora_registro)
        ) AS obj
      FROM base
      GROUP BY id_estudiante
      ORDER BY count(*) DESC, max(nivel_reincidencia) DESC, max(fecha_hora_registro) DESC
      LIMIT 10
    ) x
  ),
  daily AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('date', d.dia, 'count', d.c) ORDER BY d.dia), '[]'::jsonb) AS arr
    FROM (
      SELECT
        to_char(timezone('America/Lima', fecha_hora_registro), 'YYYY-MM-DD') AS dia,
        count(*)::int AS c
      FROM base
      GROUP BY 1
    ) d
  ),
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE b.fecha_hora_registro >= p.hoy)::int AS today_c,
      count(*) FILTER (WHERE b.fecha_hora_registro >= p.semana)::int AS week_c,
      count(*) FILTER (WHERE b.fecha_hora_registro >= p.mes_ini)::int AS month_c,
      count(DISTINCT b.id_estudiante)::int AS students_month,
      round(coalesce(avg(b.nivel_reincidencia), 0)::numeric, 2) AS avg_n,
      count(*) FILTER (WHERE b.nivel_reincidencia = 0)::int AS l0,
      count(*) FILTER (WHERE b.nivel_reincidencia = 1)::int AS l1,
      count(*) FILTER (WHERE b.nivel_reincidencia = 2)::int AS l2,
      count(*) FILTER (WHERE b.nivel_reincidencia = 3)::int AS l3,
      count(*) FILTER (WHERE b.nivel_reincidencia = 4)::int AS l4,
      count(*) FILTER (WHERE b.nivel_reincidencia >= 5)::int AS l5
    FROM params p
    LEFT JOIN base b ON true
  ),
  top_faults AS (
    SELECT coalesce(jsonb_agg(x.obj ORDER BY x.cnt DESC), '[]'::jsonb) AS arr
    FROM (
      SELECT
        jsonb_build_object('faultType', nombre_falta, 'count', count(*)::int) AS obj,
        count(*)::int AS cnt
      FROM base
      GROUP BY nombre_falta
      ORDER BY count(*) DESC
      LIMIT 5
    ) x
  ),
  by_grade AS (
    SELECT coalesce(jsonb_agg(g.obj ORDER BY g.sort_level, g.grade), '[]'::jsonb) AS arr
    FROM (
      SELECT
        grado AS grade,
        CASE WHEN nivel_educativo = 'Primaria' THEN 0 ELSE 1 END AS sort_level,
        jsonb_build_object(
          'grade', grado,
          'level', nivel_educativo,
          'label', nivel_educativo || ' • ' || grado,
          'totalIncidents', count(*)::int,
          'studentsWithIncidents', count(DISTINCT id_estudiante)::int,
          'averageReincidence', round(avg(nivel_reincidencia)::numeric, 2),
          'levelDistribution', jsonb_build_object(
            'level0', count(*) FILTER (WHERE nivel_reincidencia = 0),
            'level1', count(*) FILTER (WHERE nivel_reincidencia = 1),
            'level2', count(*) FILTER (WHERE nivel_reincidencia = 2),
            'level3', count(*) FILTER (WHERE nivel_reincidencia = 3),
            'level4', count(*) FILTER (WHERE nivel_reincidencia = 4),
            'level5', count(*) FILTER (WHERE nivel_reincidencia >= 5)
          )
        ) AS obj
      FROM base
      GROUP BY nivel_educativo, grado
    ) g
  ),
  by_section AS (
    SELECT coalesce(jsonb_agg(s.obj ORDER BY s.sort_level, s.grade, s.section), '[]'::jsonb) AS arr
    FROM (
      SELECT
        grado AS grade,
        seccion AS section,
        CASE WHEN nivel_educativo = 'Primaria' THEN 0 ELSE 1 END AS sort_level,
        jsonb_build_object(
          'section', seccion,
          'grade', grado,
          'level', nivel_educativo,
          'label', nivel_educativo || ' • ' || grado || ' ' || seccion,
          'totalIncidents', count(*)::int,
          'studentsWithIncidents', count(DISTINCT id_estudiante)::int,
          'averageReincidence', round(avg(nivel_reincidencia)::numeric, 2)
        ) AS obj
      FROM base
      GROUP BY nivel_educativo, grado, seccion
    ) s
  ),
  monthly AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'month', m.elem->>'label',
          'incidents', (
            SELECT count(*)::int
            FROM base b
            WHERE b.fecha_hora_registro >= (m.elem->>'desde')::timestamptz
              AND b.fecha_hora_registro <= (m.elem->>'hasta')::timestamptz
          )
        )
        ORDER BY m.ord
      ),
      '[]'::jsonb
    ) AS arr
    FROM jsonb_array_elements(coalesce(p_meses, '[]'::jsonb)) WITH ORDINALITY AS m(elem, ord)
  ),
  weekly AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', d.elem->>'label',
          'count', (
            SELECT count(*)::int
            FROM base b
            WHERE b.fecha_hora_registro >= (d.elem->>'desde')::timestamptz
              AND b.fecha_hora_registro <= (d.elem->>'hasta')::timestamptz
          )
        )
        ORDER BY d.ord
      ),
      '[]'::jsonb
    ) AS arr
    FROM jsonb_array_elements(coalesce(p_dias, '[]'::jsonb)) WITH ORDINALITY AS d(elem, ord)
  )
  SELECT CASE
    WHEN NOT (SELECT ok FROM auth) THEN
      jsonb_build_object('error', 'No autorizado')
    ELSE
      jsonb_build_object(
        'totalIncidents', t.total,
        'incidentsToday', t.today_c,
        'incidentsThisWeek', t.week_c,
        'incidentsThisMonth', t.month_c,
        'studentsWithIncidents', t.students_month,
        'averageReincidenceLevel', t.avg_n,
        'levelDistribution', jsonb_build_object(
          'level0', t.l0, 'level1', t.l1, 'level2', t.l2,
          'level3', t.l3, 'level4', t.l4, 'level5', t.l5
        ),
        'topFaults', tf.arr,
        'incidentsByGrade', (
          SELECT coalesce(
            jsonb_agg(jsonb_build_object(
              'level', g->>'level',
              'grade', g->>'grade',
              'label', g->>'label',
              'count', (g->>'totalIncidents')::int
            )),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(bg.arr) g
        ),
        'byGrade', bg.arr,
        'bySection', bs.arr,
        'monthlyTrend', mo.arr,
        'weeklyData', we.arr,
        'statusCounts', jsonb_build_object(
          'registered', st.registradas,
          'active', st.activas,
          'justified', st.justificadas,
          'annulled', st.anuladas,
          'inReview', st.en_revision
        ),
        'avgHorasJustificacion', st.avg_horas_justificacion,
        'sectionActivity', sa.arr,
        'topStudents', ts.arr,
        'dailyTrend', dy.arr
      )
  END
  FROM totals t
  CROSS JOIN top_faults tf
  CROSS JOIN by_grade bg
  CROSS JOIN by_section bs
  CROSS JOIN monthly mo
  CROSS JOIN weekly we
  CROSS JOIN status_totals st
  CROSS JOIN section_activity sa
  CROSS JOIN top_students ts
  CROSS JOIN daily dy;
$$;

REVOKE ALL ON FUNCTION public.sie_reportes_bundle(
  timestamptz, timestamptz, text, text[], timestamptz, timestamptz, jsonb, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sie_reportes_bundle(
  timestamptz, timestamptz, text, text[], timestamptz, timestamptz, jsonb, jsonb
) TO anon, authenticated;

COMMENT ON FUNCTION public.sie_reportes_bundle IS
  'Agregados de Reportes en una lectura. Solo staff (x-sie-token).';
