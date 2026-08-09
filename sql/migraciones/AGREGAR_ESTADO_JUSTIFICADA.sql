-- ============================================================================
-- AGREGAR ESTADO "Justificada" AL ENUM estado_incidencia
-- ============================================================================
-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor en DOS PASOS
-- ============================================================================
-- PASO 1: Ejecutar SOLO esta línea primero (sin las demás)
-- ============================================================================

ALTER TYPE estado_incidencia ADD VALUE IF NOT EXISTS 'Justificada';

-- ============================================================================
-- PASO 2: Después de ejecutar el PASO 1, ESPERAR unos segundos y luego
-- ejecutar esta consulta para verificar que se agregó correctamente:
-- ============================================================================

-- Verificar que se agregó correctamente (ejecutar después del PASO 1)
SELECT unnest(enum_range(NULL::estado_incidencia)) AS estados_disponibles;

-- ============================================================================
-- SOLUCIÓN ALTERNATIVA (Si el método anterior no funciona):
-- ============================================================================
-- Si tienes problemas, puedes ejecutar cada comando por separado:
-- 
-- 1. Primero ejecutar SOLO:
--    ALTER TYPE estado_incidencia ADD VALUE IF NOT EXISTS 'Justificada';
--
-- 2. Esperar 2-3 segundos
--
-- 3. Luego ejecutar la verificación:
--    SELECT unnest(enum_range(NULL::estado_incidencia)) AS estados_disponibles;
-- ============================================================================

-- ============================================================================
-- NOTA: Si necesitas agregar un campo específico para motivo de justificación
-- (separado de motivo_anulacion), puedes ejecutar después:
-- ============================================================================

-- Opcional: Agregar campo para motivo de justificación
-- ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS motivo_justificacion TEXT;
-- ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS id_usuario_justificacion INTEGER REFERENCES usuarios(id_usuario);
-- ALTER TABLE incidencias ADD COLUMN IF NOT EXISTS fecha_justificacion TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- Si prefieres usar el campo motivo_anulacion también para justificaciones,
-- no necesitas agregar campos adicionales, solo cambiar el estado a 'Justificada'
-- ============================================================================

