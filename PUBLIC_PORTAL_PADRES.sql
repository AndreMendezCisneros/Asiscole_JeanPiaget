-- Portal público de padres: consulta por DNI/código de barras sin login.
-- Ejecutar en Supabase SQL Editor.

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
    'status', estado
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
        'status', estado
      )
      ORDER BY fecha DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent
  FROM (
    SELECT id_registro, id_estudiante, fecha, hora_llegada, estado
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
    'recentArrivals', v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_asistencia_por_dni(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_asistencia_por_dni(text) TO anon, authenticated;

-- Mes completo de asistencia (portal público / calendario padres). Sin login.
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
BEGIN
  IF p_student_id IS NULL OR p_year IS NULL OR p_month IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_month < 1 OR p_month > 12 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id_registro,
          'studentId', id_estudiante,
          'date', fecha,
          'arrivalTime', left(hora_llegada::text, 5),
          'status', estado
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

REVOKE ALL ON FUNCTION public.asistencia_mes_por_estudiante(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.asistencia_mes_por_estudiante(integer, integer, integer) TO anon, authenticated;
