-- Jean Piaget: no perder el aviso de la llegada real sobre una Falta automática.
-- asis_outbox tiene UNIQUE (tipo, id_registro). La Falta del cierre ya ocupa
-- ('personal_entrada', id_registro); cuando luego llega (Tarde, o Falta con hora real
-- después de su salida) el segundo INSERT chocaba y el aviso se descartaba.
-- Ahora el evento repetido reemplaza el payload y vuelve a quedar pendiente; el canal
-- deduplica por tipo:id:estado:hora, así que crea el aviso nuevo sin repetir el viejo.
-- Idempotente. Misma función que PATCH_PERSONAL_CARGO.sql salvo el INSERT final.

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
        'cargo', nullif(btrim(p.cargo), ''),
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
        'cargo', nullif(btrim(p.cargo), ''),
        'fecha', to_char(timezone('America/Lima', NEW.fecha_hora_registro), 'YYYY-MM-DD'),
        'hora', to_char(timezone('America/Lima', NEW.fecha_hora_registro), 'HH24:MI'),
        'nombre_falta', f.nombre_falta,
        'categoria_falta', f.categoria,
        'es_grave', coalesce(f.es_grave, false),
        'observaciones', nullif(btrim(NEW.observaciones), ''),
        'nombre_usuario_registro', coalesce(NEW.registrado_por_nombre, u.nombre_completo)
      ) INTO v_payload
      FROM catalogo_faltas f
      LEFT JOIN usuarios u ON u.id_usuario = NEW.id_usuario_registro
      WHERE f.id_falta = NEW.id_falta;
    END IF;

    INSERT INTO public.asis_outbox (tipo, id_estudiante, id_registro, payload)
    VALUES (v_tipo, v_id_personal, v_id_registro, jsonb_strip_nulls(coalesce(v_payload, '{}'::jsonb)))
    ON CONFLICT (tipo, id_registro) DO UPDATE
       SET payload = EXCLUDED.payload,
           id_estudiante = EXCLUDED.id_estudiante,
           procesado = false,
           procesado_en = NULL,
           intentos = 0,
           ultimo_error = NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asis_outbox personal: no se pudo encolar % (SQLSTATE %)', v_tipo, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

