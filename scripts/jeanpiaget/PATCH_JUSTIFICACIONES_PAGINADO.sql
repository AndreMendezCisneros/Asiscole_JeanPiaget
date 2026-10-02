-- =============================================================================
-- PATCH: justificar asistencia paginado en servidor (total real, sin tope de 500).
-- Idempotente. Aplicar con scripts/jeanpiaget/apply_patch.py
-- =============================================================================

CREATE OR REPLACE FUNCTION public._sie_fold_text(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(translate(coalesce(p, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'));
$$;

CREATE OR REPLACE FUNCTION public.sie_justificaciones_paginado(p_token text, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_pending boolean := coalesce((p_filtros->>'pending')::boolean, true);
  v_fecha date := nullif(trim(p_filtros->>'date'), '')::date;
  v_nivel text := nullif(trim(p_filtros->>'level'), '');
  v_grado text := nullif(trim(p_filtros->>'grade'), '');
  v_seccion text := nullif(trim(p_filtros->>'section'), '');
  v_search text := nullif(trim(p_filtros->>'search'), '');
  v_limit int := least(greatest(coalesce((p_filtros->>'limit')::int, 10), 1), 200);
  v_offset int := greatest(coalesce((p_filtros->>'offset')::int, 0), 0);
  v_parts text[];
  v_estados text[];
  v_total bigint;
  v_records jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('records', '[]'::jsonb, 'total', 0, 'error', 'Sesión inválida o expirada');
  END IF;
  IF NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('records', '[]'::jsonb, 'total', 0, 'error', 'No autorizado');
  END IF;

  v_estados := CASE WHEN v_pending
    THEN ARRAY['Tarde']
    ELSE ARRAY['Tarde justificada', 'Falta justificada']
  END;

  IF v_search IS NOT NULL THEN
    v_parts := array_remove(regexp_split_to_array(public._sie_fold_text(v_search), '\s+'), '');
  END IF;

  WITH filtered AS (
    SELECT r.id_registro, r.fecha, r.hora_llegada
    FROM public.registros_llegada r
    JOIN public.estudiantes e ON e.id_estudiante = r.id_estudiante
    WHERE r.estado::text = ANY (v_estados)
      AND extract(isodow FROM r.fecha) < 6
      AND (v_fecha IS NULL OR r.fecha = v_fecha)
      AND (v_nivel IS NULL OR e.nivel_educativo::text = v_nivel)
      AND (v_grado IS NULL OR e.grado = v_grado)
      AND (v_seccion IS NULL OR e.seccion = v_seccion)
      AND (
        v_parts IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(v_parts) AS part
          WHERE NOT (
            CASE
              WHEN length(part) = 1 THEN public._sie_fold_text(e.seccion) = part
              ELSE
                public._sie_fold_text(e.nombre_completo) LIKE '%' || part || '%'
                OR public._sie_fold_text(e.codigo_barras) LIKE '%' || part || '%'
                OR public._sie_fold_text(
                  e.nivel_educativo::text || ' ' || e.grado || ' ' || e.seccion || ' ' || e.grado || e.seccion
                ) LIKE '%' || part || '%'
            END
          )
        )
      )
  ),
  page AS (
    SELECT f.id_registro
    FROM filtered f
    ORDER BY f.fecha DESC, f.hora_llegada DESC, f.id_registro DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*) FROM filtered),
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id_registro', r.id_registro,
          'id_estudiante', r.id_estudiante,
          'fecha', r.fecha,
          'hora_llegada', r.hora_llegada,
          'hora_salida', r.hora_salida,
          'tipo_salida', r.tipo_salida,
          'estado', r.estado,
          'fecha_creacion', r.fecha_creacion,
          'registrado_por', r.registrado_por,
          'registrado_salida_por', r.registrado_salida_por,
          'motivo_justificacion', r.motivo_justificacion,
          'justificado_por', r.justificado_por,
          'fecha_justificacion', r.fecha_justificacion,
          'estudiante', jsonb_build_object(
            'id_estudiante', e.id_estudiante,
            'nombre_completo', e.nombre_completo,
            'grado', e.grado,
            'seccion', e.seccion,
            'nivel_educativo', e.nivel_educativo,
            'codigo_barras', e.codigo_barras,
            'foto_perfil', e.foto_perfil,
            'activo', e.activo,
            'telefono_contacto', e.telefono_contacto
          ),
          'usuario', CASE WHEN u.id_usuario IS NULL THEN NULL ELSE
            jsonb_build_object('id_usuario', u.id_usuario, 'nombre_completo', u.nombre_completo)
          END
        )
        ORDER BY r.fecha DESC, r.hora_llegada DESC, r.id_registro DESC
      )
      FROM page p
      JOIN public.registros_llegada r ON r.id_registro = p.id_registro
      JOIN public.estudiantes e ON e.id_estudiante = r.id_estudiante
      LEFT JOIN public.usuarios u ON u.id_usuario = r.registrado_por
    ), '[]'::jsonb)
  INTO v_total, v_records;

  RETURN jsonb_build_object('records', v_records, 'total', v_total, 'error', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_justificaciones_paginado(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sie_justificaciones_paginado(text, jsonb) TO anon, authenticated;
