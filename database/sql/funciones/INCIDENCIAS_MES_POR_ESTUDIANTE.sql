-- Portal público de padres: incidencias de un estudiante en un mes (Lima).
-- Solo campos visibles para el apoderado. Excluye anuladas.
-- GRANT a anon para /portal-padres (consulta por DNI).

CREATE OR REPLACE FUNCTION public.incidencias_mes_por_estudiante(
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
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t."registeredAt" DESC)
    FROM (
      SELECT
        i.id_incidencia AS id,
        i.id_estudiante AS "studentId",
        (i.fecha_hora_registro AT TIME ZONE 'America/Lima')::date::text AS date,
        to_char(i.fecha_hora_registro AT TIME ZONE 'America/Lima', 'YYYY-MM-DD"T"HH24:MI:SS') AS "registeredAt",
        COALESCE(cf.nombre_falta, 'Incidencia registrada') AS "faultName",
        i.estado::text AS status
      FROM public.incidencias i
      LEFT JOIN public.catalogo_faltas cf ON cf.id_falta = i.id_falta
      WHERE i.id_estudiante = p_student_id
        AND (i.fecha_hora_registro AT TIME ZONE 'America/Lima')::date BETWEEN v_start AND v_end
        AND i.estado::text IS DISTINCT FROM 'Anulada'
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.incidencias_mes_por_estudiante(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incidencias_mes_por_estudiante(integer, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.incidencias_mes_por_estudiante(integer, integer, integer) TO authenticated;
