-- Caja (rol Cajero, secretarías): marca la llegada y la salida del personal,
-- la entrada y salida de taller, y puede autorizar una salida anticipada, igual
-- que el tutor en el escáner.
-- No registra incidencias del personal (incidencias_personal sigue solo para
-- Admin, Tutor y RRHH) ni ve estudiantes desde esta pantalla.
-- Mismas condiciones que las políticas del Tutor. Idempotente.

DROP POLICY IF EXISTS sie_personal_cajero_sel ON public.personal;
CREATE POLICY sie_personal_cajero_sel ON public.personal
  FOR SELECT TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_personal_horario_cajero_sel ON public.personal_horario;
CREATE POLICY sie_personal_horario_cajero_sel ON public.personal_horario
  FOR SELECT TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_registros_llegada_personal_cajero_sel ON public.registros_llegada_personal;
CREATE POLICY sie_registros_llegada_personal_cajero_sel ON public.registros_llegada_personal
  FOR SELECT TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_registros_llegada_personal_cajero_ins ON public.registros_llegada_personal;
CREATE POLICY sie_registros_llegada_personal_cajero_ins ON public.registros_llegada_personal
  FOR INSERT TO anon, authenticated
  WITH CHECK ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_registros_llegada_personal_cajero_upd ON public.registros_llegada_personal;
CREATE POLICY sie_registros_llegada_personal_cajero_upd ON public.registros_llegada_personal
  FOR UPDATE TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()))
  WITH CHECK ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_personal_taller_cajero_sel ON public.personal_taller;
CREATE POLICY sie_personal_taller_cajero_sel ON public.personal_taller
  FOR SELECT TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_personal_taller_cajero_ins ON public.personal_taller;
CREATE POLICY sie_personal_taller_cajero_ins ON public.personal_taller
  FOR INSERT TO anon, authenticated
  WITH CHECK ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

DROP POLICY IF EXISTS sie_personal_taller_cajero_upd ON public.personal_taller;
CREATE POLICY sie_personal_taller_cajero_upd ON public.personal_taller
  FOR UPDATE TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()))
  WITH CHECK ((SELECT sie_sesion_rol()) = 'Cajero' AND (SELECT sie_tiene_sesion()));

SELECT tablename, policyname, cmd
  FROM pg_policies
 WHERE policyname LIKE '%cajero%'
 ORDER BY tablename, policyname;
