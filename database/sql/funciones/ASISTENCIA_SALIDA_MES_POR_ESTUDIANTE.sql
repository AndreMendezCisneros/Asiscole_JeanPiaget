-- Portal público: hora de salida del mes (anon no puede leer registros_llegada por RLS).
-- Complementa asistencia_mes_por_estudiante, que hoy no expone hora_salida.

CREATE OR REPLACE FUNCTION public.asistencia_salida_mes_por_estudiante(
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
  v_start date;
  v_end date;
BEGIN
  IF p_student_id IS NULL OR p_year IS NULL OR p_month IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RETURN '[]'::jsonb;
  END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.date DESC)
    FROM (
      SELECT
        r.id_registro AS id,
        r.fecha::text AS date,
        CASE
          WHEN r.hora_salida IS NULL THEN NULL
          ELSE left(r.hora_salida::text, 5)
        END AS "departureTime",
        r.tipo_salida::text AS "departureType"
      FROM public.registros_llegada r
      WHERE r.id_estudiante = p_student_id
        AND r.fecha BETWEEN v_start AND v_end
        AND r.hora_salida IS NOT NULL
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.asistencia_salida_mes_por_estudiante(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.asistencia_salida_mes_por_estudiante(integer, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.asistencia_salida_mes_por_estudiante(integer, integer, integer) TO authenticated;
