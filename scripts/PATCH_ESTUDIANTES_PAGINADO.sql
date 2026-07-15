-- =============================================================================
-- PARCHE: lista de estudiantes paginada (10 por página por defecto)
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_lista_estudiantes(p_token text, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rol text;
  v_busqueda text := nullif(trim(p_filtros->>'search'), '');
  v_grado text := nullif(trim(p_filtros->>'grade'), '');
  v_seccion text := nullif(trim(p_filtros->>'section'), '');
  v_nivel text := nullif(trim(p_filtros->>'level'), '');
  v_activo boolean := CASE WHEN p_filtros ? 'active' THEN (p_filtros->>'active')::boolean ELSE null END;
  v_fetch_all boolean := coalesce((p_filtros->>'fetchAll')::boolean, false);
  v_limit int := CASE
    WHEN v_fetch_all THEN NULL
    WHEN p_filtros ? 'limit' THEN greatest((p_filtros->>'limit')::int, 1)
    ELSE 10
  END;
  v_offset int := greatest(coalesce((p_filtros->>'offset')::int, 0), 0);
  v_ids int[];
  v_result jsonb;
  v_total bigint;
  v_stats jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Sesión inválida o expirada',
      'students', '[]'::jsonb,
      'total', 0,
      'stats', jsonb_build_object('sinIncidencias', 0, 'nivelModerado', 0, 'nivelAlto', 0)
    );
  END IF;
  IF NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object(
      'error', 'No autorizado',
      'students', '[]'::jsonb,
      'total', 0,
      'stats', jsonb_build_object('sinIncidencias', 0, 'nivelModerado', 0, 'nivelAlto', 0)
    );
  END IF;

  IF v_busqueda IS NOT NULL THEN
    SELECT array_agg(DISTINCT id_estudiante) INTO v_ids
    FROM (
      SELECT id_estudiante FROM public.estudiantes WHERE nombre_completo ILIKE '%' || v_busqueda || '%'
      UNION
      SELECT id_estudiante FROM public.estudiantes WHERE codigo_barras ILIKE '%' || v_busqueda || '%'
    ) q;
    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'students', '[]'::jsonb,
        'total', 0,
        'stats', jsonb_build_object('sinIncidencias', 0, 'nivelModerado', 0, 'nivelAlto', 0),
        'error', null
      );
    END IF;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.estudiantes e
  WHERE (v_ids IS NULL OR e.id_estudiante = ANY(v_ids))
    AND (v_grado IS NULL OR e.grado = v_grado)
    AND (v_seccion IS NULL OR e.seccion = v_seccion)
    AND (v_nivel IS NULL OR e.nivel_educativo::text = v_nivel)
    AND (v_activo IS NULL OR e.activo = v_activo);

  SELECT jsonb_build_object(
    'sinIncidencias', count(*) FILTER (WHERE coalesce(n.nivel_actual, 0) = 0),
    'nivelModerado', count(*) FILTER (WHERE coalesce(n.nivel_actual, 0) BETWEEN 1 AND 2),
    'nivelAlto', count(*) FILTER (WHERE coalesce(n.nivel_actual, 0) >= 3)
  )
  INTO v_stats
  FROM public.estudiantes e
  LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante
  WHERE (v_ids IS NULL OR e.id_estudiante = ANY(v_ids))
    AND (v_grado IS NULL OR e.grado = v_grado)
    AND (v_seccion IS NULL OR e.seccion = v_seccion)
    AND (v_nivel IS NULL OR e.nivel_educativo::text = v_nivel)
    AND (v_activo IS NULL OR e.activo = v_activo);

  SELECT coalesce(jsonb_agg(
    public._sie_student_json_completo(
      e,
      coalesce(n.nivel_actual, 0),
      coalesce(n.total_faltas_60_dias, 0)
    ) ORDER BY e.nombre_completo
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT e.*
    FROM public.estudiantes e
    WHERE (v_ids IS NULL OR e.id_estudiante = ANY(v_ids))
      AND (v_grado IS NULL OR e.grado = v_grado)
      AND (v_seccion IS NULL OR e.seccion = v_seccion)
      AND (v_nivel IS NULL OR e.nivel_educativo::text = v_nivel)
      AND (v_activo IS NULL OR e.activo = v_activo)
    ORDER BY e.nombre_completo
    LIMIT v_limit OFFSET CASE WHEN v_fetch_all THEN 0 ELSE v_offset END
  ) e
  LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante;

  RETURN jsonb_build_object(
    'students', v_result,
    'total', v_total,
    'stats', coalesce(v_stats, jsonb_build_object('sinIncidencias', 0, 'nivelModerado', 0, 'nivelAlto', 0)),
    'limit', coalesce(v_limit, v_total),
    'offset', CASE WHEN v_fetch_all THEN 0 ELSE v_offset END,
    'error', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_lista_estudiantes(text, jsonb) TO anon, authenticated;
