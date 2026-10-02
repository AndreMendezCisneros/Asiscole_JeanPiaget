-- =============================================================================
-- PATCH: auditoría paginada y estadísticas en servidor.
-- Evita el count exact con RLS fila por fila (timeout) y el corte de 1000 filas.
-- Mismo permiso que la política actual (sie_auditoria_staff_select): staff.
-- Idempotente. Aplicar con scripts/jeanpiaget/apply_patch.py
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_auditoria_pagina(p_token text, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_tabla text := nullif(trim(p_filtros->>'table'), '');
  v_accion text := nullif(trim(p_filtros->>'operation'), '');
  v_desde timestamptz := nullif(trim(p_filtros->>'startDate'), '')::timestamptz;
  v_hasta timestamptz := nullif(trim(p_filtros->>'endDate'), '')::timestamptz;
  v_limit int := least(greatest(coalesce((p_filtros->>'limit')::int, 10), 1), 200);
  v_offset int := greatest(coalesce((p_filtros->>'offset')::int, 0), 0);
  v_total bigint;
  v_logs jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('logs', '[]'::jsonb, 'total', 0, 'error', 'Sesión inválida o expirada');
  END IF;
  IF NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('logs', '[]'::jsonb, 'total', 0, 'error', 'No autorizado');
  END IF;

  SELECT count(*) INTO v_total
  FROM public.auditoria_logs a
  WHERE (v_tabla IS NULL OR a.tabla_afectada = v_tabla)
    AND (v_accion IS NULL OR a.accion::text = v_accion)
    AND (v_desde IS NULL OR a.fecha_hora >= v_desde)
    AND (v_hasta IS NULL OR a.fecha_hora <= v_hasta);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id_log', p.id_log,
      'tabla_afectada', p.tabla_afectada,
      'id_registro', p.id_registro,
      'accion', p.accion,
      'id_usuario', p.id_usuario,
      'descripcion_accion', p.descripcion_accion,
      'ip_address', p.ip_address,
      'fecha_hora', p.fecha_hora,
      'cambios', p.cambios
    ) ORDER BY p.fecha_hora DESC, p.id_log DESC
  ), '[]'::jsonb)
  INTO v_logs
  FROM (
    SELECT
      a.id_log, a.tabla_afectada, a.id_registro, a.accion, a.id_usuario,
      a.descripcion_accion, a.ip_address, a.fecha_hora,
      CASE a.accion::text
        WHEN 'INSERT' THEN (SELECT count(*) FROM jsonb_object_keys(coalesce(a.datos_nuevos, '{}'::jsonb)))
        WHEN 'DELETE' THEN (SELECT count(*) FROM jsonb_object_keys(coalesce(a.datos_anteriores, '{}'::jsonb)))
        ELSE (
          SELECT count(*)
          FROM (
            SELECT k FROM jsonb_object_keys(coalesce(a.datos_nuevos, '{}'::jsonb)) k
            UNION
            SELECT k FROM jsonb_object_keys(coalesce(a.datos_anteriores, '{}'::jsonb)) k
          ) keys
          WHERE (a.datos_nuevos -> keys.k) IS DISTINCT FROM (a.datos_anteriores -> keys.k)
        )
      END AS cambios
    FROM public.auditoria_logs a
    WHERE (v_tabla IS NULL OR a.tabla_afectada = v_tabla)
      AND (v_accion IS NULL OR a.accion::text = v_accion)
      AND (v_desde IS NULL OR a.fecha_hora >= v_desde)
      AND (v_hasta IS NULL OR a.fecha_hora <= v_hasta)
    ORDER BY a.fecha_hora DESC, a.id_log DESC
    LIMIT v_limit OFFSET v_offset
  ) p;

  RETURN jsonb_build_object('logs', v_logs, 'total', v_total, 'error', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_auditoria_stats(p_token text, p_dias int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_desde timestamptz := now() - make_interval(days => greatest(coalesce(p_dias, 7), 1));
  v_totales jsonb;
  v_tablas jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('error', 'No autorizado');
  END IF;

  SELECT jsonb_build_object(
    'totalOperations', count(*),
    'inserts', count(*) FILTER (WHERE accion::text = 'INSERT'),
    'updates', count(*) FILTER (WHERE accion::text = 'UPDATE'),
    'deletes', count(*) FILTER (WHERE accion::text = 'DELETE')
  )
  INTO v_totales
  FROM public.auditoria_logs
  WHERE fecha_hora >= v_desde;

  SELECT coalesce(jsonb_object_agg(tabla_afectada, n), '{}'::jsonb)
  INTO v_tablas
  FROM (
    SELECT tabla_afectada, count(*) AS n
    FROM public.auditoria_logs
    WHERE fecha_hora >= v_desde
    GROUP BY tabla_afectada
  ) t;

  RETURN v_totales || jsonb_build_object('byTable', v_tablas, 'error', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_auditoria_pagina(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sie_auditoria_stats(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sie_auditoria_pagina(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_auditoria_stats(text, int) TO anon, authenticated;
