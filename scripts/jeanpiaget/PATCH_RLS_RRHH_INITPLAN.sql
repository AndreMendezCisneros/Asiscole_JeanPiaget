-- Jean Piaget: políticas RRHH evaluadas una sola vez por consulta.
-- Antes: USING (public.sie_es_rrhh_sesion()) → se valida el token en CADA fila.
-- Ahora: USING ((SELECT public.sie_es_rrhh_sesion())) → initplan, igual que las
-- políticas de Admin/Tutor. Mismo resultado, menos trabajo. Idempotente.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal', 'personal_horario', 'registros_llegada_personal', 'incidencias_personal'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS sie_%s_rrhh_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY sie_%s_rrhh_all ON public.%I FOR ALL TO anon, authenticated
         USING ((SELECT public.sie_es_rrhh_sesion())) WITH CHECK ((SELECT public.sie_es_rrhh_sesion()))', t, t);
  END LOOP;
END $$;

SELECT tablename, policyname, qual
  FROM pg_policies
 WHERE policyname LIKE 'sie_%_rrhh_all'
 ORDER BY tablename;
