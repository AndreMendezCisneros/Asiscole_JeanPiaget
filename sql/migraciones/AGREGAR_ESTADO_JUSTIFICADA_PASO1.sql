-- ============================================================================
-- PASO 1: Agregar estado "Justificada" al enum
-- ============================================================================
-- Ejecutar SOLO este comando primero
-- Esperar 2-3 segundos antes de ejecutar el PASO 2
-- ============================================================================

ALTER TYPE estado_incidencia ADD VALUE IF NOT EXISTS 'Justificada';

