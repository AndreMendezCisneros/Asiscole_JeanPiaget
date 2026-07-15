-- Límites de llegada por nivel (Primaria / Secundaria) — portal padres y consistencia.
-- Ejecutar en Supabase → SQL Editor.

CREATE OR REPLACE FUNCTION public._sie_config_hora(p_clave text, p_default text DEFAULT '08:00')
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT left(
    coalesce(
      (SELECT valor::text FROM public.configuracion_sistema WHERE clave = p_clave LIMIT 1),
      p_default
    ),
    5
  );
$$;

CREATE OR REPLACE FUNCTION public._sie_hora_limite_por_nivel(p_nivel text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_nivel, '')) LIKE '%prim%'
      THEN public._sie_config_hora('hora_limite_llegada_primaria', public._sie_config_hora('hora_limite_llegada', '08:00'))
    WHEN lower(coalesce(p_nivel, '')) LIKE '%sec%'
      THEN public._sie_config_hora('hora_limite_llegada_secundaria', public._sie_config_hora('hora_limite_llegada', '08:00'))
    ELSE public._sie_config_hora('hora_limite_llegada', '08:00')
  END;
$$;

CREATE OR REPLACE FUNCTION public._sie_estado_llegada(p_hora text, p_nivel text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN left(coalesce(p_hora, ''), 5) <= public._sie_hora_limite_por_nivel(p_nivel) THEN 'A tiempo'
    ELSE 'Tarde'
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
    )
  );
$$;

-- Recalcula estado al consultar por DNI (portal padres / WhatsApp).
CREATE OR REPLACE FUNCTION public.buscar_asistencia_por_dni(p_dni text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_today date := (timezone('America/Lima', now()))::date;
  v_since date := v_today - 13;
  v_arrival_today jsonb;
  v_recent jsonb;
BEGIN
  SELECT
    id_estudiante,
    nombre_completo,
    grado,
    seccion,
    nivel_educativo,
    foto_perfil,
    codigo_barras
  INTO v_student
  FROM estudiantes
  WHERE codigo_barras = trim(p_dni)
    AND activo = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'id', id_registro,
    'studentId', id_estudiante,
    'date', fecha,
    'arrivalTime', left(hora_llegada::text, 5),
    'status', public._sie_estado_llegada(hora_llegada::text, v_student.nivel_educativo::text)
  )
  INTO v_arrival_today
  FROM registros_llegada
  WHERE id_estudiante = v_student.id_estudiante
    AND fecha = v_today
  ORDER BY hora_llegada ASC
  LIMIT 1;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id_registro,
        'studentId', id_estudiante,
        'date', fecha,
        'arrivalTime', left(hora_llegada::text, 5),
        'status', public._sie_estado_llegada(hora_llegada::text, v_student.nivel_educativo::text)
      )
      ORDER BY fecha DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent
  FROM (
    SELECT id_registro, id_estudiante, fecha, hora_llegada
    FROM registros_llegada
    WHERE id_estudiante = v_student.id_estudiante
      AND fecha >= v_since
    ORDER BY fecha DESC
    LIMIT 14
  ) r;

  RETURN jsonb_build_object(
    'found', true,
    'student', jsonb_build_object(
      'id', v_student.id_estudiante,
      'fullName', v_student.nombre_completo,
      'grade', v_student.grado,
      'section', v_student.seccion,
      'level', v_student.nivel_educativo,
      'barcode', v_student.codigo_barras,
      'profilePhoto', v_student.foto_perfil,
      'active', true
    ),
    'arrivalToday', v_arrival_today,
    'recentArrivals', v_recent,
    'arrivalLimits', public.limites_llegada_publicos()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.asistencia_mes_por_estudiante(
  p_student_id integer,
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nivel text;
BEGIN
  IF p_student_id IS NULL OR p_year IS NULL OR p_month IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_month < 1 OR p_month > 12 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT nivel_educativo::text INTO v_nivel
  FROM estudiantes
  WHERE id_estudiante = p_student_id
  LIMIT 1;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id_registro,
          'studentId', id_estudiante,
          'date', fecha,
          'arrivalTime', left(hora_llegada::text, 5),
          'status', public._sie_estado_llegada(hora_llegada::text, v_nivel)
        )
        ORDER BY fecha ASC
      )
      FROM registros_llegada
      WHERE id_estudiante = p_student_id
        AND fecha >= make_date(p_year, p_month, 1)
        AND fecha < (make_date(p_year, p_month, 1) + interval '1 month')::date
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.limites_llegada_publicos() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sie_hora_limite_por_nivel(text) TO anon, authenticated;
