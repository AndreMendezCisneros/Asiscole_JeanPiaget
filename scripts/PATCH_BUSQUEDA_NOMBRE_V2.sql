-- PATCH v2: búsqueda tutor — DNI, apellidos múltiples, sin acentos
-- Ejecutar en Supabase → SQL Editor (reemplaza versiones anteriores).

CREATE OR REPLACE FUNCTION public._sie_fold_busqueda(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    translate(
      coalesce(p_texto, ''),
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    )
  );
$$;

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
  digit_q AS (
    SELECT nullif(regexp_replace((SELECT texto FROM q), '\D', '', 'g'), '') AS d
  ),
  tokens AS (
    SELECT unnest(string_to_array((SELECT texto FROM q), ' ')) AS tok
  ),
  tokens_validos AS (
    SELECT tok
    FROM tokens
    WHERE length(tok) >= 2
       OR length(regexp_replace(tok, '\D', '', 'g')) >= 2
  ),
  codigo_digits AS (
    SELECT nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), '') AS d
  ),
  nombre_fold AS (
    SELECT public._sie_fold_busqueda(p_nombre) AS n
  ),
  codigo_fold AS (
    SELECT public._sie_fold_busqueda(p_codigo) AS c
  ),
  query_fold AS (
    SELECT public._sie_fold_busqueda((SELECT texto FROM q)) AS qf
  ),
  phrase_pattern AS (
    SELECT '%' || replace((SELECT texto FROM q), ' ', '%') || '%' AS pat
  )
  SELECT
    (SELECT texto FROM q) IS NOT NULL
    AND (
      coalesce(p_nombre, '') ILIKE (SELECT pat FROM phrase_pattern)
      OR (SELECT c FROM codigo_fold) LIKE '%' || (SELECT qf FROM query_fold) || '%'
      OR (SELECT n FROM nombre_fold) LIKE '%' || (SELECT qf FROM query_fold) || '%'
      OR coalesce(p_codigo, '') ILIKE '%' || (SELECT texto FROM q) || '%'
      OR coalesce(p_nombre, '') ILIKE '%' || (SELECT texto FROM q) || '%'
      OR (
        length(coalesce((SELECT d FROM digit_q), '')) >= 2
        AND coalesce((SELECT d FROM codigo_digits), '') ILIKE '%' || (SELECT d FROM digit_q) || '%'
      )
      OR (
        length(coalesce((SELECT d FROM digit_q), '')) >= 2
        AND ltrim(coalesce((SELECT d FROM codigo_digits), ''), '0')
          ILIKE '%' || ltrim((SELECT d FROM digit_q), '0') || '%'
      )
      OR (
        EXISTS (SELECT 1 FROM tokens_validos)
        AND NOT EXISTS (
          SELECT 1
          FROM tokens_validos tv
          WHERE public._sie_fold_busqueda(p_nombre) NOT LIKE '%' || public._sie_fold_busqueda(tv.tok) || '%'
            AND public._sie_fold_busqueda(p_codigo) NOT LIKE '%' || public._sie_fold_busqueda(tv.tok) || '%'
            AND coalesce((SELECT d FROM codigo_digits), '') NOT ILIKE '%' || regexp_replace(tv.tok, '\D', '', 'g') || '%'
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.sie_buscar_estudiantes_nombre(p_token text, p_query text, p_limit int DEFAULT 20)
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
    v_lim := least(greatest(coalesce(p_limit, 20), 1), 50);
    SELECT coalesce(jsonb_agg(public._sie_student_json_basico(e)), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT e.*
      FROM public.estudiantes e
      WHERE e.activo = true
        AND public._sie_estudiante_coincide_busqueda(e.nombre_completo, e.codigo_barras, v_query)
      ORDER BY
        CASE
          WHEN e.nombre_completo ILIKE '%' || replace(v_query, ' ', '%') || '%' THEN 0
          WHEN public._sie_fold_busqueda(e.nombre_completo)
            LIKE '%' || public._sie_fold_busqueda(v_query) || '%' THEN 1
          ELSE 2
        END,
        (regexp_split_to_array(trim(e.nombre_completo), '\s+'))[
          array_length(regexp_split_to_array(trim(e.nombre_completo), '\s+'), 1)
        ],
        e.grado,
        e.seccion,
        e.nombre_completo
      LIMIT v_lim
    ) e;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  IF public._sie_es_staff(v_rol) THEN
    v_lim := least(greatest(coalesce(p_limit, 20), 1), 50);
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
      ORDER BY
        CASE
          WHEN e.nombre_completo ILIKE '%' || replace(v_query, ' ', '%') || '%' THEN 0
          WHEN public._sie_fold_busqueda(e.nombre_completo)
            LIKE '%' || public._sie_fold_busqueda(v_query) || '%' THEN 1
          ELSE 2
        END,
        (regexp_split_to_array(trim(e.nombre_completo), '\s+'))[
          array_length(regexp_split_to_array(trim(e.nombre_completo), '\s+'), 1)
        ],
        e.grado,
        e.seccion,
        e.nombre_completo
      LIMIT v_lim
    ) e
    LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  RETURN jsonb_build_object('error', 'No autorizado', 'students', '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public._sie_fold_busqueda(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sie_estudiante_coincide_busqueda(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_buscar_estudiantes_nombre(text, text, int) TO anon, authenticated;
