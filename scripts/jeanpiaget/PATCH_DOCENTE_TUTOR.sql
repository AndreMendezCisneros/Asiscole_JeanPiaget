-- Jean Piaget: Docente tutor de aula (rol DocenteTutor).
--  * RRHH asigna a un empleado como tutor de UN salón (nivel/grado/sección) y le
--    crea usuario y contraseña. Un salón tiene un solo tutor.
--  * El tutor SOLO LEE, de su salón: llegadas, salidas, incidencias (con
--    evidencias, sin datos de apoderados) y asistencia. Todo por RPC con token:
--    no se agrega ninguna política RLS (DocenteTutor no es staff ni tiene
--    INSERT/UPDATE/DELETE en ninguna tabla).
--  * Al desactivar al empleado se desactiva su usuario y se cierran sus sesiones.
-- Requiere PATCH_DOCENTE_TUTOR_ROL.sql. Idempotente. Solo agrega objetos nuevos:
-- no cambia login, políticas ni funciones existentes.

-- =============================================================================
-- 1) Asignación empleado ↔ salón
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.personal_tutoria (
  id_personal integer PRIMARY KEY REFERENCES public.personal(id_personal) ON DELETE CASCADE,
  id_usuario integer NOT NULL UNIQUE REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  nivel_educativo text NOT NULL,
  grado text NOT NULL,
  seccion text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now()
);

-- Un tutor activo por salón.
CREATE UNIQUE INDEX IF NOT EXISTS personal_tutoria_salon_activo_uq
  ON public.personal_tutoria (nivel_educativo, grado, seccion) WHERE activo;

-- Sin acceso directo desde el cliente: solo las RPC de abajo.
ALTER TABLE public.personal_tutoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_tutoria FROM anon, authenticated;

-- =============================================================================
-- 2) Índices para las consultas por salón (se crean solo si no hay uno equivalente)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'estudiantes'
      AND indexdef ILIKE '%(nivel_educativo, grado, seccion%'
  ) THEN
    CREATE INDEX idx_estudiantes_salon ON public.estudiantes (nivel_educativo, grado, seccion) WHERE activo;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'registros_llegada'
      AND indexdef ILIKE '%(id_estudiante, fecha%'
  ) THEN
    CREATE INDEX idx_llegada_estudiante_fecha ON public.registros_llegada (id_estudiante, fecha);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'incidencias'
      AND indexdef ILIKE '%(id_estudiante, fecha_hora_registro%'
  ) THEN
    CREATE INDEX idx_incidencias_estudiante_fecha ON public.incidencias (id_estudiante, fecha_hora_registro);
  END IF;
END $$;

-- =============================================================================
-- 3) Salón del tutor de la sesión (null si no es DocenteTutor activo)
-- =============================================================================
CREATE OR REPLACE FUNCTION public._sie_tutor_salon(p_token text)
RETURNS TABLE (id_usuario integer, nivel_educativo text, grado text, seccion text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id_usuario, t.nivel_educativo, t.grado, t.seccion
  FROM public._sie_validar_token(p_token) s
  JOIN public.personal_tutoria t ON t.id_usuario = s.id_usuario AND t.activo
  JOIN public.usuarios u ON u.id_usuario = t.id_usuario AND u.activo
  WHERE s.rol = 'DocenteTutor'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._sie_tutor_salon(text) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 4) RPC del tutor (solo lectura)
-- =============================================================================

