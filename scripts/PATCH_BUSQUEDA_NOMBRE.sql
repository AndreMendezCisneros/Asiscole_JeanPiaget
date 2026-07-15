-- PATCH: búsqueda por nombre en escáner tutor (y resto del sistema)
-- Ejecutar en Supabase → SQL Editor.
--
-- Mejoras:
-- 1) Cada palabra del texto cuenta (ej. "mendez andre" encuentra "Andre Mendez Cisneros")
-- 2) También busca por código de barras / DNI
-- 3) Tutor puede cargar estudiante por ID (sie_estudiante_por_id)

CREATE OR REPLACE FUNCTION public._sie_estudiante_coincide_busqueda(
  p_nombre text,
  p_codigo text,
  p_query text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  WITH q AS (
    SELECT nullif(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), '') AS texto
  ),
  tokens AS (
    SELECT unnest(string_to_array((SELECT texto FROM q), ' ')) AS tok
  ),
  tokens_validos AS (
    SELECT tok FROM tokens WHERE length(tok) >= 1
  )
  SELECT
    (SELECT texto FROM q) IS NOT NULL
    AND (
      coalesce(p_codigo, '') ILIKE '%' || (SELECT texto FROM q) || '%'
      OR coalesce(p_nombre, '') ILIKE '%' || (SELECT texto FROM q) || '%'
      OR (
        EXISTS (SELECT 1 FROM tokens_validos)
        AND NOT EXISTS (
          SELECT 1
          FROM tokens_validos tv
          WHERE coalesce(p_nombre, '') NOT ILIKE '%' || tv.tok || '%'
            AND coalesce(p_codigo, '') NOT ILIKE '%' || tv.tok || '%'
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.sie_buscar_estudiantes_nombre(p_token text, p_query text, p_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rol text;
  v_lim int;
  v_result jsonb;
  v_query text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'Sesión inválida o expirada', 'students', '[]'::jsonb);
  END IF;

  v_query := trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  IF length(v_query) < 2 THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'error', null);
  END IF;

  IF v_rol = 'Tutor' THEN
    v_lim := least(greatest(coalesce(p_limit, 8), 1), 30);
    SELECT coalesce(jsonb_agg(public._sie_student_json_basico(e)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT e.*
      FROM public.estudiantes e
      WHERE e.activo = true
        AND public._sie_estudiante_coincide_busqueda(e.nombre_completo, e.codigo_barras, v_query)
      ORDER BY e.nombre_completo
      LIMIT v_lim
    ) e;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  IF public._sie_es_staff(v_rol) THEN
    v_lim := least(greatest(coalesce(p_limit, 10), 1), 50);
    SELECT coalesce(
      jsonb_agg(
        public._sie_student_json_completo(
          e,
          coalesce(n.nivel_actual, 0),
          coalesce(n.total_faltas_60_dias, 0)
        )
      ),
      '[]'::jsonb
    )
    INTO v_result
    FROM (
      SELECT e.*
      FROM public.estudiantes e
      WHERE e.activo = true
        AND public._sie_estudiante_coincide_busqueda(e.nombre_completo, e.codigo_barras, v_query)
      ORDER BY e.nombre_completo
      LIMIT v_lim
    ) e
    LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  RETURN jsonb_build_object('error', 'No autorizado', 'students', '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_estudiante_por_id(p_token text, p_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rol text;
  v_uid int;
  v_est public.estudiantes%ROWTYPE;
  v_nivel int := 0;
  v_faltas int := 0;
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_uid FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'Sesión inválida o expirada');
  END IF;

  IF v_rol = 'Padre' THEN
    IF NOT public._sie_padre_puede_ver_estudiante_uid(v_uid, p_id) THEN
      RETURN jsonb_build_object('error', 'No autorizado', 'student', null);
    END IF;
  ELSIF v_rol NOT IN ('Tutor', 'Admin', 'Director', 'Supervisor') THEN
    RETURN jsonb_build_object('error', 'No autorizado', 'student', null);
  END IF;

  SELECT * INTO v_est FROM public.estudiantes WHERE id_estudiante = p_id AND activo = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('student', null, 'error', 'Estudiante no encontrado');
  END IF;

  IF v_rol = 'Tutor' THEN
    RETURN jsonb_build_object('student', public._sie_student_json_tutor(v_est), 'error', null);
  END IF;

  SELECT coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0)
  INTO v_nivel, v_faltas
  FROM public.v_estudiantes_nivel_actual n
  WHERE n.id_estudiante = p_id;

  RETURN jsonb_build_object(
    'student',
    public._sie_student_json_completo(v_est, v_nivel, v_faltas),
    'error',
    null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._sie_estudiante_coincide_busqueda(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_buscar_estudiantes_nombre(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_estudiante_por_id(text, int) TO anon, authenticated;
