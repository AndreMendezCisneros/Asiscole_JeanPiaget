-- Permite al rol Cajero operar pensiones sin abrirle el resto del staff.
-- No modifica _sie_es_staff (incidencias/estudiantes siguen bloqueados).

CREATE OR REPLACE FUNCTION public._sie_puede_pensiones()
RETURNS boolean
LANGUAGE sql
STABLE
AS $function$
  SELECT public.sie_tiene_sesion()
    AND public.sie_sesion_rol() IN ('Admin', 'Director', 'Cajero');
$function$;

-- En las funciones sie_pensiones_*:
--   sie_es_staff_sesion()        -> _sie_puede_pensiones()
--   _sie_es_admin_o_director()   -> _sie_puede_pensiones()
-- Aplica a: listar, import_logs, set_config, upsert_lote,
-- actualizar_manual, marcar_morosas, historial_anio.
