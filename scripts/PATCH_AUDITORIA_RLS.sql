-- PATCH: error 42501 "new row violates row-level security policy for table auditoria_logs"
--
-- Causa: triggers AFTER INSERT/UPDATE/DELETE escriben en auditoria_logs con el rol del
-- cliente (anon + x-sie-token). RLS en auditoria_logs solo permite SELECT al staff,
-- no INSERT directo → falla el trigger y revierte la operación (p. ej. registrar incidencia).
--
-- Solución: funciones trigger SECURITY DEFINER (escriben como owner postgres, sin abrir
-- INSERT manual desde el frontend).
--
-- Ejecutar en Supabase → SQL Editor (una sola vez).

-- ── 1) Marcar SECURITY DEFINER todas las funciones trigger que escriben auditoría ──
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS func_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
      AND pg_get_functiondef(p.oid) ILIKE '%auditoria_logs%'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SECURITY DEFINER',
      r.schema_name,
      r.func_name,
      r.args
    );
    RAISE NOTICE 'SECURITY DEFINER aplicado: %.%(%)', r.schema_name, r.func_name, r.args;
  END LOOP;
END $$;

-- ── 2) Función genérica (recomendada para triggers nuevos) ──
-- Adapta columnas según el esquema detectado en information_schema.
CREATE OR REPLACE FUNCTION public.fn_sie_auditoria_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id integer;
  v_id_registro integer;
  v_row jsonb;
  v_has_accion boolean;
BEGIN
  v_usuario_id := public.sie_sesion_usuario_id();

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auditoria_logs' AND column_name = 'accion'
  ) INTO v_has_accion;

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_id_registro := COALESCE(
    NULLIF(v_row->>'id_incidencia', '')::integer,
    NULLIF(v_row->>'id_estudiante', '')::integer,
    NULLIF(v_row->>'id_llegada', '')::integer,
    NULLIF(v_row->>'id_log', '')::integer,
    NULLIF(v_row->>'id', '')::integer,
    0
  );

  IF v_has_accion THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.auditoria_logs (
        tabla_afectada, accion, datos_anteriores, datos_nuevos, id_registro, id_usuario, fecha_hora
      ) VALUES (
        TG_TABLE_NAME::text, 'INSERT', NULL, to_jsonb(NEW), v_id_registro, v_usuario_id, now()
      );
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.auditoria_logs (
        tabla_afectada, accion, datos_anteriores, datos_nuevos, id_registro, id_usuario, fecha_hora
      ) VALUES (
        TG_TABLE_NAME::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_id_registro, v_usuario_id, now()
      );
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.auditoria_logs (
        tabla_afectada, accion, datos_anteriores, datos_nuevos, id_registro, id_usuario, fecha_hora
      ) VALUES (
        TG_TABLE_NAME::text, 'DELETE', to_jsonb(OLD), NULL, v_id_registro, v_usuario_id, now()
      );
      RETURN OLD;
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.auditoria_logs (tabla_afectada, operacion, datos_anteriores, datos_nuevos, usuario_id)
      VALUES (TG_TABLE_NAME::text, 'INSERT', NULL, row_to_json(NEW), v_usuario_id);
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.auditoria_logs (tabla_afectada, operacion, datos_anteriores, datos_nuevos, usuario_id)
      VALUES (TG_TABLE_NAME::text, 'UPDATE', row_to_json(OLD), row_to_json(NEW), v_usuario_id);
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.auditoria_logs (tabla_afectada, operacion, datos_anteriores, datos_nuevos, usuario_id)
      VALUES (TG_TABLE_NAME::text, 'DELETE', row_to_json(OLD), NULL, v_usuario_id);
      RETURN OLD;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sie_auditoria_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sie_auditoria_trigger() TO postgres, service_role;

-- ── 3) Asegurar trigger en incidencias (si falta o usa función antigua) ──
DROP TRIGGER IF EXISTS trg_auditoria_incidencias ON public.incidencias;

CREATE TRIGGER trg_auditoria_incidencias
  AFTER INSERT OR UPDATE OR DELETE ON public.incidencias
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

-- ── 4) Actualizar trigger de llegadas si existe ──
DROP TRIGGER IF EXISTS trg_auditoria_registros_llegada ON public.registros_llegada;

CREATE TRIGGER trg_auditoria_registros_llegada
  AFTER INSERT OR UPDATE OR DELETE ON public.registros_llegada
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

-- Verificación
SELECT
  p.proname AS funcion,
  p.prosecdef AS security_definer,
  t.tgname AS trigger_name,
  c.relname AS tabla
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND pg_get_functiondef(p.oid) ILIKE '%auditoria_logs%'
ORDER BY c.relname, t.tgname;
