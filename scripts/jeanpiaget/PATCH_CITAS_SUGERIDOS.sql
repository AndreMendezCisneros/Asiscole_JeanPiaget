-- =============================================================================
-- PATCH: sugeridos a citar + alta de cita individual sin duplicados.
-- Idempotente. Aplicar con scripts/jeanpiaget/apply_patch.py
-- Cita "abierta" = Pendiente, Confirmada o Reprogramada con fecha de hoy en adelante (Lima).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_sugeridos_citar(
  p_token text,
  p_min_nivel int DEFAULT 3,
  p_limit int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_dias int;
  v_hoy date := (now() AT TIME ZONE 'America/Lima')::date;
  v_rows jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'error', 'Sesión inválida o expirada');
  END IF;
  IF NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'error', 'No autorizado');
  END IF;

  SELECT coalesce(
    (SELECT cr.ventana_dias FROM public.configuracion_reincidencia cr WHERE cr.activo = true LIMIT 1),
    60
  ) INTO v_dias;

  -- Solo alumnos con incidencias activas en la ventana; el nivel se calcula para ellos, no para toda la nómina.
  WITH cand AS (
    SELECT i.id_estudiante, count(*)::int AS faltas, max(i.fecha_hora_registro) AS ultima
    FROM public.incidencias i
    WHERE i.estado = 'Activa'
      AND i.fecha_hora_registro >= now() - make_interval(days => v_dias)
    GROUP BY i.id_estudiante
  ),
  scored AS (
    SELECT c.*, public.calcular_nivel_reincidencia(c.id_estudiante, now()) AS nivel
    FROM cand c
    JOIN public.estudiantes e ON e.id_estudiante = c.id_estudiante AND e.activo IS TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.citas_padres cp
      WHERE cp.id_estudiante = c.id_estudiante
        AND cp.estado IN ('Pendiente', 'Confirmada', 'Reprogramada')
        AND cp.fecha >= v_hoy
    )
  ),
  picked AS (
    SELECT * FROM scored
    WHERE nivel >= coalesce(p_min_nivel, 3)
    ORDER BY nivel DESC, faltas DESC, ultima DESC
    LIMIT least(greatest(coalesce(p_limit, 15), 1), 50)
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'studentId', e.id_estudiante,
      'fullName', e.nombre_completo,
      'barcode', e.codigo_barras,
      'level', e.nivel_educativo,
      'grade', e.grado,
      'section', e.seccion,
      'reincidenceLevel', p.nivel,
      'faultsInWindow', p.faltas,
      'lastIncidentAt', p.ultima,
      'lastFault', (
        SELECT cf.nombre_falta
        FROM public.incidencias i2
        LEFT JOIN public.catalogo_faltas cf ON cf.id_falta = i2.id_falta
        WHERE i2.id_estudiante = p.id_estudiante AND i2.estado = 'Activa'
        ORDER BY i2.fecha_hora_registro DESC
        LIMIT 1
      )
    )
    ORDER BY p.nivel DESC, p.faltas DESC, p.ultima DESC
  ), '[]'::jsonb)
  INTO v_rows
  FROM picked p
  JOIN public.estudiantes e ON e.id_estudiante = p.id_estudiante;

  RETURN jsonb_build_object('students', v_rows, 'windowDays', v_dias, 'error', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_sugeridos_citar(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sie_sugeridos_citar(text, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sie_crear_cita_individual(
  p_token text,
  p_id_estudiante int,
  p_motivo text,
  p_fecha date,
  p_hora time,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_usuario int;
  v_hoy date := (now() AT TIME ZONE 'America/Lima')::date;
  v_abierta record;
  v_id int;
BEGIN
  SELECT id_usuario, rol INTO v_usuario, v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN
    RETURN jsonb_build_object('id', NULL, 'error', 'Sesión inválida o expirada');
  END IF;
  IF NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('id', NULL, 'error', 'No autorizado');
  END IF;
  IF p_id_estudiante IS NULL OR coalesce(trim(p_motivo), '') = '' OR p_fecha IS NULL OR p_hora IS NULL THEN
    RETURN jsonb_build_object('id', NULL, 'error', 'Faltan datos de la cita');
  END IF;

  -- Serializa altas del mismo alumno: dos coordinadores a la vez no crean dos citas.
  PERFORM pg_advisory_xact_lock(hashtext('sie_cita_individual'), p_id_estudiante);

  SELECT cp.id_cita, cp.fecha, cp.hora, cp.estado INTO v_abierta
  FROM public.citas_padres cp
  WHERE cp.id_estudiante = p_id_estudiante
    AND cp.estado IN ('Pendiente', 'Confirmada', 'Reprogramada')
    AND cp.fecha >= v_hoy
  ORDER BY cp.fecha, cp.hora
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', NULL,
      'duplicate', jsonb_build_object(
        'id', v_abierta.id_cita,
        'fecha', v_abierta.fecha,
        'hora', to_char(v_abierta.hora, 'HH24:MI'),
        'estado', v_abierta.estado
      ),
      'error', format(
        'El alumno ya tiene una cita %s el %s a las %s',
        lower(v_abierta.estado),
        to_char(v_abierta.fecha, 'DD/MM/YYYY'),
        to_char(v_abierta.hora, 'HH24:MI')
      )
    );
  END IF;

  INSERT INTO public.citas_padres (
    id_estudiante, motivo, fecha, hora, id_usuario_creador, estado, notas, asistencia
  ) VALUES (
    p_id_estudiante, trim(p_motivo), p_fecha, p_hora, v_usuario, 'Pendiente', nullif(trim(coalesce(p_notas, '')), ''), NULL
  )
  RETURNING id_cita INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'error', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_crear_cita_individual(text, int, text, date, time, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sie_crear_cita_individual(text, int, text, date, time, text) TO anon, authenticated;