-- Salón asignado (para el encabezado).
CREATE OR REPLACE FUNCTION public.sie_tutor_mi_salon(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_total int;
BEGIN
  SELECT * INTO v FROM public._sie_tutor_salon(p_token);
  IF v.id_usuario IS NULL THEN
    RETURN jsonb_build_object('error', 'No autorizado o sin salón asignado');
  END IF;
  SELECT count(*) INTO v_total FROM public.estudiantes e
  WHERE e.activo AND e.nivel_educativo::text = v.nivel_educativo
    AND e.grado = v.grado AND e.seccion = v.seccion;
  RETURN jsonb_build_object(
    'error', NULL,
    'salon', jsonb_build_object('level', v.nivel_educativo, 'grade', v.grado, 'section', v.seccion),
    'students', v_total
  );
END;
$$;

-- Llegadas y salidas de un día: cada alumno del salón con su registro (o null).
CREATE OR REPLACE FUNCTION public.sie_tutor_llegadas(p_token text, p_fecha date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_fecha date; v_rows jsonb;
BEGIN
  SELECT * INTO v FROM public._sie_tutor_salon(p_token);
  IF v.id_usuario IS NULL THEN
    RETURN jsonb_build_object('error', 'No autorizado o sin salón asignado', 'students', '[]'::jsonb);
  END IF;
  v_fecha := coalesce(p_fecha, (now() AT TIME ZONE 'America/Lima')::date);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id_estudiante,
    'fullName', e.nombre_completo,
    'photo', e.foto_perfil,
    'arrival', CASE WHEN r.id_registro IS NULL THEN NULL ELSE jsonb_build_object(
      'id', r.id_registro,
      'arrivalTime', r.hora_llegada,
      'departureTime', r.hora_salida,
      'departureType', r.tipo_salida,
      'status', r.estado,
      'justification', r.motivo_justificacion
    ) END
  ) ORDER BY e.nombre_completo), '[]'::jsonb)
  INTO v_rows
  FROM public.estudiantes e
  LEFT JOIN LATERAL (
    SELECT rl.id_registro, rl.hora_llegada, rl.hora_salida, rl.tipo_salida, rl.estado, rl.motivo_justificacion
    FROM public.registros_llegada rl
    WHERE rl.id_estudiante = e.id_estudiante AND rl.fecha = v_fecha
    ORDER BY (rl.hora_llegada IS NOT NULL AND rl.hora_llegada <> '00:00:00'::time) DESC, rl.id_registro DESC
    LIMIT 1
  ) r ON true
  WHERE e.activo AND e.nivel_educativo::text = v.nivel_educativo
    AND e.grado = v.grado AND e.seccion = v.seccion;

  RETURN jsonb_build_object('error', NULL, 'date', v_fecha, 'students', v_rows);
END;
$$;

-- Incidencias del salón (sin datos de apoderados), paginadas.
CREATE OR REPLACE FUNCTION public.sie_tutor_incidencias(
  p_token text,
  p_desde date,
  p_hasta date,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_lim int; v_off int; v_total int; v_rows jsonb;
BEGIN
  SELECT * INTO v FROM public._sie_tutor_salon(p_token);
  IF v.id_usuario IS NULL THEN
    RETURN jsonb_build_object('error', 'No autorizado o sin salón asignado', 'incidents', '[]'::jsonb, 'total', 0);
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde OR p_hasta - p_desde > 400 THEN
    RETURN jsonb_build_object('error', 'Rango de fechas inválido (máximo 400 días)', 'incidents', '[]'::jsonb, 'total', 0);
  END IF;
  v_lim := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_off := greatest(coalesce(p_offset, 0), 0);

  WITH base AS (
    SELECT i.id_incidencia, i.id_estudiante, i.id_falta, i.id_usuario_registro, i.fecha_hora_registro,
           i.observaciones, i.nivel_reincidencia, i.estado, i.cantidad_fotos,
           e.nombre_completo AS estudiante, e.foto_perfil
    FROM public.incidencias i
    JOIN public.estudiantes e ON e.id_estudiante = i.id_estudiante
    WHERE e.nivel_educativo::text = v.nivel_educativo AND e.grado = v.grado AND e.seccion = v.seccion
      AND i.fecha_hora_registro >= (p_desde::timestamp AT TIME ZONE 'America/Lima')
      AND i.fecha_hora_registro < ((p_hasta + 1)::timestamp AT TIME ZONE 'America/Lima')
  ),
  pagina AS (
    SELECT * FROM base ORDER BY fecha_hora_registro DESC, id_incidencia DESC LIMIT v_lim OFFSET v_off
  )
  SELECT
    (SELECT count(*) FROM base),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id_incidencia,
      'studentId', p.id_estudiante,
      'studentName', p.estudiante,
      'studentPhoto', p.foto_perfil,
      'registeredAt', p.fecha_hora_registro,
      'faultName', f.nombre_falta,
      'faultCategory', f.categoria,
      'faultSerious', f.es_grave,
      'observations', p.observaciones,
      'reincidenceLevel', p.nivel_reincidencia,
      'status', p.estado::text,
      'photoCount', coalesce(p.cantidad_fotos, 0),
      'registeredBy', u.nombre_completo
    ) ORDER BY p.fecha_hora_registro DESC, p.id_incidencia DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM pagina p
  LEFT JOIN public.catalogo_faltas f ON f.id_falta = p.id_falta
  LEFT JOIN public.usuarios u ON u.id_usuario = p.id_usuario_registro;

  RETURN jsonb_build_object('error', NULL, 'total', coalesce(v_total, 0), 'incidents', v_rows);
