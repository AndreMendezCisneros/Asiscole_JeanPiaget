-- Jean Piaget: en la app se muestra el CARGO del empleado (ej. "COORDINADORA DE TOECE")
-- en vez de su categoría. Si no tiene cargo, se usa la categoría.
--  * Subtítulo del empleado en la app (vista asis_v_directorio_personal, columna seccion).
--  * Payload de los avisos (asis_outbox): se agrega 'cargo'; el canal lo usa en el texto.
-- Idempotente. Basado en PATCH_PERSONAL_APP.sql, PATCH_PERSONAL_V2.sql (8) y PATCH_PERSONAL_TALLER.sql (4).

CREATE OR REPLACE VIEW public.asis_v_directorio_personal AS
SELECT 1000000 + p.id_personal AS id_estudiante,
       p.codigo_barras,
       p.nombre_completo,
       'Personal'::text AS grado,
       coalesce(nullif(btrim(p.cargo), ''), p.categoria) AS seccion,
       'Personal'::text AS nivel_educativo,
       c.valor AS telefono
  FROM public.personal p
 CROSS JOIN (
       SELECT valor FROM public.configuracion_sistema
        WHERE clave = 'promotoria_telefono' AND nullif(btrim(valor), '') IS NOT NULL
 ) c
 WHERE p.activo;

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
    VALUES (v_tipo, v_id_personal, v_id_registro, jsonb_strip_nulls(coalesce(v_payload, '{}'::jsonb)));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asis_outbox personal: no se pudo encolar % (SQLSTATE %)', v_tipo, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.asis_fn_encolar_taller_personal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tipo text;
  p public.personal%ROWTYPE;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_tipo := 'personal_entrada';
    ELSIF OLD.hora_salida IS NULL AND NEW.hora_salida IS NOT NULL THEN
      v_tipo := 'personal_salida';
    ELSE
      RETURN NEW;
    END IF;

    SELECT * INTO p FROM personal WHERE id_personal = NEW.id_personal;
    INSERT INTO public.asis_outbox (tipo, id_estudiante, id_registro, payload)
    VALUES (
      v_tipo,
      NEW.id_personal,
      1000000000 + NEW.id_registro,
      jsonb_strip_nulls(jsonb_build_object(
        'id_personal', NEW.id_personal,
        'nombre_completo', p.nombre_completo,
        'categoria', p.categoria,
        'cargo', nullif(btrim(p.cargo), ''),
        'fecha', NEW.fecha,
        'estado', 'Taller',
        'hora', CASE WHEN v_tipo = 'personal_salida'
                     THEN to_char(NEW.hora_salida, 'HH24:MI')
                     ELSE to_char(NEW.hora_llegada, 'HH24:MI') END,
        'hora_ingreso', to_char(NEW.hora_llegada, 'HH24:MI')
      ))
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'asis_outbox taller personal: no se pudo encolar % (SQLSTATE %)', v_tipo, SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
