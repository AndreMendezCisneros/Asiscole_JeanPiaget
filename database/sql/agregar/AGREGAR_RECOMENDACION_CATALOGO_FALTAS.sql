-- =============================================================================
-- Corregir recomendaciones WhatsApp — catálogo real I.E. San Ramón
-- Ejecutar en Supabase → SQL Editor → Run
-- (sobrescribe textos mal asignados por id antiguos)
-- =============================================================================

UPDATE public.catalogo_faltas SET recomendacion =
  'Asegurar que el estudiante asista con el uniforme oficial del día. Reservar el buzo solo para las actividades deportivas autorizadas.'
WHERE id_falta = 1;

UPDATE public.catalogo_faltas SET recomendacion =
  'Verificar cada mañana que porte el polo institucional completo. Revisar juntos el reglamento de presentación personal.'
WHERE id_falta = 2;

UPDATE public.catalogo_faltas SET recomendacion =
  'Usar únicamente el calzado reglamentario del colegio. Revisar el calzado la noche anterior para evitar sanciones.'
WHERE id_falta = 3;

UPDATE public.catalogo_faltas SET recomendacion =
  'Acordar un corte o peinado acorde a la normativa institucional. Revisar juntos el reglamento de presentación personal.'
WHERE id_falta = 4;

UPDATE public.catalogo_faltas SET recomendacion =
  'Ajustar el peinado según el reglamento del colegio antes de salir de casa. Reforzar el cuidado de la presentación personal.'
WHERE id_falta = 5;

UPDATE public.catalogo_faltas SET recomendacion =
  'Establecer una rutina de salida más temprana. Conversar sobre la puntualidad y avisar a tutoría si hay dificultades de traslado.'
WHERE id_falta = 6;

UPDATE public.catalogo_faltas SET recomendacion =
  'Retirar prendas no autorizadas y vestir solo lo permitido por el reglamento. Revisar la mochila y la vestimenta antes de salir.'
WHERE id_falta = 7;

UPDATE public.catalogo_faltas SET recomendacion =
  'Respetar la normativa sobre maquillaje en el colegio. Conversar en casa sobre presentación personal y acuerdos institucionales.'
WHERE id_falta = 8;

UPDATE public.catalogo_faltas SET recomendacion =
  'Mantener uñas según la normativa (largo y color permitidos). Revisar el cuidado personal antes de asistir a clases.'
WHERE id_falta = 9;

UPDATE public.catalogo_faltas SET recomendacion =
  'Portar siempre el carné institucional visible. Guardarlo en un lugar fijo de la mochila o uniforme para no olvidarlo.'
WHERE id_falta = 10;

-- Verificación
SELECT id_falta, nombre_falta, categoria, es_grave,
       left(recomendacion, 100) AS recomendacion_preview
FROM public.catalogo_faltas
ORDER BY id_falta;
