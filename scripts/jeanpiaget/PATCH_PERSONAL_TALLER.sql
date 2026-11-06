-- Jean Piaget: taller del personal (tramos fuera de la jornada) e incidencias
-- registradas por Admin y Tutor.
--  * personal_taller: independiente de registros_llegada_personal. Varios tramos
--    por día, uno abierto a la vez. Si marcó entrada de clase, debe marcar antes
--    su salida de clase. Si no asistió en la mañana, puede marcar taller igual.
--  * Avisos a Promotoría por asis_outbox con los tipos personal_entrada/_salida y
--    estado 'Taller'. id_registro = 1 000 000 000 + id para no chocar con el
--    UNIQUE (tipo, id_registro) de los registros de clase.
--  * Admin y Tutor solo registran incidencias del personal: no las listan ni
--    las resuelven. Admin además puede buscar al personal para elegirlo.
-- Requiere PATCH_PERSONAL_V2.sql y PATCH_PERSONAL_AVISOS.sql. Idempotente.

-- =============================================================================
-- 1) Tabla
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.personal_taller (
  id_registro serial PRIMARY KEY,
  id_personal integer NOT NULL REFERENCES public.personal(id_personal) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_llegada time NOT NULL,
  hora_salida time NULL,
  registrado_por integer NULL REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  registrado_salida_por integer NULL REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_salida timestamptz NULL,
  CHECK (hora_salida IS NULL OR hora_salida >= hora_llegada)
);

CREATE INDEX IF NOT EXISTS idx_personal_taller_fecha ON public.personal_taller (fecha);
CREATE INDEX IF NOT EXISTS idx_personal_taller_personal_fecha ON public.personal_taller (id_personal, fecha);
-- Un solo tramo abierto por empleado y día.
CREATE UNIQUE INDEX IF NOT EXISTS ux_personal_taller_abierto
  ON public.personal_taller (id_personal, fecha) WHERE hora_salida IS NULL;

-- =============================================================================
-- 2) Reglas en la base (también valen si el navegador está desactualizado)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_fn_personal_taller_validar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM registros_llegada_personal r
       WHERE r.id_personal = NEW.id_personal
         AND r.fecha = NEW.fecha
         AND r.hora_llegada <> TIME '00:00'
         AND r.estado NOT IN ('Falta', 'Falta justificada')
         AND r.hora_salida IS NULL
    ) THEN
      RAISE EXCEPTION 'Primero debe marcar su salida de clase.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id_personal IS DISTINCT FROM OLD.id_personal
     OR NEW.fecha IS DISTINCT FROM OLD.fecha
     OR NEW.hora_llegada IS DISTINCT FROM OLD.hora_llegada THEN
    RAISE EXCEPTION 'La entrada al taller no se puede modificar.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.hora_salida IS NOT NULL AND NEW.hora_salida IS DISTINCT FROM OLD.hora_salida THEN
    RAISE EXCEPTION 'La salida del taller no se puede modificar.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_taller_validar ON public.personal_taller;
CREATE TRIGGER sie_trg_personal_taller_validar
  BEFORE INSERT OR UPDATE ON public.personal_taller
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_taller_validar();

DROP TRIGGER IF EXISTS trg_auditoria_personal_taller ON public.personal_taller;
CREATE TRIGGER trg_auditoria_personal_taller
  AFTER INSERT OR DELETE OR UPDATE ON public.personal_taller
  FOR EACH ROW EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

-- =============================================================================
-- 3) Permisos: Tutor (escáner) y RR.HH. leen y marcan; nadie borra desde la web
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON public.personal_taller TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.personal_taller_id_registro_seq TO anon, authenticated;

ALTER TABLE public.personal_taller ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sie_personal_taller_sel ON public.personal_taller;
CREATE POLICY sie_personal_taller_sel ON public.personal_taller FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() IN ('RRHH', 'Tutor') AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_personal_taller_ins ON public.personal_taller;
CREATE POLICY sie_personal_taller_ins ON public.personal_taller FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() IN ('RRHH', 'Tutor') AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_personal_taller_upd ON public.personal_taller;
CREATE POLICY sie_personal_taller_upd ON public.personal_taller FOR UPDATE TO anon, authenticated
  USING (public.sie_sesion_rol() IN ('RRHH', 'Tutor') AND public.sie_tiene_sesion())
  WITH CHECK (public.sie_sesion_rol() IN ('RRHH', 'Tutor') AND public.sie_tiene_sesion());

-- =============================================================================
-- 4) Avisos a Promotoría
-- =============================================================================
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

DROP TRIGGER IF EXISTS asis_trg_personal_taller ON public.personal_taller;
CREATE TRIGGER asis_trg_personal_taller
  AFTER INSERT OR UPDATE ON public.personal_taller
  FOR EACH ROW EXECUTE FUNCTION public.asis_fn_encolar_taller_personal();

-- =============================================================================
-- 5) Incidencias: Admin y Tutor solo registran, siempre a su propio nombre
-- =============================================================================
DROP POLICY IF EXISTS sie_incidencias_personal_registrar ON public.incidencias_personal;
CREATE POLICY sie_incidencias_personal_registrar ON public.incidencias_personal FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.sie_sesion_rol() IN ('Admin', 'Tutor')
    AND public.sie_tiene_sesion()
    AND id_usuario_registro = public.sie_sesion_usuario_id()
  );

-- El Tutor ya lee personal y horario para el escáner; Admin los necesita para buscar.
DROP POLICY IF EXISTS sie_personal_admin_sel ON public.personal;
CREATE POLICY sie_personal_admin_sel ON public.personal FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Admin' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_personal_horario_admin_sel ON public.personal_horario;
CREATE POLICY sie_personal_horario_admin_sel ON public.personal_horario FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Admin' AND public.sie_tiene_sesion());
