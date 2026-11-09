-- Jean Piaget: el control del personal empieza oficialmente el 2026-11-09.
-- Reportes y cron cuentan faltas desde personal.fecha_creacion; se fija esa fecha
-- al inicio oficial para que 1–8 nov no salgan como faltas. Respaldo previo.
CREATE TABLE IF NOT EXISTS personal_bak_fecha_creacion_20261109 AS
  SELECT id_personal, fecha_creacion FROM personal;
UPDATE personal SET fecha_creacion = TIMESTAMPTZ '2026-11-09 00:00:00 America/Lima'
WHERE fecha_creacion < TIMESTAMPTZ '2026-11-09 00:00:00 America/Lima';
SELECT count(*) respaldados FROM personal_bak_fecha_creacion_20261109;
SELECT min(fecha_creacion), max(fecha_creacion), count(*) FROM personal;
\echo '--- simulacion del cron tras el cambio (sabado 7 ya no debe marcarse)'
SELECT * FROM sie_jp_marcar_faltas_personal_pendientes();
