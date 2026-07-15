-- PATCH: alertas CRÍTICAS "Security Definer View" en Supabase Advisor
-- Vistas: v_dashboard_ejecutivo, v_estudiantes_nivel_actual
--
-- Significado: esas vistas se ejecutan con permisos del CREADOR (postgres),
-- no del usuario que consulta → pueden saltarse RLS de las tablas base.
-- Supabase las marca como críticas porque anon/authenticated tienen SELECT.
--
-- Solución (Postgres 15+): recrear con security_invoker = true.
--
-- NOTA: Estas alertas NO causan el error 42501 de auditoria_logs.

-- 1) Ver definición actual
SELECT 'v_estudiantes_nivel_actual' AS vista,
       pg_get_viewdef('public.v_estudiantes_nivel_actual'::regclass, true) AS definicion
WHERE to_regclass('public.v_estudiantes_nivel_actual') IS NOT NULL
UNION ALL
SELECT 'v_dashboard_ejecutivo',
       pg_get_viewdef('public.v_dashboard_ejecutivo'::regclass, true)
WHERE to_regclass('public.v_dashboard_ejecutivo') IS NOT NULL;

-- 2) Copiar la definición del SELECT anterior, luego:
--    DROP VIEW public.v_estudiantes_nivel_actual;  -- sin CASCADE salvo que sepas dependencias
--    CREATE VIEW public.v_estudiantes_nivel_actual
--    WITH (security_invoker = true)
--    AS <pegar definición>;
--
-- 3) Repetir para v_dashboard_ejecutivo.
-- 4) GRANT SELECT ON public.v_estudiantes_nivel_actual TO anon, authenticated;
-- 5) Probar RPC del dashboard y listado de estudiantes.
