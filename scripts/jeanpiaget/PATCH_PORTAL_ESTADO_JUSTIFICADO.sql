-- Portal de padres (/llegada/dni/:dni): respetar los estados justificados.
--
-- asistencia_mes_por_estudiante calculaba el estado solo con la hora, sin mirar
-- registros_llegada.estado. Una "Falta justificada" (hora 00:00) salía como
-- "A tiempo" y el front la convertía en "Falta"; una "Tarde justificada" salía
-- como "A tiempo" o "Tarde".
--
-- Antes de aplicar: comparar con la definición vigente en producción
-- (pg_get_functiondef), porque este archivo parte del respaldo de septiembre.

CREATE OR REPLACE FUNCTION public.asistencia_mes_por_estudiante(
  p_student_id integer,
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  FROM public.estudiantes
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
          'status', CASE
            WHEN estado::text IN ('Falta justificada', 'Tarde justificada') THEN estado::text
            ELSE public._sie_estado_llegada(hora_llegada::text, v_nivel)
          END
        )
        ORDER BY fecha ASC
      )
      FROM public.registros_llegada
      WHERE id_estudiante = p_student_id
        AND fecha >= make_date(p_year, p_month, 1)
        AND fecha < (make_date(p_year, p_month, 1) + interval '1 month')::date
    ),
    '[]'::jsonb
  );
END;
$$;
