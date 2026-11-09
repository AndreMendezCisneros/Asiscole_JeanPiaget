-- Jean Piaget: borra los datos de PRUEBA del módulo Personal antes del uso oficial (2026-11-09).
-- Asistencias, incidencias, taller y avisos encolados del personal quedan en 0.
-- No toca la lista de personal ni sus horarios.
-- Respaldo en tablas personal_bak_*_20261108 (misma BD). Aplicar una sola vez.

CREATE TABLE public.personal_bak_llegadas_20261108    AS SELECT * FROM public.registros_llegada_personal;
CREATE TABLE public.personal_bak_incidencias_20261108 AS SELECT * FROM public.incidencias_personal;
CREATE TABLE public.personal_bak_taller_20261108      AS SELECT * FROM public.personal_taller;
CREATE TABLE public.personal_bak_outbox_20261108      AS SELECT * FROM public.asis_outbox WHERE tipo LIKE 'personal_%';

-- Las tablas de respaldo no deben ser visibles por la API.
ALTER TABLE public.personal_bak_llegadas_20261108    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bak_incidencias_20261108 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bak_taller_20261108      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_bak_outbox_20261108      ENABLE ROW LEVEL SECURITY;

DELETE FROM public.asis_outbox WHERE tipo LIKE 'personal_%';
DELETE FROM public.incidencias_personal;
DELETE FROM public.personal_taller;
DELETE FROM public.registros_llegada_personal;

SELECT 'llegadas' AS tabla, count(*) FROM public.registros_llegada_personal
UNION ALL SELECT 'incidencias', count(*) FROM public.incidencias_personal
UNION ALL SELECT 'taller', count(*) FROM public.personal_taller
UNION ALL SELECT 'outbox_personal', count(*) FROM public.asis_outbox WHERE tipo LIKE 'personal_%'
UNION ALL SELECT 'respaldo_llegadas', count(*) FROM public.personal_bak_llegadas_20261108
UNION ALL SELECT 'respaldo_incidencias', count(*) FROM public.personal_bak_incidencias_20261108
UNION ALL SELECT 'respaldo_taller', count(*) FROM public.personal_bak_taller_20261108
UNION ALL SELECT 'respaldo_outbox', count(*) FROM public.personal_bak_outbox_20261108;
