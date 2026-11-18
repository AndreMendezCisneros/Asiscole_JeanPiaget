-- =============================================================================
-- PATCH: alumno retirado.
-- Retirado = estudiantes.activo = false + fecha_retiro + motivo_retiro.
-- Se conserva TODO su historial (llegadas, incidencias, justificaciones, pensiones).
-- Deja de salir en escáneres, control de llegadas/salidas, pendientes por justificar,
-- compromisos de alarma, faltas automáticas (ya filtraban activo) y en la app de padres.
-- Un hermano con el mismo celular NO se ve afectado (todo es por id_estudiante).
--
-- Aplicar ANTES de desplegar el frontend, junto con PATCH_JUSTIFICACIONES_PAGINADO.sql
-- (actualizado: pendientes sin retirados). Idempotente.
--   python3 /tmp/apply_patch.py --check /tmp/PATCH_ESTUDIANTE_RETIRO.sql
-- =============================================================================

-- 1) Columnas
ALTER TABLE public.estudiantes ADD COLUMN IF NOT EXISTS fecha_retiro date;
ALTER TABLE public.estudiantes ADD COLUMN IF NOT EXISTS motivo_retiro text;

-- 2) Retirar
CREATE OR REPLACE FUNCTION public.sie_estudiante_retirar(
  p_token text,
  p_id integer,
  p_fecha date DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rol text;
  v_id_usuario integer;
  v_nombre text;
  v_fecha date := coalesce(p_fecha, (now() AT TIME ZONE 'America/Lima')::date);
  v_motivo text := left(nullif(trim(coalesce(p_motivo, '')), ''), 300);
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_id_usuario FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol NOT IN ('Admin', 'Director') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director pueden retirar alumnos');
  END IF;
  IF v_motivo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Indique el motivo del retiro');
  END IF;

  UPDATE public.estudiantes
     SET activo = false, fecha_retiro = v_fecha, motivo_retiro = v_motivo
   WHERE id_estudiante = p_id
  RETURNING nombre_completo INTO v_nombre;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Estudiante no encontrado');
  END IF;

  BEGIN
    INSERT INTO public.auditoria_logs (id_usuario, tabla_afectada, id_registro, accion, datos_nuevos, descripcion_accion)
    VALUES (v_id_usuario, 'estudiantes', p_id, 'UPDATE',
            jsonb_build_object('activo', false, 'fecha_retiro', v_fecha, 'motivo_retiro', v_motivo),
            'Alumno retirado: ' || coalesce(v_nombre, ''));
  EXCEPTION WHEN OTHERS THEN
    NULL; -- la auditoría nunca bloquea el retiro
  END;

  RETURN jsonb_build_object('ok', true, 'error', null);
END;
$$;

-- 3) Reactivar (por si se retiró por error o vuelve al colegio)
CREATE OR REPLACE FUNCTION public.sie_estudiante_reactivar(p_token text, p_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rol text;
  v_id_usuario integer;
  v_nombre text;
BEGIN
  SELECT rol, id_usuario INTO v_rol, v_id_usuario FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol NOT IN ('Admin', 'Director') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director pueden reactivar alumnos');
  END IF;

  UPDATE public.estudiantes
     SET activo = true, fecha_retiro = NULL, motivo_retiro = NULL
   WHERE id_estudiante = p_id
  RETURNING nombre_completo INTO v_nombre;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Estudiante no encontrado');
  END IF;

  BEGIN
    INSERT INTO public.auditoria_logs (id_usuario, tabla_afectada, id_registro, accion, datos_nuevos, descripcion_accion)
    VALUES (v_id_usuario, 'estudiantes', p_id, 'UPDATE', jsonb_build_object('activo', true),
            'Alumno reactivado: ' || coalesce(v_nombre, ''));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'error', null);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_estudiante_retirar(text, integer, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sie_estudiante_reactivar(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sie_estudiante_retirar(text, integer, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_estudiante_reactivar(text, integer) TO anon, authenticated;

-- 4) App de padres: no encolar NINGÚN aviso (entrada, salida, incidencia, aviso, cita…)
--    de un alumno retirado. El personal usa id_estudiante >= 1000000 (no existe en
--    estudiantes), así que no se ve afectado.
CREATE OR REPLACE FUNCTION public.sie_trg_outbox_omitir_retirado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id_estudiante IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.estudiantes e
     WHERE e.id_estudiante = NEW.id_estudiante AND e.activo IS FALSE
  ) THEN
    RETURN NULL; -- se omite la fila; la operación del colegio sigue normal
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_outbox_omitir_retirado ON public.asis_outbox;
CREATE TRIGGER sie_trg_outbox_omitir_retirado
  BEFORE INSERT ON public.asis_outbox
  FOR EACH ROW EXECUTE FUNCTION public.sie_trg_outbox_omitir_retirado();

-- 5) Directorio de origen del canal: solo activos (por si el canal desplegado aún lee la vista).
CREATE OR REPLACE VIEW public.asis_v_directorio_origen WITH (security_invoker = 'true') AS
 SELECT id_estudiante,
    codigo_barras,
    nombre_completo,
    grado,
    seccion,
    nivel_educativo,
    TRIM(BOTH ' /'::text FROM concat_ws(' / '::text, NULLIF(btrim((telefono_contacto)::text), ''::text), NULLIF(btrim((telefono_emergencia)::text), ''::text))) AS telefono_contacto,
    regexp_replace(concat_ws(''::text, COALESCE(telefono_contacto, ''::character varying), COALESCE(telefono_emergencia, ''::character varying)), '\D'::text, ''::text, 'g'::text) AS telefono_digitos,
    activo
   FROM public.estudiantes e
  WHERE ((NULLIF(btrim((telefono_contacto)::text), ''::text) IS NOT NULL) OR (NULLIF(btrim((telefono_emergencia)::text), ''::text) IS NOT NULL))
    AND COALESCE(e.activo, true);
