-- PATCH V2: error 42501 en auditoria_logs al registrar incidencias
-- Ejecutar COMPLETO en Supabase → SQL Editor (sistema_sanramon / PRODUCCIÓN).
--
-- Si el PATCH anterior falló a medias, este script:
-- 1) Diagnostica triggers y funciones actuales
-- 2) Recrea la función con SECURITY DEFINER + owner postgres
-- 3) Elimina triggers duplicados/antiguos en incidencias
-- 4) Añade política INSERT solo para roles de sistema (respaldo)

-- ═══════════════════════════════════════════════════════════════
-- DIAGNÓSTICO (revisar resultados antes de continuar)
-- ═══════════════════════════════════════════════════════════════
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'auditoria_logs'
ORDER BY ordinal_position;

SELECT
  t.tgname AS trigger_name,
  c.relname AS tabla,
  p.proname AS funcion,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN ('incidencias', 'registros_llegada')
ORDER BY c.relname, t.tgname;

-- ═══════════════════════════════════════════════════════════════
-- FUNCIÓN ÚNICA DE AUDITORÍA (esquema accion / fecha_hora / id_usuario)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_sie_auditoria_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id integer;
  v_id_registro integer;
BEGIN
  BEGIN
    v_usuario_id := public.sie_sesion_usuario_id();
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_id_registro := COALESCE(
      NULLIF(to_jsonb(OLD)->>'id_incidencia', '')::integer,
      NULLIF(to_jsonb(OLD)->>'id_estudiante', '')::integer,
      NULLIF(to_jsonb(OLD)->>'id_llegada', '')::integer,
      NULLIF(to_jsonb(OLD)->>'id_log', '')::integer,
      0
    );
    INSERT INTO public.auditoria_logs (
      tabla_afectada, accion, datos_anteriores, datos_nuevos,
      id_registro, id_usuario, fecha_hora
    ) VALUES (
      TG_TABLE_NAME::text, 'DELETE', to_jsonb(OLD), NULL,
      v_id_registro, v_usuario_id, now()
    );
    RETURN OLD;
  END IF;

  v_id_registro := COALESCE(
    NULLIF(to_jsonb(NEW)->>'id_incidencia', '')::integer,
    NULLIF(to_jsonb(NEW)->>'id_estudiante', '')::integer,
    NULLIF(to_jsonb(NEW)->>'id_llegada', '')::integer,
    NULLIF(to_jsonb(NEW)->>'id_log', '')::integer,
    0
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.auditoria_logs (
      tabla_afectada, accion, datos_anteriores, datos_nuevos,
      id_registro, id_usuario, fecha_hora
    ) VALUES (
      TG_TABLE_NAME::text, 'INSERT', NULL, to_jsonb(NEW),
      v_id_registro, v_usuario_id, now()
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.auditoria_logs (
      tabla_afectada, accion, datos_anteriores, datos_nuevos,
      id_registro, id_usuario, fecha_hora
    ) VALUES (
      TG_TABLE_NAME::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
      v_id_registro, v_usuario_id, now()
    );
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

ALTER FUNCTION public.fn_sie_auditoria_trigger() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_sie_auditoria_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sie_auditoria_trigger() TO postgres, service_role;

-- Marcar SECURITY DEFINER cualquier otra función trigger que escriba auditoría
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
      r.schema_name, r.func_name, r.args
    );
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) OWNER TO postgres',
      r.schema_name, r.func_name, r.args
    );
    RAISE NOTICE 'SECURITY DEFINER + owner postgres: %.%(%)', r.schema_name, r.func_name, r.args;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS: eliminar duplicados y usar solo fn_sie_auditoria_trigger
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname, c.relname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND c.relname = 'incidencias'
      AND pg_get_functiondef(p.oid) ILIKE '%auditoria_logs%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.tgname, r.relname);
    RAISE NOTICE 'Trigger eliminado: % en %', r.tgname, r.relname;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_auditoria_incidencias ON public.incidencias;
CREATE TRIGGER trg_auditoria_incidencias
  AFTER INSERT OR UPDATE OR DELETE ON public.incidencias
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_auditoria_registros_llegada ON public.registros_llegada;
CREATE TRIGGER trg_auditoria_registros_llegada
  AFTER INSERT OR UPDATE OR DELETE ON public.registros_llegada
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

-- Sin FORCE RLS (el owner postgres debe poder escribir vía trigger)
ALTER TABLE public.auditoria_logs NO FORCE ROW LEVEL SECURITY;

-- Política de respaldo: INSERT solo desde roles de sistema (trigger SECURITY DEFINER)
DROP POLICY IF EXISTS sie_auditoria_system_insert ON public.auditoria_logs;
CREATE POLICY sie_auditoria_system_insert ON public.auditoria_logs
  FOR INSERT
  TO postgres, service_role, supabase_admin
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICACIÓN (security_definer debe ser true)
-- ═══════════════════════════════════════════════════════════════
SELECT
  p.proname AS funcion,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner,
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

SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'auditoria_logs';
