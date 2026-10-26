-- Jean Piaget: avisos del personal a la Promotoría por la app (canal Asiscole).
-- Encola en asis_outbox con tipos propios (personal_*); el poller del canal los
-- entrega a las cuentas de administración listadas en
-- configuracion_sistema.promotoria_usuarios. Nunca a apoderados.
-- Requiere PATCH_PERSONAL.sql y el canal con apps/ingesta/personal.py desplegado.
-- Idempotente.

-- asis_outbox.id_estudiante guarda el id_personal en estos tipos (columna NOT NULL).
ALTER TABLE public.asis_outbox DROP CONSTRAINT IF EXISTS asis_outbox_tipo_check;
ALTER TABLE public.asis_outbox ADD CONSTRAINT asis_outbox_tipo_check CHECK (tipo IN (
  'entrada', 'salida', 'incidencia',
  'personal_entrada', 'personal_salida', 'personal_incidencia'
));

INSERT INTO public.configuracion_sistema (clave, valor, descripcion)
VALUES (
  'promotoria_usuarios',
  '',
  'IDs de usuarios (Admin/Director/Supervisor) que reciben en la app los avisos del personal, separados por coma'
)
ON CONFLICT (clave) DO NOTHING;

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

COMMENT ON FUNCTION public.asis_fn_encolar_evento_personal() IS
  'Encola avisos del personal (llegada, falta del cierre, salida, incidencia) para la Promotoría. Nunca aborta la operación.';

DROP TRIGGER IF EXISTS asis_trg_personal_llegada ON public.registros_llegada_personal;
CREATE TRIGGER asis_trg_personal_llegada
  AFTER INSERT OR UPDATE ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.asis_fn_encolar_evento_personal();

DROP TRIGGER IF EXISTS asis_trg_personal_incidencia ON public.incidencias_personal;
CREATE TRIGGER asis_trg_personal_incidencia
  AFTER INSERT ON public.incidencias_personal
  FOR EACH ROW EXECUTE FUNCTION public.asis_fn_encolar_evento_personal();

-- Candidatos a Promotoría para la pantalla de Configuración (solo Admin).
CREATE OR REPLACE FUNCTION public.sie_promotoria_candidatos(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'Admin' THEN
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

GRANT EXECUTE ON FUNCTION public.sie_promotoria_candidatos(text) TO anon, authenticated;
