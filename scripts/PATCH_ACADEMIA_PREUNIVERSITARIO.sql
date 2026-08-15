-- Academia: nivel Pre-universitario, horario de llegada y búsqueda de nombres.
-- Ejecutar en Supabase SQL Editor de la BD demo academia (no Jean Piaget).
--
-- IMPORTANTE: ALTER TYPE ADD VALUE no puede usarse en la misma transacción
-- que un UPDATE que referencie el valor nuevo (PG < 12; en PG 15 el valor
-- tampoco es visible hasta COMMIT). Si el editor envuelve todo en una
-- transacción, ejecute primero el bloque A, confirme, y luego el resto.

-- =============================================================================
-- A) Enum
-- =============================================================================
ALTER TYPE public.nivel_educativo ADD VALUE IF NOT EXISTS 'Pre-universitario';

-- =============================================================================
-- B) Clave de horario + funciones de llegada
-- =============================================================================
INSERT INTO public.configuracion_sistema (clave, valor, descripcion)
VALUES (
  'hora_limite_llegada_preuniversitario',
  '08:10:00',
  'Hora límite de llegada Pre-universitario (America/Lima)'
)
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public._sie_hora_limite_por_nivel(p_nivel text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN replace(lower(coalesce(p_nivel, '')), '-', '') LIKE '%preuniv%'
      THEN public._sie_config_hora(
        'hora_limite_llegada_preuniversitario',
        public._sie_config_hora('hora_limite_llegada', '08:00')
      )
    WHEN lower(coalesce(p_nivel, '')) LIKE '%prim%'
      THEN public._sie_config_hora(
        'hora_limite_llegada_primaria',
        public._sie_config_hora('hora_limite_llegada', '08:00')
      )
    WHEN lower(coalesce(p_nivel, '')) LIKE '%sec%'
      THEN public._sie_config_hora(
        'hora_limite_llegada_secundaria',
        public._sie_config_hora('hora_limite_llegada', '08:00')
      )
    ELSE public._sie_config_hora('hora_limite_llegada', '08:00')
  END;
$$;

CREATE OR REPLACE FUNCTION public.limites_llegada_publicos()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'general', public._sie_config_hora('hora_limite_llegada', '08:00'),
    'primaria', public._sie_config_hora(
      'hora_limite_llegada_primaria',
      public._sie_config_hora('hora_limite_llegada', '08:00')
    ),
    'secundaria', public._sie_config_hora(
      'hora_limite_llegada_secundaria',
      public._sie_config_hora('hora_limite_llegada', '08:00')
    ),
    'preuniversitario', public._sie_config_hora(
      'hora_limite_llegada_preuniversitario',
      public._sie_config_hora('hora_limite_llegada', '08:00')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.limites_llegada_publicos() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sie_hora_limite_por_nivel(text) TO anon, authenticated;

-- =============================================================================
-- C) Búsqueda por nombre: no coincidir con todos si el token no tiene dígitos
-- =============================================================================
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
            AND (
              length(regexp_replace(tv.tok, '\D', '', 'g')) < 2
              OR coalesce((SELECT d FROM codigo_digits), '')
                NOT ILIKE '%' || regexp_replace(tv.tok, '\D', '', 'g') || '%'
            )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public._sie_estudiante_coincide_busqueda(text, text, text) TO anon, authenticated;

-- =============================================================================
-- D) Recalcular llegadas de HOY con el mapa de niveles correcto
-- =============================================================================
UPDATE public.registros_llegada rl
SET estado = CASE
  WHEN left(rl.hora_llegada::text, 5)::time > (
    COALESCE(
      (
        SELECT left(cs.valor::text, 5)::time
        FROM public.configuracion_sistema cs
        WHERE cs.clave = CASE
          WHEN replace(lower(e.nivel_educativo::text), '-', '') LIKE '%preuniv%'
            THEN 'hora_limite_llegada_preuniversitario'
          WHEN e.nivel_educativo::text ILIKE '%sec%' THEN 'hora_limite_llegada_secundaria'
          WHEN e.nivel_educativo::text ILIKE '%prim%' THEN 'hora_limite_llegada_primaria'
          ELSE 'hora_limite_llegada'
        END
        LIMIT 1
      ),
      (
        SELECT left(cs.valor::text, 5)::time
        FROM public.configuracion_sistema cs
        WHERE cs.clave = 'hora_limite_llegada'
        LIMIT 1
      ),
      '08:00'::time
    )
  ) THEN 'Tarde'
  ELSE 'A tiempo'
END
FROM public.estudiantes e
WHERE e.id_estudiante = rl.id_estudiante
  AND rl.fecha = (timezone('America/Lima', now()))::date;

-- =============================================================================
-- E) Migración opcional de la demo academia
--    Ejecutar en una PASADA POSTERIOR si el ALTER TYPE acaba de correr.
--    Pisos 2001–2010 que hoy figuran como Secundaria → Pre-universitario.
-- =============================================================================
-- UPDATE public.estudiantes
-- SET nivel_educativo = 'Pre-universitario'
-- WHERE activo = true
--   AND nivel_educativo::text = 'Secundaria'
--   AND grado ~ '^200[1-9]$|^2010$';
