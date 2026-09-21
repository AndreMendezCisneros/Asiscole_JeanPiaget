-- =============================================================================
-- Reportes: una sola lectura, sin RLS por fila.
-- La versión anterior (SECURITY INVOKER) tardaba lo mismo que el frontend
-- porque Postgres reevaluaba permisos en cada fila.
-- Ejecutar de nuevo en el SQL Editor (reemplaza la función).
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
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE b.fecha_hora_registro >= p.hoy)::int AS today_c,
      count(*) FILTER (WHERE b.fecha_hora_registro >= p.semana)::int AS week_c,
      count(*) FILTER (WHERE b.fecha_hora_registro >= p.mes_ini)::int AS month_c,
      count(DISTINCT b.id_estudiante) FILTER (WHERE b.fecha_hora_registro >= p.mes_ini)::int AS students_month,
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
            'level4', count(*) FILTER (WHERE nivel_reincidencia = 4)
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
        'weeklyData', we.arr
      )
  END
  FROM totals t
  CROSS JOIN top_faults tf
  CROSS JOIN by_grade bg
  CROSS JOIN by_section bs
  CROSS JOIN monthly mo
  CROSS JOIN weekly we;
$$;

REVOKE ALL ON FUNCTION public.sie_reportes_bundle(
  timestamptz, timestamptz, text, text[], timestamptz, timestamptz, jsonb, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sie_reportes_bundle(
  timestamptz, timestamptz, text, text[], timestamptz, timestamptz, jsonb, jsonb
) TO anon, authenticated;

COMMENT ON FUNCTION public.sie_reportes_bundle IS
  'Agregados de Reportes en una lectura. Solo staff (x-sie-token).';
