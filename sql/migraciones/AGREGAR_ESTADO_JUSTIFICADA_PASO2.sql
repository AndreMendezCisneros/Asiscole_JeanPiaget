-- ============================================================================
-- PASO 2: Verificar que el estado se agregó correctamente
-- ============================================================================
-- Ejecutar este comando DESPUÉS del PASO 1 (esperar 2-3 segundos)
-- ============================================================================

-- Verificar estados disponibles (método seguro)
SELECT 
  unnest(enum_range(NULL::estado_incidencia)) AS estados_disponibles
ORDER BY estados_disponibles;

-- Verificar de manera segura si "Justificada" está en la lista
-- (sin intentar usar el valor directamente)
SELECT 
  string_agg(estado::text, ', ') AS todos_los_estados,
  CASE 
    WHEN string_agg(estado::text, ', ') LIKE '%Justificada%'
    THEN '✅ Estado "Justificada" agregado correctamente'
    ELSE '❌ Error: Estado "Justificada" no encontrado. Ejecute el PASO 1 nuevamente.'
  END AS resultado
FROM (
  SELECT unnest(enum_range(NULL::estado_incidencia)) AS estado
) AS estados;

