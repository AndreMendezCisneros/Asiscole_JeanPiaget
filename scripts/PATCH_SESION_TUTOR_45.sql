-- Tutor y Docente: inactividad 45 min (Padre sigue en 15, staff en 30).
-- Aplica a sie_iniciar_sesion y sie_renovar_sesion.

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
    WHEN 'Tutor' THEN interval '45 minutes'
    WHEN 'Docente' THEN interval '45 minutes'
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
    WHEN 'Tutor' THEN interval '45 minutes'
    WHEN 'Docente' THEN interval '45 minutes'
    WHEN 'Padre' THEN interval '15 minutes'
    ELSE interval '30 minutes' END;
  UPDATE public.app_sesiones SET expires_at = now() + v_duracion
  WHERE token_hash = public._sie_token_hash(trim(p_token));
  RETURN jsonb_build_object('ok', true, 'expiresInMs', (EXTRACT(EPOCH FROM v_duracion) * 1000)::bigint);
END;
$$;
