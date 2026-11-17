-- Jean Piaget: escáner de personal (Caja y Tutor) en una sola llamada.
-- Antes: getByBarcode + getRecordForDate + insert/update = 3 round trips por
-- marcación, cada uno pagando la latencia completa hacia el proyecto Supabase
-- (us-west-2). Esta función hace las tres cosas en una transacción del lado
-- del servidor: 1 round trip por escaneo.
-- Mismas reglas que personalAttendanceService.ts (registerArrival/registerDeparture,
-- sin permiso de salida anticipada: ese caso sigue por PersonalDepartureControl).
-- Aplicar con: python3 apply_patch.py [--check] PATCH_PERSONAL_ESCANEO_RPC.sql

CREATE OR REPLACE FUNCTION public.sie_personal_marcar_escaneo(
  p_codigo text DEFAULT NULL,
  p_id_personal integer DEFAULT NULL,
  p_fase text DEFAULT 'llegada'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rol text := public.sie_sesion_rol();
  v_user_id integer := public.sie_sesion_usuario_id();
  v_digits text;
  v_variants text[];
  p public.personal%ROWTYPE;
  r public.registros_llegada_personal%ROWTYPE;
  v_now timestamp := timezone('America/Lima', now());
  v_fecha date := v_now::date;
  v_hora time := date_trunc('minute', v_now::time);
  v_dia smallint := EXTRACT(ISODOW FROM v_fecha)::smallint;
  v_entry time;
  v_exit time;
  v_estado text;
  v_tipo text;
  v_schedule jsonb;
BEGIN
  IF NOT public.sie_tiene_sesion() OR v_rol NOT IN ('RRHH', 'Tutor', 'Cajero') THEN
    RETURN jsonb_build_object('error', 'No autorizado');
  END IF;
  IF p_fase NOT IN ('llegada', 'salida') THEN
    RETURN jsonb_build_object('error', 'Fase inválida');
  END IF;

  IF p_id_personal IS NOT NULL THEN
    SELECT * INTO p FROM public.personal WHERE id_personal = p_id_personal AND activo;
  ELSE
    v_digits := regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g');
    IF v_digits = '' THEN
      RETURN jsonb_build_object('error', 'Personal no encontrado');
    END IF;
    v_variants := ARRAY[v_digits, regexp_replace(v_digits, '^0+', '')];
    IF v_digits ~ '^\d{1,8}$' THEN
      v_variants := v_variants || lpad(v_digits, 8, '0');
    END IF;
    SELECT * INTO p FROM public.personal
     WHERE codigo_barras = ANY(v_variants) AND activo
     LIMIT 1;
  END IF;
  IF p.id_personal IS NULL THEN
    RETURN jsonb_build_object('error', 'Personal no encontrado');
  END IF;

  SELECT hora_entrada, hora_salida INTO v_entry, v_exit
    FROM public.personal_horario WHERE id_personal = p.id_personal AND dia_semana = v_dia;

  SELECT * INTO r FROM public.registros_llegada_personal
   WHERE id_personal = p.id_personal AND fecha = v_fecha;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id_personal', h.id_personal, 'dia_semana', h.dia_semana,
           'hora_entrada', h.hora_entrada, 'hora_salida', h.hora_salida
         ) ORDER BY h.dia_semana), '[]'::jsonb)
    INTO v_schedule
    FROM public.personal_horario h WHERE h.id_personal = p.id_personal;

  IF p_fase = 'llegada' THEN
    -- Falta con hora_llegada 00:00 (cierre automático o justificación) se
    -- puede corregir con la llegada real; cualquier otro estado ya es marca.
    IF r.id_registro IS NOT NULL
       AND NOT (r.estado = 'Falta' AND r.hora_llegada = TIME '00:00:00') THEN
      RETURN jsonb_build_object(
        'duplicate', true, 'action', 'arrival',
        'personal', to_jsonb(p) || jsonb_build_object('personal_horario', v_schedule),
        'record', to_jsonb(r)
      );
    END IF;

    v_estado := CASE
      WHEN v_entry IS NULL THEN 'Fuera de horario'
      WHEN v_exit IS NOT NULL AND v_hora > v_exit THEN 'Falta'
      WHEN v_hora <= v_entry THEN 'A tiempo'
      ELSE 'Tarde'
    END;

    IF r.id_registro IS NOT NULL THEN
      UPDATE public.registros_llegada_personal
         SET hora_llegada = v_hora, estado = v_estado,
             hora_entrada_esperada = v_entry, hora_salida_esperada = v_exit,
             registrado_por = v_user_id
       WHERE id_registro = r.id_registro
       RETURNING * INTO r;
    ELSE
      BEGIN
        INSERT INTO public.registros_llegada_personal (
          id_personal, fecha, hora_llegada, estado,
          hora_entrada_esperada, hora_salida_esperada, registrado_por
        ) VALUES (
          p.id_personal, v_fecha, v_hora, v_estado, v_entry, v_exit, v_user_id
        ) RETURNING * INTO r;
      EXCEPTION WHEN unique_violation THEN
        SELECT * INTO r FROM public.registros_llegada_personal
         WHERE id_personal = p.id_personal AND fecha = v_fecha;
        RETURN jsonb_build_object(
          'duplicate', true, 'action', 'arrival',
          'personal', to_jsonb(p) || jsonb_build_object('personal_horario', v_schedule),
          'record', to_jsonb(r)
        );
      END;
    END IF;

    RETURN jsonb_build_object(
      'duplicate', false, 'action', 'arrival',
      'personal', to_jsonb(p) || jsonb_build_object('personal_horario', v_schedule),
      'record', to_jsonb(r)
    );
  ELSE
    IF r.id_registro IS NULL OR (r.hora_llegada = TIME '00:00:00' AND r.estado IN ('Falta', 'Falta justificada')) THEN
      RETURN jsonb_build_object('error', p.nombre_completo || ' aún no tiene llegada hoy. Registre primero la llegada.');
    END IF;
    IF r.estado = 'Falta' THEN
      RETURN jsonb_build_object('error', p.nombre_completo || ' llegó después de su hora de salida (inasistencia); no se registra salida.');
    END IF;
    IF r.hora_salida IS NOT NULL THEN
      RETURN jsonb_build_object(
        'duplicate', true, 'action', 'departure',
        'personal', to_jsonb(p) || jsonb_build_object('personal_horario', v_schedule),
        'record', to_jsonb(r)
      );
    END IF;

    v_exit := coalesce(v_exit, r.hora_salida_esperada);
    v_tipo := CASE WHEN v_exit IS NULL OR v_hora >= v_exit THEN 'Normal' ELSE 'Anticipada' END;

    UPDATE public.registros_llegada_personal
       SET hora_salida = v_hora, tipo_salida = v_tipo,
           hora_salida_esperada = v_exit, registrado_salida_por = v_user_id,
           fecha_salida = now()
     WHERE id_registro = r.id_registro AND hora_salida IS NULL
     RETURNING * INTO r;

    RETURN jsonb_build_object(
      'duplicate', false, 'action', 'departure',
      'personal', to_jsonb(p) || jsonb_build_object('personal_horario', v_schedule),
      'record', to_jsonb(r)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_personal_marcar_escaneo(text, integer, text) TO anon, authenticated;
