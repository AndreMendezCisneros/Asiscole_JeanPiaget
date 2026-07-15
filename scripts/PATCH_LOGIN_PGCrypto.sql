-- =============================================================================
-- PARCHE LOGIN — Supabase instala pgcrypto en schema "extensions"
-- Ejecutar en SQL Editor si login falla con:
--   • "Usuario o contraseña incorrectos" (aunque el usuario exista)
--   • "function gen_random_bytes(integer) does not exist"
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Validar contraseña (bcrypt + texto plano legacy)
CREATE OR REPLACE FUNCTION public.validar_password(p_username text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_password_hash text;
BEGIN
  SELECT password_hash INTO v_password_hash
  FROM public.usuarios
  WHERE username = trim(p_username) AND activo = true
  LIMIT 1;

  IF v_password_hash IS NULL THEN
    RETURN false;
  END IF;

  IF v_password_hash LIKE '$2%' THEN
    RETURN v_password_hash = extensions.crypt(p_password, v_password_hash);
  END IF;

  RETURN v_password_hash = p_password;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_password(text, text) TO anon, authenticated;

-- 2) Hash de token de sesión
CREATE OR REPLACE FUNCTION public._sie_token_hash(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- 3) Login — generar token con extensions.gen_random_bytes
CREATE OR REPLACE FUNCTION public.sie_iniciar_sesion(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.usuarios%ROWTYPE;
  v_token text;
  v_duracion interval;
  v_nuevos_intentos int;
BEGIN
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
    WHEN 'Padre' THEN interval '15 minutes'
    ELSE interval '30 minutes'
  END;

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

-- 4) Reset / cambio contraseña (mismo schema extensions)
CREATE OR REPLACE FUNCTION public.sie_solicitar_reset_password(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
-- Diagnóstico (opcional — ver resultados en Results)
-- =============================================================================
SELECT 'Rudeus' AS usuario, public.validar_password('Rudeus', '123456') AS password_ok;
SELECT 'padre.humani' AS usuario, public.validar_password('padre.humani', 'padre123') AS password_ok;
