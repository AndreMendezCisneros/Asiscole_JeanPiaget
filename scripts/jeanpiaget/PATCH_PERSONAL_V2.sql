-- Jean Piaget: Personal v2.
--  * Solo el rol RRHH maneja Personal (Admin/Director/Supervisor ya no).
--  * Salida anticipada con o sin autorización (motivo + quién autorizó).
--  * Inasistencia automática a los N minutos de su hora de entrada sin marcar
--    (configuracion_sistema.personal_minutos_inasistencia, por defecto 120);
--    si luego marca, la incidencia automática se anula.
--  * Promotoría la configura RRHH.
-- Requiere PATCH_PERSONAL_RRHH_ROL.sql. Idempotente.

-- =============================================================================
-- 1) Sesión RRHH
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_es_rrhh_sesion()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.sie_sesion_rol() = 'RRHH';
$$;

GRANT EXECUTE ON FUNCTION public.sie_es_rrhh_sesion() TO anon, authenticated;

-- =============================================================================
-- 2) RLS: staff → RRHH en las tablas del personal (el Tutor conserva el escáner)
-- =============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal', 'personal_horario', 'registros_llegada_personal', 'incidencias_personal'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS sie_%s_staff_all ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS sie_%s_rrhh_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY sie_%s_rrhh_all ON public.%I FOR ALL TO anon, authenticated
         USING (public.sie_es_rrhh_sesion()) WITH CHECK (public.sie_es_rrhh_sesion())', t, t);
  END LOOP;
END $$;

-- =============================================================================
-- 3) Columnas nuevas
-- =============================================================================
ALTER TABLE public.registros_llegada_personal
  ADD COLUMN IF NOT EXISTS motivo_salida text NULL,
  ADD COLUMN IF NOT EXISTS salida_autorizada_por integer NULL REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_autorizacion_salida timestamptz NULL;

ALTER TABLE public.incidencias_personal
  ADD COLUMN IF NOT EXISTS registrado_por_nombre text NULL;

-- RRHH no lee la tabla usuarios: el nombre de quien registró se guarda al insertar.
CREATE OR REPLACE FUNCTION public.sie_fn_incidencia_personal_nombre()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.registrado_por_nombre IS NULL THEN
    SELECT nombre_completo INTO NEW.registrado_por_nombre FROM usuarios WHERE id_usuario = NEW.id_usuario_registro;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_incidencia_personal_nombre ON public.incidencias_personal;
CREATE TRIGGER sie_trg_incidencia_personal_nombre
  BEFORE INSERT ON public.incidencias_personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_incidencia_personal_nombre();

UPDATE public.incidencias_personal i
   SET registrado_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = i.id_usuario_registro AND i.registrado_por_nombre IS NULL;

-- =============================================================================
-- 4) Llegada fija: transiciones permitidas
--    Falta → llegada real (antes de su salida) o Falta justificada;
--    Tarde → Tarde justificada; tipo_salida Anticipada → Autorizada.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_fn_personal_llegada_fija()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'Falta' THEN
    RETURN NEW;
  END IF;

  IF NEW.hora_llegada IS DISTINCT FROM OLD.hora_llegada
     OR NEW.hora_entrada_esperada IS DISTINCT FROM OLD.hora_entrada_esperada THEN
    RAISE EXCEPTION 'La hora de llegada del personal no se puede modificar.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (OLD.estado = 'Tarde' AND NEW.estado = 'Tarde justificada') THEN
    RAISE EXCEPTION 'El estado de llegada del personal no se puede modificar (solo justificar una tardanza).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.tipo_salida IS NOT NULL AND NEW.tipo_salida IS DISTINCT FROM OLD.tipo_salida
     AND NOT (OLD.tipo_salida = 'Anticipada' AND NEW.tipo_salida = 'Autorizada') THEN
    RAISE EXCEPTION 'El tipo de salida solo puede pasar de Anticipada a Autorizada.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.hora_salida IS NOT NULL AND NEW.hora_salida IS DISTINCT FROM OLD.hora_salida THEN
    RAISE EXCEPTION 'La hora de salida del personal no se puede modificar.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Falta automática → llegada real: anula la incidencia automática de ese día.
