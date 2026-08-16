-- =============================================================================
-- 08_NOTAS_POR_ESTUDIANTE.sql — Historial de notas para padre / app
-- Idempotente. Ejecutar en la BD de Asis Academy (después de 05_NOTAS_AREAS.sql).
-- No aplicar en Jean Piaget ni San Ramón.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_notas_por_estudiante(
  p_id_estudiante int,
  p_limit int DEFAULT 52
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_limit int := greatest(least(coalesce(p_limit, 52), 200), 1);
BEGIN
  IF NOT public.sie_tiene_sesion() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin sesión');
  END IF;

  IF p_id_estudiante IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Falta estudiante');
  END IF;

  v_rol := public.sie_sesion_rol();
  IF v_rol = 'Padre' THEN
    IF NOT public.sie_padre_puede_ver_estudiante(p_id_estudiante) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
    END IF;
  ELSIF NOT public.sie_es_staff_sesion() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notas', coalesce((
      SELECT jsonb_agg(row_json ORDER BY (row_json->>'fechaInicio') DESC, (row_json->>'id')::bigint DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', r.id,
          'idEstudiante', r.id_estudiante,
          'semanaId', r.semana_id,
          'semanaCodigo', s.codigo,
          'semanaEtiqueta', s.etiqueta,
          'fechaInicio', s.fecha_inicio,
          'fechaFin', s.fecha_fin,
          'nota', r.nota,
          'notaMaxima', 20,
          'areaId', r.area_id,
          'areaCodigo', a.codigo,
          'areaNombre', a.nombre,
          'carreraId', r.carrera_id,
          'carreraNombre', c.nombre,
          'registradoEn', r.registrado_en,
          'puestoArea', r.puesto_area
        ) AS row_json
        FROM (
          SELECT
            n.id,
            n.id_estudiante,
            n.semana_id,
            n.area_id,
            n.carrera_id,
            n.nota,
            n.registrado_en,
            rank() OVER (
              PARTITION BY n.semana_id, n.area_id
              ORDER BY n.nota DESC, n.id
            ) AS puesto_area
          FROM public.notas_semana n
          WHERE n.semana_id IN (
            SELECT n2.semana_id
            FROM public.notas_semana n2
            WHERE n2.id_estudiante = p_id_estudiante
          )
        ) r
        JOIN public.notas_semanas s ON s.id = r.semana_id
        JOIN public.notas_areas a ON a.id = r.area_id
        LEFT JOIN public.notas_carreras c ON c.id = r.carrera_id
        WHERE r.id_estudiante = p_id_estudiante
        ORDER BY s.fecha_inicio DESC, r.id DESC
        LIMIT v_limit
      ) q
    ), '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.sie_notas_por_estudiante(int, int) IS
  'Historial de notas semanales de un alumno. Padre (hijo vinculado) o staff. Para la sección Notas de la app.';

GRANT EXECUTE ON FUNCTION public.sie_notas_por_estudiante(int, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
