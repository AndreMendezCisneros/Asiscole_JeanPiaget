-- Jean Piaget: verificación del rol DocenteTutor (tras PATCH_DOCENTE_TUTOR.sql).
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Ejecutar completo en el SQL Editor; cada chequeo imprime NOTICE "OK ..." o
-- lanza EXCEPTION "FALLA ..." (y se detiene).

BEGIN;

DO $$
DECLARE
  v_rrhh_uid int;
  v_rrhh_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_tutor_token text;
  v_per int;
  v_per2 int;
  v_salon record;
  v_otro record;
  v_res jsonb;
  v_uid int;
  v_est int;
  v_n int;
  v_t0 timestamptz;
BEGIN
  -- Sesión RRHH ficticia (usa un usuario RRHH existente).
  SELECT id_usuario INTO v_rrhh_uid FROM public.usuarios WHERE rol::text = 'RRHH' AND activo LIMIT 1;
  IF v_rrhh_uid IS NULL THEN RAISE EXCEPTION 'FALLA: no hay usuario RRHH activo para la prueba'; END IF;
  INSERT INTO public.app_sesiones (token_hash, id_usuario, rol, expires_at)
  VALUES (public._sie_token_hash(v_rrhh_token), v_rrhh_uid, 'RRHH', now() + interval '10 minutes');

  -- Dos salones reales y dos empleados activos sin tutoría.
  SELECT e.nivel_educativo::text AS nivel, e.grado, e.seccion INTO v_salon
  FROM public.estudiantes e WHERE e.activo
    AND NOT EXISTS (SELECT 1 FROM public.personal_tutoria t WHERE t.activo
      AND t.nivel_educativo = e.nivel_educativo::text AND t.grado = e.grado AND t.seccion = e.seccion)
  GROUP BY 1, 2, 3 ORDER BY count(*) DESC LIMIT 1;
  SELECT e.nivel_educativo::text AS nivel, e.grado, e.seccion INTO v_otro
  FROM public.estudiantes e WHERE e.activo
    AND (e.nivel_educativo::text, e.grado, e.seccion) <> (v_salon.nivel, v_salon.grado, v_salon.seccion)
  GROUP BY 1, 2, 3 LIMIT 1;
  SELECT id_personal INTO v_per FROM public.personal p WHERE p.activo
    AND NOT EXISTS (SELECT 1 FROM public.personal_tutoria t WHERE t.id_personal = p.id_personal) LIMIT 1;
  SELECT id_personal INTO v_per2 FROM public.personal p WHERE p.activo AND p.id_personal <> v_per
    AND NOT EXISTS (SELECT 1 FROM public.personal_tutoria t WHERE t.id_personal = p.id_personal) LIMIT 1;

  -- 1) RRHH crea el tutor.
  v_res := public.sie_rrhh_guardar_tutor(v_rrhh_token, v_per, '__test_tutor', 'clave123',
    v_salon.nivel, v_salon.grado, v_salon.seccion, true);
  IF NOT (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FALLA crear tutor: %', v_res; END IF;
  v_uid := (v_res->>'userId')::int;
  RAISE NOTICE 'OK 1: tutor creado (usuario %) para % % %', v_uid, v_salon.nivel, v_salon.grado, v_salon.seccion;

  -- 2) El mismo salón no admite un segundo tutor.
  v_res := public.sie_rrhh_guardar_tutor(v_rrhh_token, v_per2, '__test_tutor2', 'clave123',
    v_salon.nivel, v_salon.grado, v_salon.seccion, true);
  IF (v_res->>'ok')::boolean THEN RAISE EXCEPTION 'FALLA: se aceptó un segundo tutor en el salón'; END IF;
  RAISE NOTICE 'OK 2: segundo tutor rechazado (%)', v_res->>'error';

  -- 3) Login real con la clave puesta por RRHH.
  v_res := public.sie_iniciar_sesion('__test_tutor', 'clave123');
  IF NOT (v_res->>'ok')::boolean OR v_res->'user'->>'role' <> 'DocenteTutor' THEN
    RAISE EXCEPTION 'FALLA login tutor: %', v_res;
  END IF;
  v_tutor_token := v_res->>'token';
  RAISE NOTICE 'OK 3: login DocenteTutor';

  -- 4) No es staff.
  IF public._sie_es_staff('DocenteTutor') THEN RAISE EXCEPTION 'FALLA: DocenteTutor cuenta como staff'; END IF;
  v_res := public.sie_lista_estudiantes(v_tutor_token, '{}'::jsonb);
  IF v_res->>'error' IS NULL THEN RAISE EXCEPTION 'FALLA: el tutor lista todos los estudiantes'; END IF;
  RAISE NOTICE 'OK 4: sin acceso a RPC de staff (%)', v_res->>'error';

  -- 5) Solo ve su salón.
  v_res := public.sie_tutor_llegadas(v_tutor_token, NULL);
  IF v_res->>'error' IS NOT NULL THEN RAISE EXCEPTION 'FALLA llegadas: %', v_res; END IF;
  SELECT count(*) INTO v_n FROM jsonb_array_elements(v_res->'students') s
  JOIN public.estudiantes e ON e.id_estudiante = (s->>'id')::int
  WHERE (e.nivel_educativo::text, e.grado, e.seccion) <> (v_salon.nivel, v_salon.grado, v_salon.seccion);
  IF v_n > 0 THEN RAISE EXCEPTION 'FALLA: % alumnos de otro salón', v_n; END IF;
  v_est := (v_res->'students'->0->>'id')::int;
  RAISE NOTICE 'OK 5: llegadas solo de su salón (% alumnos)', jsonb_array_length(v_res->'students');

  v_res := public.sie_tutor_incidencias(v_tutor_token, current_date - 60, current_date, 100, 0);
  SELECT count(*) INTO v_n FROM jsonb_array_elements(v_res->'incidents') i
  JOIN public.estudiantes e ON e.id_estudiante = (i->>'studentId')::int
  WHERE (e.nivel_educativo::text, e.grado, e.seccion) <> (v_salon.nivel, v_salon.grado, v_salon.seccion);
  IF v_res->>'error' IS NOT NULL OR v_n > 0 THEN RAISE EXCEPTION 'FALLA incidencias: % / %', v_res->>'error', v_n; END IF;
  RAISE NOTICE 'OK 6: incidencias solo de su salón (total %)', v_res->>'total';

  v_res := public.sie_tutor_asistencia(v_tutor_token, date_trunc('month', current_date)::date, current_date);
  IF v_res->>'error' IS NOT NULL THEN RAISE EXCEPTION 'FALLA asistencia: %', v_res; END IF;
  RAISE NOTICE 'OK 7: asistencia del mes (% registros)', jsonb_array_length(v_res->'arrivals');

  -- 8) Evidencias de otra aula: rechazadas.
  SELECT i.id_incidencia INTO v_n FROM public.incidencias i
  JOIN public.estudiantes e ON e.id_estudiante = i.id_estudiante
  WHERE (e.nivel_educativo::text, e.grado, e.seccion) = (v_otro.nivel, v_otro.grado, v_otro.seccion) LIMIT 1;
  IF v_n IS NOT NULL THEN
    v_res := public.sie_tutor_evidencias(v_tutor_token, v_n);
    IF v_res->>'error' IS NULL THEN RAISE EXCEPTION 'FALLA: ve evidencias de otro salón'; END IF;
    RAISE NOTICE 'OK 8: evidencias de otro salón rechazadas';
  ELSE
    RAISE NOTICE 'OMITIDO 8: el otro salón no tiene incidencias';
  END IF;

  -- 9) RLS: con el header del tutor no se puede leer ni escribir tablas directamente.
  PERFORM set_config('request.headers', json_build_object('x-sie-token', v_tutor_token)::text, true);
  IF public.sie_sesion_rol() IS DISTINCT FROM 'DocenteTutor' THEN RAISE EXCEPTION 'FALLA: header no reconocido'; END IF;
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_n FROM public.registros_llegada;
  IF v_n > 0 THEN RAISE EXCEPTION 'FALLA: el tutor lee registros_llegada directo (% filas)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.estudiantes;
  IF v_n > 0 THEN RAISE EXCEPTION 'FALLA: el tutor lee estudiantes directo (% filas)', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.incidencias;
  IF v_n > 0 THEN RAISE EXCEPTION 'FALLA: el tutor lee incidencias directo (% filas)', v_n; END IF;
  -- Fecha lejana para no chocar con un registro real (único por alumno y día).
  BEGIN
    INSERT INTO public.registros_llegada (id_estudiante, fecha, hora_llegada, estado)
    VALUES (v_est, DATE '2099-01-05', '07:00', 'A tiempo');
    RAISE EXCEPTION 'FALLA: el tutor pudo insertar una llegada';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- esperado: RLS lo bloquea
  END;
  UPDATE public.registros_llegada SET estado = estado WHERE true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN RAISE EXCEPTION 'FALLA: el tutor pudo actualizar % llegadas', v_n; END IF;
  RESET ROLE;
  PERFORM set_config('request.headers', '{}', true);
  RAISE NOTICE 'OK 9: sin lectura ni escritura directa en tablas';

  -- 10) Rendimiento de la consulta del día.
  v_t0 := clock_timestamp();
  PERFORM public.sie_tutor_llegadas(v_tutor_token, NULL);
  RAISE NOTICE 'INFO 10: sie_tutor_llegadas tardó % ms',
    round(extract(epoch FROM clock_timestamp() - v_t0) * 1000);

  -- 11) Desactivar al empleado cierra la sesión y el usuario.
  UPDATE public.personal SET activo = false WHERE id_personal = v_per;
  IF EXISTS (SELECT 1 FROM public.app_sesiones WHERE id_usuario = v_uid) THEN
    RAISE EXCEPTION 'FALLA: la sesión del tutor sigue abierta tras la baja';
  END IF;
  IF (SELECT activo FROM public.usuarios WHERE id_usuario = v_uid) THEN
    RAISE EXCEPTION 'FALLA: el usuario sigue activo tras la baja';
  END IF;
  RAISE NOTICE 'OK 11: baja del empleado desactiva al tutor';

  RAISE NOTICE '== TODO OK ==';
END $$;

ROLLBACK;
