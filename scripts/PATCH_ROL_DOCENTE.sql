-- PATCH: Rol Docente — sesión, RLS, búsqueda por salones, admin CRUD, evidencias
-- Ejecutar en Supabase SQL Editor antes del deploy frontend.

-- =============================================================================
-- 0) Enum rol_usuario — añadir valor 'Docente' (requerido para INSERT en usuarios)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'rol_usuario'
      AND e.enumlabel = 'Docente'
  ) THEN
    ALTER TYPE public.rol_usuario ADD VALUE 'Docente';
  END IF;
END $$;

-- =============================================================================
-- 1) Sesión 15 min para Docente (login + renovar)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_iniciar_sesion(p_username text, p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_user public.usuarios%ROWTYPE;
  v_token text;
  v_duracion interval;
  v_nuevos_intentos int;
BEGIN
  PERFORM public._sie_limpiar_sesiones_expiradas();
  SELECT * INTO v_user FROM public.usuarios
  WHERE username = trim(p_username) AND activo = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario o contraseña incorrectos');
  END IF;
  IF v_user.bloqueado_hasta IS NOT NULL AND v_user.bloqueado_hasta > now() THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Usuario bloqueado hasta ' || to_char(v_user.bloqueado_hasta AT TIME ZONE 'America/Lima', 'DD/MM/YYYY HH24:MI'));
  END IF;
  IF v_user.intentos_fallidos >= 5 THEN
    UPDATE public.usuarios SET bloqueado_hasta = now() + interval '1 hour' WHERE id_usuario = v_user.id_usuario;
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario bloqueado por múltiples intentos fallidos. Intente más tarde.');
  END IF;
  IF NOT public.validar_password(trim(p_username), p_password) THEN
    v_nuevos_intentos := coalesce(v_user.intentos_fallidos, 0) + 1;
    UPDATE public.usuarios SET intentos_fallidos = v_nuevos_intentos WHERE id_usuario = v_user.id_usuario;
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario o contraseña incorrectos');
  END IF;
  UPDATE public.usuarios SET ultimo_acceso = now(), intentos_fallidos = 0 WHERE id_usuario = v_user.id_usuario;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_duracion := CASE v_user.rol::text
    WHEN 'Tutor' THEN interval '15 minutes'
    WHEN 'Docente' THEN interval '15 minutes'
    WHEN 'Padre' THEN interval '15 minutes'
    ELSE interval '30 minutes' END;
  INSERT INTO public.app_sesiones (token_hash, id_usuario, rol, expires_at)
  VALUES (public._sie_token_hash(v_token), v_user.id_usuario, v_user.rol::text, now() + v_duracion);
  RETURN jsonb_build_object(
    'ok', true, 'token', v_token,
    'expiresInMs', (EXTRACT(EPOCH FROM v_duracion) * 1000)::bigint,
    'user', jsonb_build_object(
      'id', v_user.id_usuario, 'username', v_user.username, 'fullName', v_user.nombre_completo,
      'email', v_user.email, 'role', v_user.rol::text, 'active', v_user.activo,
      'gradosAsignados', v_user.grados_asignados,
      'cambioPasswordObligatorio', v_user.cambio_password_obligatorio
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_renovar_sesion(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_id int; v_duracion interval;
BEGIN
  PERFORM public._sie_limpiar_sesiones_expiradas();
  SELECT s.rol, s.id_usuario INTO v_rol, v_id FROM public._sie_validar_token(p_token) s;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  v_duracion := CASE v_rol
    WHEN 'Tutor' THEN interval '15 minutes'
    WHEN 'Docente' THEN interval '15 minutes'
    WHEN 'Padre' THEN interval '15 minutes'
    ELSE interval '30 minutes' END;
  UPDATE public.app_sesiones SET expires_at = now() + v_duracion
  WHERE token_hash = public._sie_token_hash(trim(p_token));
  RETURN jsonb_build_object('ok', true, 'expiresInMs', (EXTRACT(EPOCH FROM v_duracion) * 1000)::bigint);
END;
$$;

-- =============================================================================
-- 2) Helper: docente ↔ salones asignados
-- =============================================================================

CREATE OR REPLACE FUNCTION public._sie_docente_puede_ver_estudiante(p_id_estudiante integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid int;
  v_classrooms jsonb;
  v_est public.estudiantes%ROWTYPE;
  c jsonb;
BEGIN
  IF public.sie_sesion_rol() IS DISTINCT FROM 'Docente' THEN
    RETURN false;
  END IF;
  v_uid := public.sie_sesion_usuario_id();
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT u.grados_asignados::jsonb INTO v_classrooms
  FROM public.usuarios u WHERE u.id_usuario = v_uid;

  IF v_classrooms IS NULL OR v_classrooms->'classrooms' IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_est FROM public.estudiantes
  WHERE id_estudiante = p_id_estudiante AND activo = true;
  IF NOT FOUND THEN RETURN false; END IF;

  FOR c IN SELECT value FROM jsonb_array_elements(v_classrooms->'classrooms') AS t(value)
  LOOP
    IF v_est.nivel_educativo::text = coalesce(c->>'level', '')
       AND v_est.grado = coalesce(c->>'grade', '')
       AND v_est.seccion = coalesce(c->>'section', '') THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- =============================================================================
-- 3) Búsqueda de estudiantes para Docente
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_buscar_estudiante_carnet(p_token text, p_codigo text, p_skip_reincidencia boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_rol text;
  v_est public.estudiantes%ROWTYPE;
  v_nivel int := 0;
  v_faltas int := 0;
  v_codigo text := trim(p_codigo);
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN RETURN jsonb_build_object('error', 'Sesión inválida o expirada'); END IF;
  IF v_rol NOT IN ('Tutor', 'Docente', 'Admin', 'Director', 'Supervisor') THEN
    RETURN jsonb_build_object('error', 'No autorizado');
  END IF;

  SELECT * INTO v_est FROM public.estudiantes
  WHERE activo = true
    AND (
      codigo_barras = v_codigo
      OR regexp_replace(codigo_barras, '\D', '', 'g') = regexp_replace(v_codigo, '\D', '', 'g')
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('student', null, 'error', 'Estudiante no encontrado');
  END IF;

  IF v_rol = 'Docente' THEN
    IF NOT public._sie_docente_puede_ver_estudiante(v_est.id_estudiante) THEN
      RETURN jsonb_build_object('student', null, 'error', 'El estudiante no pertenece a sus salones asignados');
    END IF;
    IF NOT p_skip_reincidencia THEN
      SELECT coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0) INTO v_nivel, v_faltas
      FROM public.v_estudiantes_nivel_actual n WHERE n.id_estudiante = v_est.id_estudiante;
    END IF;
    RETURN jsonb_build_object('student', public._sie_student_json_completo(v_est, v_nivel, v_faltas), 'error', null);
  END IF;

  IF v_rol = 'Tutor' THEN
    RETURN jsonb_build_object('student', public._sie_student_json_tutor(v_est), 'error', null);
  END IF;

  IF NOT p_skip_reincidencia THEN
    SELECT coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0) INTO v_nivel, v_faltas
    FROM public.v_estudiantes_nivel_actual n WHERE n.id_estudiante = v_est.id_estudiante;
  END IF;
  RETURN jsonb_build_object('student', public._sie_student_json_completo(v_est, v_nivel, v_faltas), 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_buscar_estudiantes_nombre(p_token text, p_query text, p_limit int DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_rol text;
  v_lim int;
  v_result jsonb;
  v_uid int;
  v_classrooms jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN RETURN jsonb_build_object('error', 'Sesión inválida o expirada', 'students', '[]'::jsonb); END IF;
  IF length(trim(coalesce(p_query, ''))) < 2 THEN RETURN jsonb_build_object('students', '[]'::jsonb, 'error', null); END IF;

  IF v_rol = 'Docente' THEN
    v_uid := public.sie_sesion_usuario_id();
    SELECT u.grados_asignados::jsonb INTO v_classrooms FROM public.usuarios u WHERE u.id_usuario = v_uid;
    v_lim := least(greatest(coalesce(p_limit, 12), 1), 12);
    SELECT coalesce(jsonb_agg(public._sie_student_json_completo(e, coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0))), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT e.*
      FROM public.estudiantes e
      WHERE e.activo = true
        AND e.nombre_completo ILIKE '%' || trim(p_query) || '%'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(v_classrooms->'classrooms', '[]'::jsonb)) AS c(value)
          WHERE e.nivel_educativo::text = coalesce(c.value->>'level', '')
            AND e.grado = coalesce(c.value->>'grade', '')
            AND e.seccion = coalesce(c.value->>'section', '')
        )
      ORDER BY e.nombre_completo
      LIMIT v_lim
    ) e
    LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  IF v_rol = 'Tutor' THEN
    v_lim := least(greatest(coalesce(p_limit, 8), 1), 8);
    SELECT coalesce(jsonb_agg(public._sie_student_json_basico(e)), '[]'::jsonb) INTO v_result FROM (
      SELECT * FROM public.estudiantes e WHERE e.activo = true AND e.nombre_completo ILIKE '%' || trim(p_query) || '%'
      ORDER BY e.nombre_completo LIMIT v_lim) e;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  IF public._sie_es_staff(v_rol) THEN
    v_lim := least(greatest(coalesce(p_limit, 10), 1), 50);
    SELECT coalesce(jsonb_agg(public._sie_student_json_completo(e, coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0))), '[]'::jsonb)
    INTO v_result FROM (
      SELECT * FROM public.estudiantes e WHERE e.activo = true AND e.nombre_completo ILIKE '%' || trim(p_query) || '%'
      ORDER BY e.nombre_completo LIMIT v_lim) e
    LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante;
    RETURN jsonb_build_object('students', v_result, 'error', null);
  END IF;

  RETURN jsonb_build_object('error', 'No autorizado', 'students', '[]'::jsonb);
END;
$$;

-- =============================================================================
-- 4) RLS incidencias y evidencias para Docente / Padre
-- =============================================================================

