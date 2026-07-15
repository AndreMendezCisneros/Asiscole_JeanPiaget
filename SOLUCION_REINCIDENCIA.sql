-- ============================================================================
-- SOLUCIÓN: Recalcular Niveles de Reincidencia
-- ============================================================================
-- Este script corrige el problema donde las incidencias tienen nivel_reincidencia = 0
-- cuando deberían tener un nivel mayor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 1: Verificar si existe configuración activa
-- ----------------------------------------------------------------------------
SELECT 
  'Verificando configuración...' AS paso,
  COUNT(*) AS configuraciones_activas
FROM configuracion_reincidencia 
WHERE activo = TRUE;

-- Si el resultado es 0, ejecuta el PASO 2
-- Si el resultado es > 0, salta al PASO 3

-- ----------------------------------------------------------------------------
-- PASO 2: Crear configuración de reincidencia (SOLO si no existe)
-- ----------------------------------------------------------------------------
-- Descomenta y ejecuta si no hay configuración activa:

/*
INSERT INTO configuracion_reincidencia (
  ventana_dias,
  puntos_falta_leve,
  puntos_falta_grave,
  umbral_nivel_1,
  umbral_nivel_2,
  umbral_nivel_3,
  umbral_nivel_4,
  umbral_nivel_5,
  activo,
  fecha_vigencia
) VALUES (
  60,  -- Ventana de 60 días
  1,   -- 1 punto por falta leve
  2,   -- 2 puntos por falta grave
  1,   -- Nivel 1: 1 punto
  3,   -- Nivel 2: 3 puntos
  5,   -- Nivel 3: 5 puntos
  8,   -- Nivel 4: 8 puntos
  12,  -- Nivel 5: 12 puntos
  TRUE,
  NOW()
);
*/

-- ----------------------------------------------------------------------------
-- PASO 3: Verificar que el trigger existe
-- ----------------------------------------------------------------------------
SELECT 
  'Verificando trigger...' AS paso,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_incidencias_calcular_nivel';

-- Si no existe, ejecuta:
/*
CREATE TRIGGER trigger_incidencias_calcular_nivel
    BEFORE INSERT ON incidencias
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calcular_nivel_reincidencia();
*/

-- ----------------------------------------------------------------------------
-- PASO 4: Recalcular niveles para TODAS las incidencias activas
-- ----------------------------------------------------------------------------
-- IMPORTANTE: Esto actualizará el nivel_reincidencia de todas las incidencias
-- basándose en la configuración activa actual

UPDATE incidencias
SET nivel_reincidencia = calcular_nivel_reincidencia(
  id_estudiante, 
  fecha_hora_registro
)
WHERE estado = 'Activa';

-- Verificar cuántas se actualizaron
SELECT 
  'Incidencias actualizadas' AS resultado,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE nivel_reincidencia > 0) AS con_reincidencia,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 0) AS sin_reincidencia
FROM incidencias
WHERE estado = 'Activa';

-- ----------------------------------------------------------------------------
-- PASO 5: Verificar el estudiante específico (Jeremi - ID 31)
-- ----------------------------------------------------------------------------
SELECT 
  e.nombre_completo,
  e.codigo_barras,
  COUNT(i.id_incidencia) AS total_incidencias,
  COUNT(i.id_incidencia) FILTER (WHERE i.estado = 'Activa') AS incidencias_activas,
  MAX(i.nivel_reincidencia) AS nivel_maximo,
  calcular_nivel_reincidencia(e.id_estudiante, NOW()) AS nivel_actual_calculado
FROM estudiantes e
LEFT JOIN incidencias i ON e.id_estudiante = i.id_estudiante
WHERE e.id_estudiante = 31
GROUP BY e.id_estudiante, e.nombre_completo, e.codigo_barras;

-- Ver detalle de incidencias del estudiante
SELECT 
  i.id_incidencia,
  i.fecha_hora_registro,
  cf.nombre_falta,
  cf.es_grave,
  i.nivel_reincidencia,
  i.estado
FROM incidencias i
INNER JOIN catalogo_faltas cf ON i.id_falta = cf.id_falta
WHERE i.id_estudiante = 31
  AND i.estado = 'Activa'
ORDER BY i.fecha_hora_registro DESC;

-- ----------------------------------------------------------------------------
-- PASO 6: Verificar configuración actual
-- ----------------------------------------------------------------------------
SELECT 
  ventana_dias,
  puntos_falta_leve,
  puntos_falta_grave,
  umbral_nivel_1,
  umbral_nivel_2,
  umbral_nivel_3,
  umbral_nivel_4,
  umbral_nivel_5,
  activo
FROM configuracion_reincidencia
WHERE activo = TRUE;

-- ============================================================================
-- NOTA IMPORTANTE
-- ============================================================================
-- La función calcular_nivel_reincidencia() usa:
-- - puntos_falta_leve de la configuración (NO puntos_reincidencia de cada falta)
-- - puntos_falta_grave de la configuración
-- 
-- Si tus faltas tienen puntos_reincidencia diferentes (1, 2, 3), pero la
-- configuración dice puntos_falta_leve = 1, entonces todas las faltas leves
-- contarán como 1 punto, independientemente de su puntos_reincidencia.
--
-- Si necesitas usar los puntos_reincidencia de cada falta individual,
-- necesitarías modificar la función calcular_nivel_reincidencia().
-- ============================================================================

