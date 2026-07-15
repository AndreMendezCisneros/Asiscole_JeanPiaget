-- =============================================================================
-- SIE — RLS completo con sesiones por token (header x-sie-token)
-- Ejecutar en Supabase → SQL Editor (producción), en una sola ejecución.
-- Requisito previo: función validar_password (FUNCION_VALIDAR_PASSWORD_BCRYPT.sql)
-- Tras aplicar: todos deben volver a iniciar sesión.
-- Frontend: supabaseClient envía header x-sie-token automáticamente.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================================================
-- Tabla opcional padres ↔ estudiantes (si no existe, se usa usuarios.grados_asignados)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.padres_estudiantes (
  id_relacion SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  id_estudiante INTEGER NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  parentesco VARCHAR(50) DEFAULT 'Apoderado',
  es_principal BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_usuario, id_estudiante)
);

CREATE INDEX IF NOT EXISTS idx_padres_estudiantes_usuario ON public.padres_estudiantes (id_usuario);
CREATE INDEX IF NOT EXISTS idx_padres_estudiantes_estudiante ON public.padres_estudiantes (id_estudiante);

-- =============================================================================
-- A) Infraestructura de sesiones
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_sesiones (
  id_sesion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  rol text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sesiones_token_hash ON public.app_sesiones(token_hash);
CREATE INDEX IF NOT EXISTS idx_app_sesiones_expires ON public.app_sesiones(expires_at);

CREATE OR REPLACE FUNCTION public._sie_token_hash(p_token text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public._sie_limpiar_sesiones_expiradas()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.app_sesiones WHERE expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public._sie_validar_token(p_token text)
RETURNS TABLE(id_usuario integer, rol text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No limpiar sesiones aquí: las políticas RLS usan transacciones read-only.
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN RETURN; END IF;
  RETURN QUERY
  SELECT s.id_usuario, s.rol
  FROM public.app_sesiones s
  WHERE s.token_hash = public._sie_token_hash(trim(p_token))
    AND s.expires_at > now()
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public._sie_es_staff(p_rol text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_rol IN ('Admin', 'Director', 'Supervisor');
$$;

-- =============================================================================
-- B) Token desde header HTTP (PostgREST / Supabase)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sie_request_token()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nullif(trim(coalesce(
    current_setting('request.headers', true)::json->>'x-sie-token',
    ''
  )), '');
$$;

CREATE OR REPLACE FUNCTION public.sie_sesion_rol()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.rol FROM public._sie_validar_token(public.sie_request_token()) v LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sie_sesion_usuario_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id_usuario FROM public._sie_validar_token(public.sie_request_token()) v LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sie_tiene_sesion()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.sie_sesion_usuario_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.sie_es_staff_sesion()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public._sie_es_staff(public.sie_sesion_rol());
$$;

CREATE OR REPLACE FUNCTION public._sie_ids_desde_grados_asignados(p_grados jsonb)
RETURNS int[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(DISTINCT x.id), ARRAY[]::int[])
  FROM (
    SELECT (jsonb_array_elements_text(
      CASE
        WHEN p_grados IS NULL THEN '[]'::jsonb
        WHEN jsonb_typeof(p_grados) = 'array' THEN p_grados
        WHEN p_grados ? 'studentIds' THEN p_grados->'studentIds'
        WHEN p_grados ? 'estudiantes' THEN p_grados->'estudiantes'
        WHEN p_grados ? 'ids' THEN p_grados->'ids'
        WHEN p_grados ? 'id_estudiantes' THEN p_grados->'id_estudiantes'
        ELSE '[]'::jsonb
      END
    ))::int AS id
  ) x
  WHERE x.id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._sie_ids_estudiantes_padre(p_uid int)
RETURNS int[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids int[];
  v_grados jsonb;
BEGIN
  IF p_uid IS NULL THEN RETURN ARRAY[]::int[]; END IF;

  SELECT u.grados_asignados::jsonb INTO v_grados
  FROM public.usuarios u WHERE u.id_usuario = p_uid;

  v_ids := public._sie_ids_desde_grados_asignados(v_grados);

  IF to_regclass('public.padres_estudiantes') IS NOT NULL THEN
    SELECT coalesce(array_agg(DISTINCT id), ARRAY[]::int[]) INTO v_ids
    FROM (
      SELECT unnest(v_ids) AS id
      UNION
      SELECT pe.id_estudiante FROM public.padres_estudiantes pe WHERE pe.id_usuario = p_uid
    ) q;
  END IF;

  RETURN coalesce(v_ids, ARRAY[]::int[]);
END;
$$;

CREATE OR REPLACE FUNCTION public._sie_padre_puede_ver_estudiante_uid(p_uid int, p_id_estudiante int)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_uid IS NULL THEN RETURN false; END IF;
  RETURN p_id_estudiante = ANY(public._sie_ids_estudiantes_padre(p_uid));
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_padre_puede_ver_estudiante(p_id_estudiante integer)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.sie_sesion_rol() <> 'Padre' THEN RETURN false; END IF;
  RETURN public._sie_padre_puede_ver_estudiante_uid(public.sie_sesion_usuario_id(), p_id_estudiante);
END;
$$;

-- Helpers JSON estudiantes (RPCs)
CREATE OR REPLACE FUNCTION public._sie_student_json_basico(e public.estudiantes)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'id', e.id_estudiante, 'fullName', e.nombre_completo, 'grade', e.grado,
    'section', e.seccion, 'level', e.nivel_educativo, 'barcode', e.codigo_barras,
    'profilePhoto', e.foto_perfil, 'active', e.activo,
    'reincidenceLevel', 0, 'faultsLast60Days', 0
  );
$$;

CREATE OR REPLACE FUNCTION public._sie_student_json_tutor(e public.estudiantes)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT public._sie_student_json_basico(e) || jsonb_build_object(
    'contactPhone', e.telefono_contacto, 'emergencyPhone', e.telefono_emergencia
  );
$$;

CREATE OR REPLACE FUNCTION public._sie_student_json_completo(
  e public.estudiantes, p_nivel int DEFAULT 0, p_faltas bigint DEFAULT 0
)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT public._sie_student_json_basico(e) || jsonb_build_object(
    'reincidenceLevel', coalesce(p_nivel, 0), 'faultsLast60Days', coalesce(p_faltas, 0)::int,
    'contactPhone', e.telefono_contacto, 'contactEmail', e.email_contacto,
    'responsibleName', e.nombre_responsable,
    'responsibleRelationship', e.parentesco_responsable,
    'emergencyPhone', e.telefono_emergencia
  );
$$;

-- Login / logout / renovar (copiado de script anterior — omitir si ya existe)
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
    WHEN 'Tutor' THEN interval '15 minutes' WHEN 'Padre' THEN interval '15 minutes'
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

CREATE OR REPLACE FUNCTION public.sie_cerrar_sesion(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.app_sesiones WHERE token_hash = public._sie_token_hash(trim(p_token));
  PERFORM public._sie_limpiar_sesiones_expiradas();
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_renovar_sesion(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_id int; v_duracion interval;
BEGIN
  PERFORM public._sie_limpiar_sesiones_expiradas();
  SELECT s.rol, s.id_usuario INTO v_rol, v_id FROM public._sie_validar_token(p_token) s;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  v_duracion := CASE v_rol WHEN 'Tutor' THEN interval '15 minutes' WHEN 'Padre' THEN interval '15 minutes'
    ELSE interval '30 minutes' END;
  UPDATE public.app_sesiones SET expires_at = now() + v_duracion
  WHERE token_hash = public._sie_token_hash(trim(p_token));
  RETURN jsonb_build_object('ok', true, 'expiresInMs', (EXTRACT(EPOCH FROM v_duracion) * 1000)::bigint);
END;
$$;

-- RPCs estudiantes (buscar, listar, CRUD) — ver RLS_ESTUDIANTES_SESIONES.sql líneas 252-630
-- Incluidos aquí de forma compacta; si ya los ejecutaste, CREATE OR REPLACE los actualiza.

CREATE OR REPLACE FUNCTION public.sie_buscar_estudiante_carnet(p_token text, p_codigo text, p_skip_reincidencia boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_est public.estudiantes%ROWTYPE; v_nivel int := 0; v_faltas int := 0;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN RETURN jsonb_build_object('error', 'Sesión inválida o expirada'); END IF;
  IF v_rol NOT IN ('Tutor', 'Admin', 'Director', 'Supervisor') THEN RETURN jsonb_build_object('error', 'No autorizado'); END IF;
  SELECT * INTO v_est FROM public.estudiantes WHERE codigo_barras = trim(p_codigo) AND activo = true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('student', null, 'error', 'Estudiante no encontrado'); END IF;
  IF v_rol = 'Tutor' THEN RETURN jsonb_build_object('student', public._sie_student_json_tutor(v_est), 'error', null); END IF;
  IF NOT p_skip_reincidencia THEN
    SELECT coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0) INTO v_nivel, v_faltas
    FROM public.v_estudiantes_nivel_actual n WHERE n.id_estudiante = v_est.id_estudiante;
  END IF;
  RETURN jsonb_build_object('student', public._sie_student_json_completo(v_est, v_nivel, v_faltas), 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_buscar_estudiantes_nombre(p_token text, p_query text, p_limit int DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_lim int; v_result jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN RETURN jsonb_build_object('error', 'Sesión inválida o expirada', 'students', '[]'::jsonb); END IF;
  IF length(trim(coalesce(p_query, ''))) < 2 THEN RETURN jsonb_build_object('students', '[]'::jsonb, 'error', null); END IF;
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

CREATE OR REPLACE FUNCTION public.sie_lista_estudiantes(p_token text, p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_rol text; v_busqueda text := nullif(trim(p_filtros->>'search'), '');
  v_grado text := nullif(trim(p_filtros->>'grade'), ''); v_seccion text := nullif(trim(p_filtros->>'section'), '');
  v_nivel text := nullif(trim(p_filtros->>'level'), '');
  v_activo boolean := CASE WHEN p_filtros ? 'active' THEN (p_filtros->>'active')::boolean ELSE null END;
  v_ids int[]; v_result jsonb;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN RETURN jsonb_build_object('error', 'Sesión inválida o expirada', 'students', '[]'::jsonb); END IF;
  IF NOT public._sie_es_staff(v_rol) THEN RETURN jsonb_build_object('error', 'No autorizado', 'students', '[]'::jsonb); END IF;
  IF v_busqueda IS NOT NULL THEN
    SELECT array_agg(DISTINCT id_estudiante) INTO v_ids FROM (
      SELECT id_estudiante FROM public.estudiantes WHERE nombre_completo ILIKE '%' || v_busqueda || '%'
      UNION SELECT id_estudiante FROM public.estudiantes WHERE codigo_barras ILIKE '%' || v_busqueda || '%') q;
    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN RETURN jsonb_build_object('students', '[]'::jsonb, 'error', null); END IF;
  END IF;
  SELECT coalesce(jsonb_agg(public._sie_student_json_completo(e, coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0)) ORDER BY e.nombre_completo), '[]'::jsonb)
  INTO v_result FROM public.estudiantes e
  LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante
  WHERE (v_ids IS NULL OR e.id_estudiante = ANY(v_ids))
    AND (v_grado IS NULL OR e.grado = v_grado) AND (v_seccion IS NULL OR e.seccion = v_seccion)
    AND (v_nivel IS NULL OR e.nivel_educativo::text = v_nivel) AND (v_activo IS NULL OR e.activo = v_activo);
  RETURN jsonb_build_object('students', v_result, 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_estudiante_por_id(p_token text, p_id int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_uid int; v_est public.estudiantes%ROWTYPE; v_nivel int := 0; v_faltas int := 0; v_linked boolean;
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_uid FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL THEN RETURN jsonb_build_object('error', 'Sesión inválida o expirada'); END IF;
  IF v_rol = 'Padre' THEN
    IF NOT public._sie_padre_puede_ver_estudiante_uid(v_uid, p_id) THEN
      RETURN jsonb_build_object('error', 'No autorizado', 'student', null);
    END IF;
  ELSIF NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('error', 'No autorizado', 'student', null);
  END IF;
  SELECT * INTO v_est FROM public.estudiantes WHERE id_estudiante = p_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('student', null, 'error', 'Estudiante no encontrado'); END IF;
  SELECT coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0) INTO v_nivel, v_faltas
  FROM public.v_estudiantes_nivel_actual n WHERE n.id_estudiante = p_id;
  RETURN jsonb_build_object('student', public._sie_student_json_completo(v_est, v_nivel, v_faltas), 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_padre_mis_estudiantes(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_uid int; v_result jsonb; v_ids int[];
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_uid FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'Padre' THEN RETURN jsonb_build_object('error', 'No autorizado', 'students', '[]'::jsonb); END IF;

  v_ids := public._sie_ids_estudiantes_padre(v_uid);
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'error', null);
  END IF;

  SELECT coalesce(jsonb_agg(public._sie_student_json_completo(e, coalesce(n.nivel_actual, 0), coalesce(n.total_faltas_60_dias, 0)) ORDER BY e.nombre_completo), '[]'::jsonb)
  INTO v_result FROM public.estudiantes e
  LEFT JOIN public.v_estudiantes_nivel_actual n ON n.id_estudiante = e.id_estudiante
  WHERE e.activo = true AND e.id_estudiante = ANY(v_ids);

  RETURN jsonb_build_object('students', v_result, 'error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_crear_estudiante(p_token text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text; v_row public.estudiantes%ROWTYPE;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR NOT public._sie_es_staff(v_rol) THEN RETURN jsonb_build_object('error', 'No autorizado'); END IF;
  INSERT INTO public.estudiantes (codigo_barras, nombre_completo, grado, seccion, nivel_educativo, foto_perfil,
    telefono_contacto, email_contacto, nombre_responsable, parentesco_responsable, telefono_emergencia)
  VALUES (p_payload->>'codigo_barras', p_payload->>'nombre_completo', p_payload->>'grado', p_payload->>'seccion',
    nullif(p_payload->>'nivel_educativo', ''), nullif(p_payload->>'foto_perfil', ''),
    nullif(p_payload->>'telefono_contacto', ''), nullif(p_payload->>'email_contacto', ''),
    nullif(p_payload->>'nombre_responsable', ''), nullif(p_payload->>'parentesco_responsable', ''),
    nullif(p_payload->>'telefono_emergencia', '')) RETURNING * INTO v_row;
  RETURN jsonb_build_object('student', public._sie_student_json_completo(v_row, 0, 0), 'error', null);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_actualizar_estudiante(p_token text, p_id int, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR NOT public._sie_es_staff(v_rol) THEN RETURN jsonb_build_object('ok', false, 'error', 'No autorizado'); END IF;
  UPDATE public.estudiantes SET
    nombre_completo = coalesce(p_payload->>'nombre_completo', nombre_completo),
    grado = coalesce(p_payload->>'grado', grado), seccion = coalesce(p_payload->>'seccion', seccion),
    nivel_educativo = coalesce(nullif(p_payload->>'nivel_educativo', ''), nivel_educativo),
    foto_perfil = CASE WHEN p_payload ? 'foto_perfil' THEN nullif(p_payload->>'foto_perfil', '') ELSE foto_perfil END,
    activo = coalesce((p_payload->>'activo')::boolean, activo),
    telefono_contacto = CASE WHEN p_payload ? 'telefono_contacto' THEN nullif(p_payload->>'telefono_contacto', '') ELSE telefono_contacto END,
    email_contacto = CASE WHEN p_payload ? 'email_contacto' THEN nullif(p_payload->>'email_contacto', '') ELSE email_contacto END,
    nombre_responsable = CASE WHEN p_payload ? 'nombre_responsable' THEN nullif(p_payload->>'nombre_responsable', '') ELSE nombre_responsable END,
    parentesco_responsable = CASE WHEN p_payload ? 'parentesco_responsable' THEN nullif(p_payload->>'parentesco_responsable', '') ELSE parentesco_responsable END,
    telefono_emergencia = CASE WHEN p_payload ? 'telefono_emergencia' THEN nullif(p_payload->>'telefono_emergencia', '') ELSE telefono_emergencia END
  WHERE id_estudiante = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Estudiante no encontrado'); END IF;
  RETURN jsonb_build_object('ok', true, 'error', null);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Contraseña sin acceso directo a usuarios
CREATE OR REPLACE FUNCTION public.sie_solicitar_reset_password(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user public.usuarios%ROWTYPE; v_token text; v_hash text;
BEGIN
  SELECT * INTO v_user FROM public.usuarios WHERE email = trim(p_email) AND activo = true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true); END IF;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  INSERT INTO public.tokens_recuperacion (id_usuario, token_hash, fecha_expiracion)
  VALUES (v_user.id_usuario, v_hash, now() + interval '24 hours');
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_cambiar_password(p_token text, p_new_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_uid int;
BEGIN
  SELECT id_usuario INTO v_uid FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sesión inválida'); END IF;
  IF length(trim(p_new_password)) < 6 THEN RETURN jsonb_build_object('ok', false, 'error', 'Contraseña muy corta'); END IF;
  UPDATE public.usuarios SET password_hash = extensions.crypt(trim(p_new_password), extensions.gen_salt('bf')),
    cambio_password_obligatorio = false WHERE id_usuario = v_uid;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- =============================================================================
-- C) Activar RLS en todas las tablas del sistema
-- =============================================================================

ALTER TABLE IF EXISTS public.app_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registros_llegada ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalogo_faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.citas_padres ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracion_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.configuracion_reincidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auditoria_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comentarios_incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evidencias_fotograficas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tokens_recuperacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.padres_estudiantes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- D) Eliminar políticas antiguas (idempotente)
-- =============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'app_sesiones','usuarios','estudiantes','incidencias','registros_llegada',
        'catalogo_faltas','citas_padres','configuracion_sistema','configuracion_reincidencia',
        'auditoria_logs','comentarios_incidencias','evidencias_fotograficas',
        'tokens_recuperacion','padres_estudiantes'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- E) Políticas RLS por tabla (rol anon + header x-sie-token)
-- =============================================================================

-- app_sesiones: sin acceso directo
-- tokens_recuperacion: sin acceso directo

-- usuarios
CREATE POLICY sie_usuarios_staff_all ON public.usuarios FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_usuarios_self_select ON public.usuarios FOR SELECT TO anon, authenticated
  USING (id_usuario = public.sie_sesion_usuario_id() AND public.sie_tiene_sesion());

-- estudiantes: staff ve todo; padre solo hijos; tutor NO listado directo (usa RPC)
CREATE POLICY sie_estudiantes_staff_select ON public.estudiantes FOR SELECT TO anon, authenticated
  USING (public.sie_es_staff_sesion());

CREATE POLICY sie_estudiantes_staff_write ON public.estudiantes FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_estudiantes_staff_update ON public.estudiantes FOR UPDATE TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_estudiantes_padre_select ON public.estudiantes FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Padre' AND public.sie_padre_puede_ver_estudiante(id_estudiante));

-- incidencias
CREATE POLICY sie_incidencias_staff_all ON public.incidencias FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_incidencias_padre_select ON public.incidencias FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Padre' AND public.sie_padre_puede_ver_estudiante(id_estudiante));

CREATE POLICY sie_incidencias_tutor_insert ON public.incidencias FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

CREATE POLICY sie_incidencias_tutor_select ON public.incidencias FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

-- registros_llegada
CREATE POLICY sie_llegada_staff_all ON public.registros_llegada FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_llegada_tutor_insert ON public.registros_llegada FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

CREATE POLICY sie_llegada_tutor_select ON public.registros_llegada FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

CREATE POLICY sie_llegada_padre_select ON public.registros_llegada FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Padre' AND public.sie_padre_puede_ver_estudiante(id_estudiante));

-- catalogo_faltas
CREATE POLICY sie_faltas_select ON public.catalogo_faltas FOR SELECT TO anon, authenticated
  USING (public.sie_tiene_sesion());

CREATE POLICY sie_faltas_staff_write ON public.catalogo_faltas FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

-- citas_padres
CREATE POLICY sie_citas_staff_all ON public.citas_padres FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_citas_tutor_rw ON public.citas_padres FOR ALL TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion())
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

CREATE POLICY sie_citas_padre_select ON public.citas_padres FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Padre' AND public.sie_padre_puede_ver_estudiante(id_estudiante));

-- configuracion_sistema
CREATE POLICY sie_config_select ON public.configuracion_sistema FOR SELECT TO anon, authenticated
  USING (public.sie_tiene_sesion());

CREATE POLICY sie_config_staff_write ON public.configuracion_sistema FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

-- configuracion_reincidencia
CREATE POLICY sie_reincidencia_select ON public.configuracion_reincidencia FOR SELECT TO anon, authenticated
  USING (public.sie_tiene_sesion());

CREATE POLICY sie_reincidencia_staff_write ON public.configuracion_reincidencia FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

-- auditoria_logs: solo staff lectura (INSERT solo vía triggers SECURITY DEFINER)
CREATE POLICY sie_auditoria_staff_select ON public.auditoria_logs FOR SELECT TO anon, authenticated
  USING (public.sie_es_staff_sesion());
-- NO añadir política INSERT para anon/authenticated: evita logs falsos desde el cliente.
-- Los triggers fn_sie_auditoria_* deben ser SECURITY DEFINER (ver scripts/PATCH_AUDITORIA_RLS.sql).

-- comentarios_incidencias
CREATE POLICY sie_comentarios_staff_all ON public.comentarios_incidencias FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_comentarios_padre_select ON public.comentarios_incidencias FOR SELECT TO anon, authenticated
  USING (
    public.sie_sesion_rol() = 'Padre'
    AND EXISTS (
      SELECT 1 FROM public.incidencias i
      WHERE i.id_incidencia = comentarios_incidencias.id_incidencia
        AND public.sie_padre_puede_ver_estudiante(i.id_estudiante)
    )
  );

-- evidencias_fotograficas
CREATE POLICY sie_evidencias_staff_all ON public.evidencias_fotograficas FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

-- padres_estudiantes (creada arriba con IF NOT EXISTS)
CREATE POLICY sie_padres_est_staff_all ON public.padres_estudiantes FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion());

CREATE POLICY sie_padres_est_padre_select ON public.padres_estudiantes FOR SELECT TO anon, authenticated
  USING (id_usuario = public.sie_sesion_usuario_id() AND public.sie_sesion_rol() = 'Padre');

-- =============================================================================
-- F) Permisos GRANT (RLS filtra filas; sin GRANT no hay acceso)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.estudiantes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidencias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_llegada TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_faltas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citas_padres TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracion_sistema TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracion_reincidencia TO anon, authenticated;
GRANT SELECT ON public.auditoria_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios_incidencias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidencias_fotograficas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.padres_estudiantes TO anon, authenticated;

-- Vistas (solo si existen en tu proyecto)
DO $$
BEGIN
  IF to_regclass('public.v_dashboard_ejecutivo') IS NOT NULL THEN
    GRANT SELECT ON public.v_dashboard_ejecutivo TO anon, authenticated;
  END IF;
  IF to_regclass('public.v_estudiantes_nivel_actual') IS NOT NULL THEN
    GRANT SELECT ON public.v_estudiantes_nivel_actual TO anon, authenticated;
  END IF;
END $$;

-- Sin GRANT en app_sesiones ni tokens_recuperacion para anon

-- =============================================================================
-- G) RPC públicas
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.sie_iniciar_sesion(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_cerrar_sesion(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_renovar_sesion(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_buscar_estudiante_carnet(text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_buscar_estudiantes_nombre(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_lista_estudiantes(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_estudiante_por_id(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_crear_estudiante(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_actualizar_estudiante(text, int, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_padre_mis_estudiantes(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_solicitar_reset_password(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_cambiar_password(text, text) TO anon, authenticated;

-- Portal público DNI (sin sesión) — ejecutar PUBLIC_PORTAL_PADRES.sql si aún no existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'buscar_asistencia_por_dni'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.buscar_asistencia_por_dni(text) TO anon, authenticated;
  END IF;
END $$;

-- validar_password solo vía sie_iniciar_sesion; opcional revocar acceso directo:
-- REVOKE EXECUTE ON FUNCTION public.validar_password(text, text) FROM anon, authenticated;

-- =============================================================================
-- H) Vincular padre de prueba (portal familiar)
-- Ajuste username e IDs según su colegio. Ejemplo del proyecto: padre.humani → 32 y 31
-- =============================================================================

UPDATE public.usuarios
SET grados_asignados = '{"studentIds": [32, 31]}'::jsonb
WHERE username = 'padre.humani';

-- Verificación rápida (debe devolver filas tras el UPDATE)
SELECT u.id_usuario, u.username, u.rol, u.grados_asignados
FROM public.usuarios u
WHERE u.username = 'padre.humani';

SELECT e.id_estudiante, e.codigo_barras, e.nombre_completo, e.grado, e.seccion
FROM public.usuarios u
CROSS JOIN LATERAL jsonb_array_elements_text(u.grados_asignados -> 'studentIds') AS sid(val)
JOIN public.estudiantes e ON e.id_estudiante = (sid.val)::integer
WHERE u.username = 'padre.humani'
ORDER BY e.id_estudiante;

-- Comprobar que anon ya no puede listar estudiantes sin sesión (debe fallar o devolver 0 filas vía API)
-- SELECT count(*) FROM public.estudiantes;
