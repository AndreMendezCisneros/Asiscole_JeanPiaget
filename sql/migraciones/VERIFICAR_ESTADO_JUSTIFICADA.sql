-- ============================================================================
-- VERIFICACIÓN SIMPLE: Ver todos los estados disponibles
-- ============================================================================
-- Ejecutar este script para ver todos los valores del enum
-- ============================================================================

-- Listar todos los estados del enum
SELECT 
  unnest(enum_range(NULL::estado_incidencia)) AS estados_disponibles
ORDER BY estados_disponibles;

-- Si ves "Justificada" en la lista, el estado se agregó correctamente
-- Si NO ves "Justificada", ejecuta el PASO 1 nuevamente

