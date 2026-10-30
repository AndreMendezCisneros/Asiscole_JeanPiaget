-- Reglas RLS: la sesión (token → rol) se evalúa una vez por consulta y no por fila.
-- Antes, cada fila repetía la validación del token y las consultas grandes pasaban el statement_timeout
-- de 3 s de anon (500 en el dashboard). No cambia quién ve qué: probado por rol en copia local.
-- Reversa: RLS_SESION_UNA_VEZ_POR_CONSULTA_REVERSA.sql
-- 64 de 74 politicas; tablas: auditoria_logs, calendario_no_lectivo, catalogo_faltas, citas_padres, comentarios_incidencias, compromisos_alarma, configuracion_reincidencia, configuracion_sistema, estudiantes, evidencias_fotograficas, incidencias, incidencias_personal, padres_estudiantes, pensiones, pensiones_config, pensiones_import_log, personal, personal_horario, registros_llegada, registros_llegada_personal, taller_asistencias, taller_inscritos, taller_llegadas, talleres, usuarios
BEGIN;
ALTER POLICY "sie_auditoria_staff_select" ON public.auditoria_logs
  USING ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_faltas_select" ON public.catalogo_faltas
  USING ((SELECT public.sie_tiene_sesion()));

ALTER POLICY "sie_faltas_staff_write" ON public.catalogo_faltas
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_citas_padre_select" ON public.citas_padres
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_citas_staff_all" ON public.citas_padres
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_citas_tutor_rw" ON public.citas_padres
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())))
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_comentarios_padre_select" ON public.comentarios_incidencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND (EXISTS ( SELECT 1
   FROM incidencias i
  WHERE ((i.id_incidencia = comentarios_incidencias.id_incidencia) AND sie_padre_puede_ver_estudiante(i.id_estudiante))))));

ALTER POLICY "sie_comentarios_staff_all" ON public.comentarios_incidencias
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_compromisos_alarma_staff_all" ON public.compromisos_alarma
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_compromisos_alarma_tutor_ins" ON public.compromisos_alarma
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_compromisos_alarma_tutor_sel" ON public.compromisos_alarma
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_reincidencia_select" ON public.configuracion_reincidencia
  USING ((SELECT public.sie_tiene_sesion()));

ALTER POLICY "sie_reincidencia_staff_write" ON public.configuracion_reincidencia
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_config_select" ON public.configuracion_sistema
  USING ((SELECT public.sie_tiene_sesion()));

ALTER POLICY "sie_config_staff_write" ON public.configuracion_sistema
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_estudiantes_padre_select" ON public.estudiantes
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_estudiantes_staff_select" ON public.estudiantes
  USING ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_estudiantes_staff_update" ON public.estudiantes
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_estudiantes_staff_write" ON public.estudiantes
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_evidencias_docente_insert" ON public.evidencias_fotograficas
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_evidencias_padre_select" ON public.evidencias_fotograficas
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND (EXISTS ( SELECT 1
   FROM incidencias i
  WHERE ((i.id_incidencia = evidencias_fotograficas.id_incidencia) AND sie_padre_puede_ver_estudiante(i.id_estudiante))))));

ALTER POLICY "sie_evidencias_staff_all" ON public.evidencias_fotograficas
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_incidencias_docente_insert" ON public.incidencias
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_incidencias_docente_select" ON public.incidencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_incidencias_padre_select" ON public.incidencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_incidencias_staff_all" ON public.incidencias
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_incidencias_tutor_insert" ON public.incidencias
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_incidencias_tutor_select" ON public.incidencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_padres_est_padre_select" ON public.padres_estudiantes
  USING (((id_usuario = (SELECT public.sie_sesion_usuario_id())) AND ((SELECT public.sie_sesion_rol()) = 'Padre'::text)));

ALTER POLICY "sie_padres_est_staff_all" ON public.padres_estudiantes
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_pensiones_padre_select" ON public.pensiones
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_pensiones_staff_select" ON public.pensiones
  USING ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_pensiones_config_staff_select" ON public.pensiones_config
  USING (((SELECT public.sie_es_staff_sesion()) OR ((SELECT public.sie_sesion_rol()) = 'Tutor'::text)));

ALTER POLICY "sie_pensiones_log_staff_select" ON public.pensiones_import_log
  USING ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_personal_tutor_sel" ON public.personal
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_personal_horario_tutor_sel" ON public.personal_horario
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_llegada_docente_insert" ON public.registros_llegada
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion()) AND _sie_docente_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_llegada_docente_select" ON public.registros_llegada
  USING ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion()) AND _sie_docente_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_llegada_docente_update" ON public.registros_llegada
  USING ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion()) AND _sie_docente_puede_ver_estudiante(id_estudiante)))
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Docente'::text) AND (SELECT public.sie_tiene_sesion()) AND _sie_docente_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_llegada_padre_select" ON public.registros_llegada
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_llegada_staff_all" ON public.registros_llegada
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_llegada_tutor_insert" ON public.registros_llegada
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_llegada_tutor_select" ON public.registros_llegada
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_llegada_tutor_update" ON public.registros_llegada
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())))
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_registros_llegada_personal_tutor_ins" ON public.registros_llegada_personal
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_registros_llegada_personal_tutor_sel" ON public.registros_llegada_personal
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_registros_llegada_personal_tutor_upd" ON public.registros_llegada_personal
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())))
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_asist_padre_sel" ON public.taller_asistencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_taller_asist_tutor_ins" ON public.taller_asistencias
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_asist_tutor_sel" ON public.taller_asistencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_asist_tutor_upd" ON public.taller_asistencias
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())))
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_asistencias_staff_all" ON public.taller_asistencias
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_taller_inscritos_staff_all" ON public.taller_inscritos
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_taller_inscritos_tutor_select" ON public.taller_inscritos
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_llegadas_padre_sel" ON public.taller_llegadas
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND sie_padre_puede_ver_estudiante(id_estudiante)));

ALTER POLICY "sie_taller_llegadas_staff_all" ON public.taller_llegadas
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_taller_llegadas_tutor_ins" ON public.taller_llegadas
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_llegadas_tutor_sel" ON public.taller_llegadas
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_taller_llegadas_tutor_upd" ON public.taller_llegadas
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())))
  WITH CHECK ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_talleres_padre_sel" ON public.talleres
  USING ((((SELECT public.sie_sesion_rol()) = 'Padre'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_talleres_staff_all" ON public.talleres
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));

ALTER POLICY "sie_talleres_tutor_select" ON public.talleres
  USING ((((SELECT public.sie_sesion_rol()) = 'Tutor'::text) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_usuarios_self_select" ON public.usuarios
  USING (((id_usuario = (SELECT public.sie_sesion_usuario_id())) AND (SELECT public.sie_tiene_sesion())));

ALTER POLICY "sie_usuarios_staff_all" ON public.usuarios
  USING ((SELECT public.sie_es_staff_sesion()))
  WITH CHECK ((SELECT public.sie_es_staff_sesion()));
COMMIT;
