-- ============================================================================
-- SOLUCIÓN ALTERNATIVA: Usar puntos_reincidencia de cada falta
-- ============================================================================
-- Si quieres que el sistema use los puntos_reincidencia de cada falta
-- individual (en lugar de puntos_falta_leve/grave de la configuración),
-- necesitas modificar la función calcular_nivel_reincidencia()
-- ============================================================================

-- Función modificada que usa puntos_reincidencia de cada falta
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
    
    -- MODIFICACIÓN: Usar puntos_reincidencia de cada falta en lugar de puntos de configuración
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

-- Recalcular todas las incidencias con la nueva función
UPDATE incidencias
SET nivel_reincidencia = calcular_nivel_reincidencia(
  id_estudiante, 
  fecha_hora_registro
)
WHERE estado = 'Activa';

-- Verificar resultado
SELECT 
  'Resultado después de corrección' AS estado,
  COUNT(*) AS total_incidencias,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 0) AS nivel_0,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 1) AS nivel_1,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 2) AS nivel_2,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 3) AS nivel_3,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 4) AS nivel_4,
  COUNT(*) FILTER (WHERE nivel_reincidencia = 5) AS nivel_5
FROM incidencias
WHERE estado = 'Activa';

