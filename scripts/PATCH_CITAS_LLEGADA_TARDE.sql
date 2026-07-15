-- =====================================================================
-- PATCH: Añadir columnas llegada_tarde y hora_llegada_real a citas_padres
-- Ejecutar en: Supabase → SQL Editor
-- =====================================================================

ALTER TABLE public.citas_padres
  ADD COLUMN IF NOT EXISTS llegada_tarde     BOOLEAN     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hora_llegada_real TIME        DEFAULT NULL;

-- Índice para buscar asistentes con llegada tardía
CREATE INDEX IF NOT EXISTS idx_citas_padres_llegada_tarde
  ON public.citas_padres (llegada_tarde)
  WHERE llegada_tarde = TRUE;

-- Verificar resultado
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'citas_padres'
  AND column_name IN ('llegada_tarde', 'hora_llegada_real', 'asistencia')
ORDER BY column_name;
