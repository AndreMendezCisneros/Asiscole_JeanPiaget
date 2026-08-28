-- ============================================================================
-- SOLUCIÓN COMPLETA: Corregir Sistema de Reincidencia
-- ============================================================================
-- Este script corrige el problema donde todas las incidencias tienen
-- nivel_reincidencia = 0 cuando deberían tener niveles mayores
-- ============================================================================
-- EJECUTAR TODO ESTE SCRIPT EN EL SQL EDITOR DE SUPABASE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 1: Verificar y crear configuración de reincidencia
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_config_count INTEGER;
BEGIN
    -- Verificar si existe configuración activa
    SELECT COUNT(*) INTO v_config_count
    FROM configuracion_reincidencia
    WHERE activo = TRUE;
    
    -- Si no existe, crearla
    IF v_config_count = 0 THEN
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
            1,   -- 1 punto por falta leve (valor por defecto, no se usará)
            2,   -- 2 puntos por falta grave (valor por defecto, no se usará)
            1,   -- Nivel 1: 1 punto
            3,   -- Nivel 2: 3 puntos
            5,   -- Nivel 3: 5 puntos
            8,   -- Nivel 4: 8 puntos
            12,  -- Nivel 5: 12 puntos
            TRUE,
            NOW()
        );
        
        RAISE NOTICE 'Configuración de reincidencia creada';
    ELSE
        RAISE NOTICE 'Configuración de reincidencia ya existe';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- PASO 2: Modificar función para usar puntos_reincidencia individuales
-- ----------------------------------------------------------------------------
-- IMPORTANTE: Esta versión usa los puntos_reincidencia de cada falta
-- en lugar de puntos_falta_leve/grave de la configuración

CREATE OR REPLACE FUNCTION calcular_nivel_reincidencia(
    p_id_estudiante INTEGER,
    p_fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS INTEGER AS $$
DECLARE
    v_config RECORD;
    v_puntos_totales INTEGER := 0;
    v_nivel INTEGER := 0;
    v_fecha_inicio TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Obtener configuración activa
    SELECT * INTO v_config
    FROM configuracion_reincidencia
    WHERE activo = TRUE
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Si no hay configuración, retornar 0
        RETURN 0;
    END IF;
    
    -- Calcular fecha de inicio de la ventana
    v_fecha_inicio := p_fecha_registro - (v_config.ventana_dias || ' days')::INTERVAL;
    
    -- MODIFICACIÓN: Usar puntos_reincidencia de cada falta individual
    -- Esto permite que cada falta tenga su propio valor de puntos
    SELECT COALESCE(SUM(cf.puntos_reincidencia), 0) INTO v_puntos_totales
    FROM incidencias i
    INNER JOIN catalogo_faltas cf ON i.id_falta = cf.id_falta
    WHERE i.id_estudiante = p_id_estudiante
        AND i.estado = 'Activa'
        AND i.fecha_hora_registro >= v_fecha_inicio
        AND i.fecha_hora_registro < p_fecha_registro;
    
    -- Determinar nivel según umbrales
    IF v_puntos_totales >= v_config.umbral_nivel_5 THEN
        v_nivel := 5;
    ELSIF v_puntos_totales >= v_config.umbral_nivel_4 THEN
        v_nivel := 4;
    ELSIF v_puntos_totales >= v_config.umbral_nivel_3 THEN
        v_nivel := 3;
    ELSIF v_puntos_totales >= v_config.umbral_nivel_2 THEN
        v_nivel := 2;
    ELSIF v_puntos_totales >= v_config.umbral_nivel_1 THEN
        v_nivel := 1;
    ELSE
        v_nivel := 0;
    END IF;
    
    RETURN v_nivel;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- PASO 3: Verificar y crear trigger si no existe
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Verificar si el trigger existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trigger_incidencias_calcular_nivel'
    ) THEN
        -- Crear trigger
        CREATE TRIGGER trigger_incidencias_calcular_nivel
            BEFORE INSERT ON incidencias
            FOR EACH ROW
            EXECUTE FUNCTION trigger_calcular_nivel_reincidencia();
        
        RAISE NOTICE 'Trigger creado';
    ELSE
        RAISE NOTICE 'Trigger ya existe';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- PASO 4: Recalcular niveles para TODAS las incidencias activas
-- ----------------------------------------------------------------------------
-- Esto actualizará el nivel_reincidencia de todas las incidencias existentes

UPDATE incidencias
SET nivel_reincidencia = calcular_nivel_reincidencia(
    id_estudiante, 
    fecha_hora_registro
)
WHERE estado = 'Activa';

-- Mostrar resumen de actualización
SELECT 
    'Resumen de actualización' AS descripcion,
    COUNT(*) AS total_incidencias_activas,
    COUNT(*) FILTER (WHERE nivel_reincidencia = 0) AS nivel_0,
    COUNT(*) FILTER (WHERE nivel_reincidencia = 1) AS nivel_1,
    COUNT(*) FILTER (WHERE nivel_reincidencia = 2) AS nivel_2,
    COUNT(*) FILTER (WHERE nivel_reincidencia = 3) AS nivel_3,
    COUNT(*) FILTER (WHERE nivel_reincidencia = 4) AS nivel_4,
    COUNT(*) FILTER (WHERE nivel_reincidencia = 5) AS nivel_5
FROM incidencias
WHERE estado = 'Activa';

-- ----------------------------------------------------------------------------
-- PASO 5: Verificar estudiante específico (Jeremi - código 70391919)
-- ----------------------------------------------------------------------------
SELECT 
    'Verificación del estudiante' AS descripcion,
    e.nombre_completo,
    e.codigo_barras,
    COUNT(i.id_incidencia) AS total_incidencias,
    COUNT(i.id_incidencia) FILTER (WHERE i.estado = 'Activa') AS incidencias_activas,
    SUM(cf.puntos_reincidencia) FILTER (WHERE i.estado = 'Activa') AS puntos_totales,
    MAX(i.nivel_reincidencia) FILTER (WHERE i.estado = 'Activa') AS nivel_maximo_incidencia,
    calcular_nivel_reincidencia(e.id_estudiante, NOW()) AS nivel_actual_calculado
FROM estudiantes e
LEFT JOIN incidencias i ON e.id_estudiante = i.id_estudiante
LEFT JOIN catalogo_faltas cf ON i.id_falta = cf.id_falta
WHERE e.codigo_barras = '70391919'
GROUP BY e.id_estudiante, e.nombre_completo, e.codigo_barras;

-- ----------------------------------------------------------------------------
-- PASO 6: Mostrar detalle de incidencias del estudiante con niveles corregidos
-- ----------------------------------------------------------------------------
SELECT 
    i.id_incidencia,
    i.fecha_hora_registro::date AS fecha,
    TO_CHAR(i.fecha_hora_registro, 'HH24:MI:SS') AS hora,
    cf.nombre_falta,
    cf.puntos_reincidencia,
    cf.es_grave,
    i.nivel_reincidencia AS nivel_calculado,
    i.estado
FROM incidencias i
INNER JOIN catalogo_faltas cf ON i.id_falta = cf.id_falta
INNER JOIN estudiantes e ON i.id_estudiante = e.id_estudiante
WHERE e.codigo_barras = '70391919'
  AND i.estado = 'Activa'
ORDER BY i.fecha_hora_registro DESC;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- Después de ejecutar este script:
-- 1. Vuelve a ejecutar: verificarEstudiante("70391919") en la consola
-- 2. Deberías ver niveles de reincidencia > 0
-- 3. El estudiante debería tener nivel 5 (con 56 puntos)
-- ============================================================================

