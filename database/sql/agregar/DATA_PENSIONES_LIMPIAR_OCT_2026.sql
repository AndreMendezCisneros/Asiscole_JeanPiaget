-- Borra todo Octubre 2026 de pensiones (pedido del colegio, 2026-10-27).
-- Venía de una lista simple importada el 23/10 al periodo por defecto (mes actual):
-- marcaba a todos como "no pagaron" en Octubre aunque el banco no cobra Octubre todavía.
-- Respaldo en pensiones_bak_oct2026_20261027.

CREATE TABLE IF NOT EXISTS public.pensiones_bak_oct2026_20261027 AS
SELECT * FROM public.pensiones WHERE periodo = '2026-10';

CREATE TEMP TABLE tmp_oct_ids ON COMMIT DROP AS
SELECT DISTINCT id_estudiante FROM public.pensiones WHERE periodo = '2026-10';

-- El trigger trg_pensiones_refresh_estado recalcula estado_pension por fila.
DELETE FROM public.pensiones WHERE periodo = '2026-10';

-- Misma regla que la conciliación: moroso si queda algún mes impago.
UPDATE public.estudiantes e
SET estado_pension = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.pensiones p
    WHERE p.id_estudiante = e.id_estudiante AND p.pagado = 0
  ) THEN 'moroso'
  WHEN EXISTS (
    SELECT 1 FROM public.pensiones p WHERE p.id_estudiante = e.id_estudiante
  ) THEN 'al_dia'
  ELSE 'sin_dato'
END
WHERE e.id_estudiante IN (SELECT id_estudiante FROM tmp_oct_ids);

SELECT
  (SELECT count(*) FROM public.pensiones_bak_oct2026_20261027) AS respaldados,
  (SELECT count(*) FROM public.pensiones WHERE periodo = '2026-10') AS quedan_octubre,
  (SELECT count(*) FROM tmp_oct_ids) AS alumnos_afectados;
