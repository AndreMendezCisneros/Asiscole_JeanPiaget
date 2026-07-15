-- Ejecutar en Supabase SQL Editor si al abrir un salón aparece:
-- "Could not find the function public.sie_docente_listar_estudiantes_salon ..."

CREATE OR REPLACE FUNCTION public.sie_docente_listar_estudiantes_salon(
  p_token text,
  p_level text,
  p_grade text,
  p_section text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_rol text;
  v_uid int;
  v_classrooms jsonb;
  v_allowed boolean := false;
  c jsonb;
  v_result jsonb;
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_uid FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('error', 'Sesión inválida o expirada', 'students', '[]'::jsonb);
  END IF;
  IF v_rol IS DISTINCT FROM 'Docente' THEN
    RETURN jsonb_build_object('error', 'No autorizado', 'students', '[]'::jsonb);
  END IF;

  SELECT u.grados_asignados::jsonb INTO v_classrooms FROM public.usuarios u WHERE u.id_usuario = v_uid;

  FOR c IN SELECT value FROM jsonb_array_elements(coalesce(v_classrooms->'classrooms', '[]'::jsonb)) AS t(value)
  LOOP
    IF trim(p_level) = coalesce(c->>'level', '')
       AND trim(p_grade) = coalesce(c->>'grade', '')
       AND trim(p_section) = coalesce(c->>'section', '') THEN
      v_allowed := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'Salón no asignado a este docente', 'students', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(
    public._sie_student_json_completo(e, coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0))
    ORDER BY e.nombre_completo
  ), '[]'::jsonb)
  INTO v_result
  FROM public.estudiantes e
  LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante
  WHERE e.activo = true
    AND e.nivel_educativo::text = trim(p_level)
    AND e.grado = trim(p_grade)
    AND e.seccion = trim(p_section);

  RETURN jsonb_build_object('students', v_result, 'error', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_docente_listar_estudiantes_salon(text, text, text, text) TO anon, authenticated;

-- Refrescar caché de PostgREST para que el RPC quede disponible de inmediato
NOTIFY pgrst, 'reload schema';