DROP POLICY IF EXISTS sie_incidencias_docente_insert ON public.incidencias;
CREATE POLICY sie_incidencias_docente_insert ON public.incidencias FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Docente' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_incidencias_docente_select ON public.incidencias;
CREATE POLICY sie_incidencias_docente_select ON public.incidencias FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Docente' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_evidencias_docente_insert ON public.evidencias_fotograficas;
CREATE POLICY sie_evidencias_docente_insert ON public.evidencias_fotograficas FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Docente' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_evidencias_padre_select ON public.evidencias_fotograficas;
CREATE POLICY sie_evidencias_padre_select ON public.evidencias_fotograficas FOR SELECT TO anon, authenticated
  USING (
    public.sie_sesion_rol() = 'Padre'
    AND EXISTS (
      SELECT 1 FROM public.incidencias i
      WHERE i.id_incidencia = evidencias_fotograficas.id_incidencia
        AND public.sie_padre_puede_ver_estudiante(i.id_estudiante)
    )
  );

-- =============================================================================
-- 5) RPC insertar_evidencia (crear o actualizar para Docente)
-- =============================================================================

-- PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.insertar_evidencia(integer, text, text, text, integer, text, integer);

CREATE OR REPLACE FUNCTION public.insertar_evidencia(
  p_id_incidencia integer,
  p_ruta_archivo text,
  p_nombre_original text,
  p_nombre_archivo text,
  p_tamano_bytes integer,
  p_tipo_mime text,
  p_id_usuario_subida integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text;
  v_row public.evidencias_fotograficas%ROWTYPE;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(public.sie_request_token()) LIMIT 1;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida o expirada';
  END IF;
  IF v_rol NOT IN ('Admin', 'Director', 'Supervisor', 'Docente') THEN
    RAISE EXCEPTION 'No autorizado para subir evidencia';
  END IF;

  INSERT INTO public.evidencias_fotograficas (
    id_incidencia, ruta_archivo, nombre_original, nombre_archivo,
    tamano_bytes, tipo_mime, id_usuario_subida, fecha_subida, marca_agua_aplicada
  ) VALUES (
    p_id_incidencia, p_ruta_archivo, p_nombre_original, p_nombre_archivo,
    p_tamano_bytes, p_tipo_mime, p_id_usuario_subida, now(), false
  ) RETURNING * INTO v_row;

  UPDATE public.incidencias
  SET estado_evidencia = 'Con evidencia',
      cantidad_fotos = coalesce(cantidad_fotos, 0) + 1,
      id_usuario_carga_foto = p_id_usuario_subida,
      fecha_hora_carga_foto = now()
  WHERE id_incidencia = p_id_incidencia;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.insertar_evidencia(integer, text, text, text, integer, text, integer) TO anon, authenticated;

-- =============================================================================
-- 6) Admin — gestión de docentes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_admin_listar_docentes(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS DISTINCT FROM 'Admin' THEN
    RETURN jsonb_build_object('error', 'No autorizado', 'teachers', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'error', null,
    'teachers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id_usuario,
        'username', u.username,
        'fullName', u.nombre_completo,
        'email', u.email,
        'active', u.activo,
        'classrooms', coalesce(u.grados_asignados->'classrooms', '[]'::jsonb),
        'lastAccess', u.ultimo_acceso,
        'createdAt', u.fecha_creacion
      ) ORDER BY u.nombre_completo)
      FROM public.usuarios u
      WHERE u.rol::text = 'Docente'
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_admin_crear_docente(
  p_token text,
  p_username text,
  p_password text,
  p_full_name text,
  p_email text,
  p_classrooms jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_id int;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS DISTINCT FROM 'Admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  IF length(trim(coalesce(p_username, ''))) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuario inválido');
  END IF;
  IF length(trim(coalesce(p_password, ''))) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La contraseña debe tener al menos 6 caracteres');
  END IF;

  INSERT INTO public.usuarios (
    username, password_hash, nombre_completo, email, rol, grados_asignados, activo, cambio_password_obligatorio
  ) VALUES (
    trim(p_username),
    extensions.crypt(trim(p_password), extensions.gen_salt('bf')),
    trim(p_full_name),
    trim(p_email),
    'Docente'::public.rol_usuario,
    jsonb_build_object('classrooms', coalesce(p_classrooms, '[]'::jsonb)),
    true,
    true
  ) RETURNING id_usuario INTO v_id;

  INSERT INTO public.auditoria_logs (
    tabla_afectada, accion, datos_anteriores, datos_nuevos, id_registro, id_usuario, fecha_hora, descripcion_accion
  ) VALUES (
    'usuarios', 'INSERT', NULL,
    jsonb_build_object('id_usuario', v_id, 'username', trim(p_username), 'rol', 'Docente', 'classrooms', coalesce(p_classrooms, '[]'::jsonb)),
    v_id, public.sie_sesion_usuario_id(), now(), 'Admin creó docente'
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_admin_actualizar_docente(
  p_token text,
  p_id integer,
  p_full_name text,
  p_email text,
  p_classrooms jsonb,
  p_active boolean,
  p_password text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_old jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS DISTINCT FROM 'Admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  SELECT to_jsonb(u) INTO v_old FROM public.usuarios u WHERE u.id_usuario = p_id AND u.rol::text = 'Docente';

  UPDATE public.usuarios SET
    nombre_completo = trim(p_full_name),
    email = trim(p_email),
    grados_asignados = jsonb_build_object('classrooms', coalesce(p_classrooms, '[]'::jsonb)),
    activo = coalesce(p_active, activo),
    password_hash = CASE
      WHEN p_password IS NOT NULL AND length(trim(p_password)) >= 6
      THEN extensions.crypt(trim(p_password), extensions.gen_salt('bf'))
      ELSE password_hash
    END
  WHERE id_usuario = p_id AND rol::text = 'Docente';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Docente no encontrado');
  END IF;

  INSERT INTO public.auditoria_logs (
    tabla_afectada, accion, datos_anteriores, datos_nuevos, id_registro, id_usuario, fecha_hora, descripcion_accion
  ) VALUES (
    'usuarios', 'UPDATE', v_old,
    jsonb_build_object(
      'id_usuario', p_id, 'nombre_completo', trim(p_full_name), 'email', trim(p_email),
      'classrooms', coalesce(p_classrooms, '[]'::jsonb), 'activo', coalesce(p_active, true),
      'password_reset', p_password IS NOT NULL AND length(trim(p_password)) >= 6
    ),
    p_id, public.sie_sesion_usuario_id(), now(), 'Admin actualizó docente'
  );

  RETURN jsonb_build_object('ok', true, 'error', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_admin_listar_docentes(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_admin_crear_docente(text, text, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_admin_actualizar_docente(text, integer, text, text, jsonb, boolean, text) TO anon, authenticated;

-- =============================================================================
-- 7) Docente — listar estudiantes de un salón asignado
-- =============================================================================

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

-- =============================================================================
-- 8) RLS asistencia (llegada/salida) para Docente
-- =============================================================================

DROP POLICY IF EXISTS sie_llegada_docente_insert ON public.registros_llegada;
CREATE POLICY sie_llegada_docente_insert ON public.registros_llegada
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  );

DROP POLICY IF EXISTS sie_llegada_docente_select ON public.registros_llegada;
CREATE POLICY sie_llegada_docente_select ON public.registros_llegada
  FOR SELECT TO anon, authenticated
  USING (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  );

DROP POLICY IF EXISTS sie_llegada_docente_update ON public.registros_llegada;
CREATE POLICY sie_llegada_docente_update ON public.registros_llegada
  FOR UPDATE TO anon, authenticated
  USING (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  )
  WITH CHECK (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  );

NOTIFY pgrst, 'reload schema';
