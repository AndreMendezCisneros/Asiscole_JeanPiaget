-- ============================================================================
-- SOLUCIÓN COMPLETA: Agregar estado "Justificada" al enum
-- ============================================================================
-- IMPORTANTE: En Supabase, ejecuta este script COMPLETO de una vez
-- Si da error, ejecuta el PASO 1 y PASO 2 por separado
-- ============================================================================

-- PASO 1: Agregar el valor al enum
ALTER TYPE estado_incidencia ADD VALUE IF NOT EXISTS 'Justificada';

-- ============================================================================
-- NOTA: Después de ejecutar el comando anterior:
-- 1. Espera 2-3 segundos
-- 2. Ejecuta el script VERIFICAR_ESTADO_JUSTIFICADA.sql para verificar
-- 3. Si "Justificada" aparece en la lista, está listo para usar
-- ============================================================================

