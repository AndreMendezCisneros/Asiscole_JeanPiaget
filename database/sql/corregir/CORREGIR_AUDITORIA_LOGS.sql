-- Script para corregir la estructura de la tabla auditoria_logs
-- Ejecutar en el SQL Editor de Supabase

-- Primero, verificar la estructura actual de la tabla
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'auditoria_logs';

-- Si la tabla existe pero con columnas incorrectas, mejor recrearla
-- SOLO ejecuta el DROP si estás seguro de que no necesitas los datos existentes
-- DROP TABLE IF EXISTS public.auditoria_logs CASCADE;

-- Crear o recrear la tabla con la estructura correcta
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id_log SERIAL PRIMARY KEY,
    tabla_afectada VARCHAR(100) NOT NULL,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_id INTEGER,
    fecha_operacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON public.auditoria_logs(tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON public.auditoria_logs(operacion);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria_logs(fecha_operacion);

-- Si la tabla ya existía con datos y solo necesitas agregar/modificar columnas:
-- ALTER TABLE public.auditoria_logs ADD COLUMN IF NOT EXISTS operacion VARCHAR(20);
-- ALTER TABLE public.auditoria_logs ADD COLUMN IF NOT EXISTS tabla_afectada VARCHAR(100);
-- ALTER TABLE public.auditoria_logs ADD COLUMN IF NOT EXISTS datos_anteriores JSONB;
-- ALTER TABLE public.auditoria_logs ADD COLUMN IF NOT EXISTS datos_nuevos JSONB;
-- ALTER TABLE public.auditoria_logs ADD COLUMN IF NOT EXISTS usuario_id INTEGER;
-- ALTER TABLE public.auditoria_logs ADD COLUMN IF NOT EXISTS fecha_operacion TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Asegurarse de que la función de auditoría existe
CREATE OR REPLACE FUNCTION public.fn_auditoria_registros_llegada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.auditoria_logs(tabla_afectada, operacion, datos_anteriores, datos_nuevos)
        VALUES ('registros_llegada', 'INSERT', NULL, row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.auditoria_logs(tabla_afectada, operacion, datos_anteriores, datos_nuevos)
        VALUES ('registros_llegada', 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.auditoria_logs(tabla_afectada, operacion, datos_anteriores, datos_nuevos)
        VALUES ('registros_llegada', 'DELETE', row_to_json(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trg_auditoria_registros_llegada ON public.registros_llegada;

CREATE TRIGGER trg_auditoria_registros_llegada
AFTER INSERT OR UPDATE OR DELETE ON public.registros_llegada
FOR EACH ROW
EXECUTE FUNCTION public.fn_auditoria_registros_llegada();

-- Verificar que todo esté correcto
SELECT 
    t.table_name,
    t.trigger_name,
    t.event_manipulation,
    t.action_timing
FROM information_schema.triggers t
WHERE t.event_object_table = 'registros_llegada'
ORDER BY t.trigger_name;
