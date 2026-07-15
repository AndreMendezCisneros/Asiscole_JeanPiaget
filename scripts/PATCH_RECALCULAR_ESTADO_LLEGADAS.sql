-- Recalcula estado de llegadas según nivel (Primaria 08:00 / Secundaria 07:30 por defecto en config).
-- Ejecutar una vez tras corregir el escáner tutor (tutores no podían leer nivel_educativo por RLS).

UPDATE public.registros_llegada rl
SET estado = CASE
  WHEN left(rl.hora_llegada::text, 5)::time > (
    COALESCE(
      (
        SELECT left(cs.valor::text, 5)::time
        FROM public.configuracion_sistema cs
        WHERE cs.clave = CASE
          WHEN e.nivel_educativo::text ILIKE '%sec%' THEN 'hora_limite_llegada_secundaria'
          ELSE 'hora_limite_llegada_primaria'
        END
        LIMIT 1
      ),
      (
        SELECT left(cs.valor::text, 5)::time
        FROM public.configuracion_sistema cs
        WHERE cs.clave = 'hora_limite_llegada'
        LIMIT 1
      ),
      '08:00'::time
    )
  ) THEN 'Tarde'
  ELSE 'A tiempo'
END
FROM public.estudiantes e
WHERE e.id_estudiante = rl.id_estudiante
  AND rl.fecha = (timezone('America/Lima', now()))::date;
