-- =============================================================================
-- PARCHE: incidencias para Tutor + tipos bigint en reincidencia
-- Errores que corrige:
--   • 42501 new row violates row-level security policy for table "incidencias"
--   • 42883 function _sie_student_json_completo(estudiantes, integer, bigint) does not exist
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

-- bigint en total_faltas_60_dias (vista v_estudiantes_nivel_actual)
CREATE OR REPLACE FUNCTION public._sie_student_json_completo(
  e public.estudiantes,
  p_nivel int DEFAULT 0,
  p_faltas bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public._sie_student_json_basico(e) || jsonb_build_object(
    'reincidenceLevel', coalesce(p_nivel, 0),
    'faultsLast60Days', coalesce(p_faltas, 0)::int,
    'contactPhone', e.telefono_contacto,
    'contactEmail', e.email_contacto,
    'responsibleName', e.nombre_responsable,
    'responsibleRelationship', e.parentesco_responsable,
    'emergencyPhone', e.telefono_emergencia
  );
$$;

-- Tutor: registrar incidencias desde el escáner
DROP POLICY IF EXISTS sie_incidencias_tutor_insert ON public.incidencias;
DROP POLICY IF EXISTS sie_incidencias_tutor_select ON public.incidencias;

CREATE POLICY sie_incidencias_tutor_insert ON public.incidencias
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

CREATE POLICY sie_incidencias_tutor_select ON public.incidencias
  FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

-- Verificación opcional
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname = '_sie_student_json_completo';
