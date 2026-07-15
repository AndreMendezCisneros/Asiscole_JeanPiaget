-- =============================================================================
-- PATCH: Asistencia (llegada/salida) para rol Docente
-- Ejecutar en Supabase SQL Editor después de PATCH_ROL_DOCENTE.sql
-- =============================================================================

DROP POLICY IF EXISTS sie_llegada_docente_insert ON public.registros_llegada;
CREATE POLICY sie_llegada_docente_insert ON public.registros_llegada
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  );

DROP POLICY IF EXISTS sie_llegada_docente_select ON public.registros_llegada;
CREATE POLICY sie_llegada_docente_select ON public.registros_llegada
  FOR SELECT TO anon, authenticated
  USING (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  );

DROP POLICY IF EXISTS sie_llegada_docente_update ON public.registros_llegada;
CREATE POLICY sie_llegada_docente_update ON public.registros_llegada
  FOR UPDATE TO anon, authenticated
  USING (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  )
  WITH CHECK (
    public.sie_sesion_rol() = 'Docente'
    AND public.sie_tiene_sesion()
    AND public._sie_docente_puede_ver_estudiante(id_estudiante)
  );

NOTIFY pgrst, 'reload schema';