END;
$$;

-- Evidencias de una incidencia del salón (rutas; la URL firmada la arma el cliente).
CREATE OR REPLACE FUNCTION public.sie_tutor_evidencias(p_token text, p_id_incidencia int)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_rows jsonb;
BEGIN
  SELECT * INTO v FROM public._sie_tutor_salon(p_token);
  IF v.id_usuario IS NULL THEN
    RETURN jsonb_build_object('error', 'No autorizado o sin salón asignado', 'evidences', '[]'::jsonb);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.incidencias i
    JOIN public.estudiantes e ON e.id_estudiante = i.id_estudiante
    WHERE i.id_incidencia = p_id_incidencia
      AND e.nivel_educativo::text = v.nivel_educativo AND e.grado = v.grado AND e.seccion = v.seccion
  ) THEN
    RETURN jsonb_build_object('error', 'La incidencia no es de su salón', 'evidences', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', ev.id_evidencia,
    'filename', ev.nombre_original,
    'path', ev.ruta_archivo,
    'uploadedAt', ev.fecha_subida
  ) ORDER BY ev.fecha_subida DESC), '[]'::jsonb)
  INTO v_rows
  FROM public.evidencias_fotograficas ev
  WHERE ev.id_incidencia = p_id_incidencia;

  RETURN jsonb_build_object('error', NULL, 'evidences', v_rows);
END;
$$;

-- Asistencia de un rango (mes o bimestre): alumnos + registros; la planilla la arma el cliente.
CREATE OR REPLACE FUNCTION public.sie_tutor_asistencia(p_token text, p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_students jsonb; v_arrivals jsonb;
BEGIN
  SELECT * INTO v FROM public._sie_tutor_salon(p_token);
  IF v.id_usuario IS NULL THEN
    RETURN jsonb_build_object('error', 'No autorizado o sin salón asignado', 'students', '[]'::jsonb, 'arrivals', '[]'::jsonb);
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde OR p_hasta - p_desde > 100 THEN
    RETURN jsonb_build_object('error', 'Rango de fechas inválido (máximo 100 días)', 'students', '[]'::jsonb, 'arrivals', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id_estudiante, 'fullName', e.nombre_completo, 'photo', e.foto_perfil
  ) ORDER BY e.nombre_completo), '[]'::jsonb)
  INTO v_students
  FROM public.estudiantes e
  WHERE e.activo AND e.nivel_educativo::text = v.nivel_educativo AND e.grado = v.grado AND e.seccion = v.seccion;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id_estudiante', r.id_estudiante,
    'fecha', r.fecha,
    'hora_llegada', r.hora_llegada,
    'hora_salida', r.hora_salida,
    'estado', r.estado,
    'motivo_justificacion', r.motivo_justificacion
  )), '[]'::jsonb)
  INTO v_arrivals
  FROM public.registros_llegada r
  JOIN public.estudiantes e ON e.id_estudiante = r.id_estudiante
  WHERE e.activo AND e.nivel_educativo::text = v.nivel_educativo AND e.grado = v.grado AND e.seccion = v.seccion
    AND r.fecha BETWEEN p_desde AND p_hasta;

  RETURN jsonb_build_object(
    'error', NULL,
    'salon', jsonb_build_object('level', v.nivel_educativo, 'grade', v.grado, 'section', v.seccion),
    'students', v_students,
    'arrivals', v_arrivals
  );
END;
$$;

-- =============================================================================
-- 5) RPC de RRHH: asignar tutores
-- =============================================================================

-- Tutorías existentes + salones reales (de estudiantes activos) con su tutor.
CREATE OR REPLACE FUNCTION public.sie_rrhh_tutorias(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('error', 'No autorizado', 'tutorias', '[]'::jsonb, 'salones', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'error', NULL,
    'tutorias', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'personalId', t.id_personal,
        'userId', t.id_usuario,
        'username', u.username,
        'level', t.nivel_educativo,
        'grade', t.grado,
        'section', t.seccion,
        'active', t.activo AND u.activo,
        'lastAccess', u.ultimo_acceso
      ))
      FROM public.personal_tutoria t
      JOIN public.usuarios u ON u.id_usuario = t.id_usuario
    ), '[]'::jsonb),
    'salones', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'level', s.nivel, 'grade', s.grado, 'section', s.seccion, 'students', s.total
      ) ORDER BY s.nivel, s.grado, s.seccion)
      FROM (
        SELECT e.nivel_educativo::text AS nivel, e.grado, e.seccion, count(*) AS total
        FROM public.estudiantes e
        WHERE e.activo AND e.grado IS NOT NULL AND e.seccion IS NOT NULL
        GROUP BY 1, 2, 3
      ) s
    ), '[]'::jsonb)
  );