CREATE OR REPLACE FUNCTION public.sie_fn_personal_falta_corregida()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.estado = 'Falta' AND NEW.estado IN ('A tiempo', 'Tarde', 'Fuera de horario') THEN
    UPDATE incidencias_personal
       SET estado = 'Anulada',
           motivo_anulacion = 'Registró su llegada a las ' || to_char(NEW.hora_llegada, 'HH24:MI') || ' (' || NEW.estado || ').',
           fecha_anulacion = now()
     WHERE id_personal = NEW.id_personal
       AND estado = 'Activa'
       AND observaciones LIKE 'Generada automáticamente%'
       AND (timezone('America/Lima', fecha_hora_registro))::date = NEW.fecha;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_falta_corregida ON public.registros_llegada_personal;
CREATE TRIGGER sie_trg_personal_falta_corregida
  AFTER UPDATE ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_falta_corregida();

-- =============================================================================
-- 5) Inasistencia automática a los N minutos de su entrada (hoy) + día anterior
-- =============================================================================
INSERT INTO public.configuracion_sistema (clave, valor, descripcion)
VALUES ('personal_minutos_inasistencia', '120',
        'Minutos después de su hora de entrada sin marcar para que el personal quede como inasistencia')
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sie_jp_marcar_faltas_personal_pendientes(
  p_ahora timestamptz DEFAULT now()
)
RETURNS TABLE(personal_marcado integer, incidencias_creadas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_local timestamp := timezone('America/Lima', p_ahora);
  v_hoy date := v_local::date;
  v_hora time := v_local::time;
  v_dia smallint := EXTRACT(ISODOW FROM v_hoy)::smallint;
  v_min int;
  v_id_falta int;
  v_id_user int;
  v_marcados int := 0;
  v_inc int := 0;
  v_prev record;
  r record;
BEGIN
  -- Día anterior completo (por si el cron no corrió a tiempo).
  SELECT * INTO v_prev FROM sie_jp_marcar_faltas_personal_dia(v_hoy - 1);
  v_marcados := coalesce(v_prev.personal_marcado, 0);
  v_inc := coalesce(v_prev.incidencias_creadas, 0);

  IF EXISTS (SELECT 1 FROM calendario_no_lectivo c WHERE c.fecha = v_hoy AND c.activo IS TRUE) THEN
    personal_marcado := v_marcados;
    incidencias_creadas := v_inc;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT coalesce(nullif(regexp_replace(valor, '\D', '', 'g'), '')::int, 120) INTO v_min
  FROM configuracion_sistema WHERE clave = 'personal_minutos_inasistencia';
  v_min := coalesce(v_min, 120);

  SELECT id_falta INTO v_id_falta FROM catalogo_faltas
  WHERE lower(nombre_falta) = 'falta' AND COALESCE(activo, true) ORDER BY id_falta LIMIT 1;
  IF v_id_falta IS NULL THEN
    RAISE EXCEPTION 'No existe catalogo_faltas «Falta» activa';
  END IF;
  SELECT id_usuario INTO v_id_user FROM usuarios WHERE rol IN ('Admin', 'Director') ORDER BY id_usuario LIMIT 1;

  FOR r IN
    SELECT p.id_personal, h.hora_entrada, h.hora_salida
    FROM personal p
    JOIN personal_horario h ON h.id_personal = p.id_personal AND h.dia_semana = v_dia
    WHERE p.activo
      AND (timezone('America/Lima', p.fecha_creacion))::date <= v_hoy
      AND h.hora_entrada + make_interval(mins => v_min) <= v_hora
      AND h.hora_entrada + make_interval(mins => v_min) > h.hora_entrada  -- sin pasar medianoche
      AND NOT EXISTS (
        SELECT 1 FROM registros_llegada_personal rl WHERE rl.id_personal = p.id_personal AND rl.fecha = v_hoy
      )
  LOOP
    INSERT INTO registros_llegada_personal (
      id_personal, fecha, hora_llegada, estado, hora_entrada_esperada, hora_salida_esperada, registrado_por
    ) VALUES (r.id_personal, v_hoy, TIME '00:00:00', 'Falta', r.hora_entrada, r.hora_salida, v_id_user)
    ON CONFLICT (id_personal, fecha) DO NOTHING;

    IF FOUND THEN
      v_marcados := v_marcados + 1;
      INSERT INTO incidencias_personal (id_personal, id_falta, id_usuario_registro, observaciones)
      VALUES (r.id_personal, v_id_falta, v_id_user,
              'Generada automáticamente: sin registro de entrada ' || v_min || ' min después de su hora de entrada.');
      v_inc := v_inc + 1;
    END IF;
  END LOOP;

  personal_marcado := v_marcados;
  incidencias_creadas := v_inc;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.sie_jp_marcar_faltas_personal_pendientes(timestamptz) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 6) Promotoría: la maneja RRHH
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_promotoria_candidatos(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('error', 'No autorizado', 'usuarios', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object(
    'error', NULL,
    'usuarios', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id_usuario, 'username', u.username, 'nombre', u.nombre_completo, 'rol', u.rol::text
      ) ORDER BY u.nombre_completo)
      FROM usuarios u
      WHERE u.activo AND u.rol IN ('Admin', 'Director', 'Supervisor') AND u.username NOT LIKE '\_\_%'
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_promotoria_guardar(p_token text, p_ids int[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol text; v_valor text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  -- Solo ids de usuarios que pueden entrar a la app en modo administración.
  SELECT coalesce(string_agg(id_usuario::text, ',' ORDER BY id_usuario), '') INTO v_valor
  FROM usuarios
  WHERE id_usuario = ANY(coalesce(p_ids, ARRAY[]::int[]))
    AND activo AND rol IN ('Admin', 'Director', 'Supervisor');
  INSERT INTO configuracion_sistema (clave, valor, descripcion, fecha_actualizacion)
  VALUES ('promotoria_usuarios', v_valor,
          'IDs de usuarios (Admin/Director/Supervisor) que reciben en la app los avisos del personal, separados por coma', now())
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, fecha_actualizacion = now();
  RETURN jsonb_build_object('ok', true, 'error', NULL, 'valor', v_valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_promotoria_candidatos(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_promotoria_guardar(text, int[]) TO anon, authenticated;

-- =============================================================================
-- 7) Corrección de registros ya guardados: salida comparada con el horario
--    vigente (antes se usaba la foto tomada al llegar).
-- =============================================================================
ALTER TABLE public.registros_llegada_personal DISABLE TRIGGER sie_trg_personal_llegada_fija;

UPDATE public.registros_llegada_personal r
   SET hora_salida_esperada = h.hora_salida,
       tipo_salida = CASE WHEN h.hora_salida IS NOT NULL AND r.hora_salida < h.hora_salida THEN 'Anticipada' ELSE 'Normal' END
  FROM public.personal_horario h
 WHERE h.id_personal = r.id_personal
   AND h.dia_semana = EXTRACT(ISODOW FROM r.fecha)
   AND r.hora_salida IS NOT NULL
   AND r.motivo_salida IS NULL
   AND (r.hora_salida_esperada IS DISTINCT FROM h.hora_salida
        OR (r.tipo_salida = 'Autorizada' AND h.hora_salida IS NOT NULL AND r.hora_salida >= h.hora_salida));

ALTER TABLE public.registros_llegada_personal ENABLE TRIGGER sie_trg_personal_llegada_fija;

-- =============================================================================
-- 8) Aviso cuando la inasistencia automática recibe una llegada después de su salida
-- =============================================================================
CREATE OR REPLACE FUNCTION public.asis_fn_encolar_evento_personal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tipo text;
  v_id_personal int;
  v_id_registro int;
  v_payload jsonb;
  p public.personal%ROWTYPE;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'registros_llegada_personal' THEN
      v_id_personal := NEW.id_personal;
      v_id_registro := NEW.id_registro;
      IF TG_OP = 'INSERT' THEN
        IF NEW.estado NOT IN ('A tiempo', 'Tarde', 'Fuera de horario', 'Falta') THEN
          RETURN NEW;
        END IF;
        v_tipo := 'personal_entrada';
      ELSIF OLD.hora_salida IS NULL AND NEW.hora_salida IS NOT NULL THEN
        v_tipo := 'personal_salida';
      ELSIF OLD.estado = 'Falta' AND NEW.estado IN ('A tiempo', 'Tarde', 'Fuera de horario') THEN
        -- Llegada real registrada sobre la Falta del cierre.
        v_tipo := 'personal_entrada';
      ELSIF OLD.estado = 'Falta' AND NEW.estado = 'Falta'
            AND OLD.hora_llegada = TIME '00:00' AND NEW.hora_llegada <> TIME '00:00' THEN
        -- Ya marcado como inasistencia y llegó después de su hora de salida.
        v_tipo := 'personal_entrada';
      ELSE
        RETURN NEW;
      END IF;

      SELECT * INTO p FROM personal WHERE id_personal = v_id_personal;
      v_payload := jsonb_build_object(
        'id_personal', v_id_personal,
        'nombre_completo', p.nombre_completo,
        'categoria', p.categoria,
        'fecha', NEW.fecha,
        'estado', NEW.estado,
        'hora', CASE WHEN v_tipo = 'personal_salida'
                     THEN to_char(NEW.hora_salida, 'HH24:MI')
                     ELSE to_char(NEW.hora_llegada, 'HH24:MI') END,
        'hora_esperada', to_char(NEW.hora_entrada_esperada, 'HH24:MI'),
        'hora_salida_esperada', to_char(NEW.hora_salida_esperada, 'HH24:MI'),
        'tipo_salida', NEW.tipo_salida
      );
    ELSE
      -- incidencias_personal: la "Falta" automática ya se avisa como inasistencia.
      IF coalesce(NEW.observaciones, '') LIKE 'Generada automáticamente%' THEN
        RETURN NEW;
      END IF;
      v_tipo := 'personal_incidencia';
      v_id_personal := NEW.id_personal;
      v_id_registro := NEW.id_incidencia;
      SELECT * INTO p FROM personal WHERE id_personal = v_id_personal;
      SELECT jsonb_build_object(
        'id_personal', v_id_personal,
        'nombre_completo', p.nombre_completo,
        'categoria', p.categoria,
        'fecha', to_char(timezone('America/Lima', NEW.fecha_hora_registro), 'YYYY-MM-DD'),
        'hora', to_char(timezone('America/Lima', NEW.fecha_hora_registro), 'HH24:MI'),
        'nombre_falta', f.nombre_falta,
        'categoria_falta', f.categoria,
        'es_grave', coalesce(f.es_grave, false),
        'observaciones', NEW.observaciones,
        'nombre_usuario_registro', u.nombre_completo
      ) INTO v_payload
      FROM catalogo_faltas f
      LEFT JOIN usuarios u ON u.id_usuario = NEW.id_usuario_registro
      WHERE f.id_falta = NEW.id_falta;
    END IF;

    INSERT INTO public.asis_outbox (tipo, id_estudiante, id_registro, payload)
    VALUES (v_tipo, v_id_personal, v_id_registro, jsonb_strip_nulls(coalesce(v_payload, '{}'::jsonb)));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asis_outbox personal: no se pudo encolar % (SQLSTATE %)', v_tipo, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