END;
$$;

-- Crea o actualiza la tutoría y el usuario DocenteTutor del empleado.
-- p_password: obligatoria al crear; al editar, null/vacía = no cambiar.
CREATE OR REPLACE FUNCTION public.sie_rrhh_guardar_tutor(
  p_token text,
  p_id_personal int,
  p_username text,
  p_password text,
  p_nivel text,
  p_grado text,
  p_seccion text,
  p_activo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_rol text;
  v_uid_rrhh int;
  v_per public.personal%ROWTYPE;
  v_tut public.personal_tutoria%ROWTYPE;
  v_username text := trim(coalesce(p_username, ''));
  v_password text := trim(coalesce(p_password, ''));
  v_nivel text := trim(coalesce(p_nivel, ''));
  v_grado text := trim(coalesce(p_grado, ''));
  v_seccion text := trim(coalesce(p_seccion, ''));
  v_activo boolean := coalesce(p_activo, true);
  v_uid int;
  v_ocupado text;
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_uid_rrhh FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_per FROM public.personal WHERE id_personal = p_id_personal;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empleado no encontrado');
  END IF;
  IF v_activo AND NOT v_per.activo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El empleado está inactivo');
  END IF;
  IF v_username !~ '^[A-Za-z0-9._-]{3,50}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario inválido: 3 a 50 caracteres (letras, números, punto, guion)');
  END IF;
  IF v_password <> '' AND length(v_password) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La contraseña debe tener al menos 6 caracteres');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.estudiantes e
    WHERE e.activo AND e.nivel_educativo::text = v_nivel AND e.grado = v_grado AND e.seccion = v_seccion
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El salón no tiene estudiantes activos');
  END IF;

  IF v_activo THEN
    SELECT p.nombre_completo INTO v_ocupado
    FROM public.personal_tutoria t JOIN public.personal p ON p.id_personal = t.id_personal
    WHERE t.activo AND t.id_personal <> p_id_personal
      AND t.nivel_educativo = v_nivel AND t.grado = v_grado AND t.seccion = v_seccion
    LIMIT 1;
    IF v_ocupado IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ese salón ya tiene tutor: ' || v_ocupado);
    END IF;
  END IF;

  SELECT * INTO v_tut FROM public.personal_tutoria WHERE id_personal = p_id_personal;

  IF EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE lower(username) = lower(v_username) AND id_usuario IS DISTINCT FROM v_tut.id_usuario
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ese usuario ya existe');
  END IF;

  IF v_tut.id_personal IS NULL THEN
    IF v_password = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ingrese una contraseña');
    END IF;
    INSERT INTO public.usuarios (
      username, password_hash, nombre_completo, email, rol, grados_asignados, activo, cambio_password_obligatorio
    ) VALUES (
      v_username,
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      v_per.nombre_completo,
      coalesce(nullif(trim(v_per.email), ''), lower(v_username) || '@tutor.local'),
      'DocenteTutor'::public.rol_usuario,
      jsonb_build_object('classrooms', jsonb_build_array(
        jsonb_build_object('level', v_nivel, 'grade', v_grado, 'section', v_seccion))),
      v_activo,
      false
    ) RETURNING id_usuario INTO v_uid;

    INSERT INTO public.personal_tutoria (id_personal, id_usuario, nivel_educativo, grado, seccion, activo)
    VALUES (p_id_personal, v_uid, v_nivel, v_grado, v_seccion, v_activo);
  ELSE
    v_uid := v_tut.id_usuario;
    -- RRHH solo puede tocar usuarios DocenteTutor.
    IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id_usuario = v_uid AND rol::text = 'DocenteTutor') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'El usuario vinculado no es DocenteTutor');
    END IF;
    UPDATE public.usuarios SET
      username = v_username,
      nombre_completo = v_per.nombre_completo,
      password_hash = CASE WHEN v_password <> ''
        THEN extensions.crypt(v_password, extensions.gen_salt('bf')) ELSE password_hash END,
      grados_asignados = jsonb_build_object('classrooms', jsonb_build_array(
        jsonb_build_object('level', v_nivel, 'grade', v_grado, 'section', v_seccion))),
      activo = v_activo,
      intentos_fallidos = CASE WHEN v_password <> '' THEN 0 ELSE intentos_fallidos END,
      bloqueado_hasta = CASE WHEN v_password <> '' THEN NULL ELSE bloqueado_hasta END
    WHERE id_usuario = v_uid;

    UPDATE public.personal_tutoria SET
      nivel_educativo = v_nivel, grado = v_grado, seccion = v_seccion,
      activo = v_activo, fecha_actualizacion = now()
    WHERE id_personal = p_id_personal;

    -- Cambio de salón, clave o baja: la sesión abierta deja de valer.
    IF NOT v_activo OR v_password <> ''
       OR (v_tut.nivel_educativo, v_tut.grado, v_tut.seccion) IS DISTINCT FROM (v_nivel, v_grado, v_seccion) THEN
      DELETE FROM public.app_sesiones WHERE id_usuario = v_uid;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.auditoria_logs (
      tabla_afectada, accion, datos_anteriores, datos_nuevos, id_registro, id_usuario, fecha_hora, descripcion_accion
    ) VALUES (
      'personal_tutoria',
      CASE WHEN v_tut.id_personal IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
      CASE WHEN v_tut.id_personal IS NULL THEN NULL ELSE to_jsonb(v_tut) END,
      jsonb_build_object('id_personal', p_id_personal, 'id_usuario', v_uid, 'username', v_username,
        'nivel_educativo', v_nivel, 'grado', v_grado, 'seccion', v_seccion, 'activo', v_activo),
      p_id_personal, v_uid_rrhh, now(), 'RRHH asignó docente tutor'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- la auditoría no debe impedir guardar
  END;

  RETURN jsonb_build_object('ok', true, 'error', NULL, 'userId', v_uid);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ese salón ya tiene tutor o el usuario ya existe');
END;
$$;

-- Quita la tutoría y borra el usuario DocenteTutor.
CREATE OR REPLACE FUNCTION public.sie_rrhh_quitar_tutor(p_token text, p_id_personal int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rol text; v_uid int;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  SELECT t.id_usuario INTO v_uid FROM public.personal_tutoria t WHERE t.id_personal = p_id_personal;
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'error', NULL);
  END IF;
  DELETE FROM public.app_sesiones WHERE id_usuario = v_uid;
  DELETE FROM public.personal_tutoria WHERE id_personal = p_id_personal;
  -- Si el usuario tiene historial (FKs), solo se desactiva.
  BEGIN
    DELETE FROM public.usuarios WHERE id_usuario = v_uid AND rol::text = 'DocenteTutor';
  EXCEPTION WHEN foreign_key_violation THEN
    UPDATE public.usuarios SET activo = false WHERE id_usuario = v_uid AND rol::text = 'DocenteTutor';
  END;
  RETURN jsonb_build_object('ok', true, 'error', NULL);
END;
$$;

-- =============================================================================
-- 6) Baja del empleado → baja del tutor (usuario inactivo y sesiones cerradas)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_fn_personal_baja_tutor()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid int;
BEGIN
  IF OLD.activo AND NOT NEW.activo THEN
    SELECT t.id_usuario INTO v_uid FROM public.personal_tutoria t WHERE t.id_personal = NEW.id_personal;
    IF v_uid IS NOT NULL THEN
      UPDATE public.personal_tutoria SET activo = false, fecha_actualizacion = now() WHERE id_personal = NEW.id_personal;
      UPDATE public.usuarios SET activo = false WHERE id_usuario = v_uid AND rol::text = 'DocenteTutor';
      DELETE FROM public.app_sesiones WHERE id_usuario = v_uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_baja_tutor ON public.personal;
CREATE TRIGGER sie_trg_personal_baja_tutor
  AFTER UPDATE OF activo ON public.personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_baja_tutor();

-- =============================================================================
-- 7) Permisos de ejecución
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.sie_tutor_mi_salon(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_tutor_llegadas(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_tutor_incidencias(text, date, date, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_tutor_evidencias(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_tutor_asistencia(text, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_rrhh_tutorias(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_rrhh_guardar_tutor(text, int, text, text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_rrhh_quitar_tutor(text, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
