-- Script para agregar campos de salida a la tabla registros_llegada
-- y crear las relaciones necesarias

-- 1. Agregar columnas de salida si no existen
ALTER TABLE public.registros_llegada
ADD COLUMN IF NOT EXISTS hora_salida TIME,
ADD COLUMN IF NOT EXISTS registrado_salida_por INTEGER,
ADD COLUMN IF NOT EXISTS fecha_salida TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tipo_salida VARCHAR(20) CHECK (tipo_salida IN ('Normal', 'Autorizada', 'Sin registro'));

-- 2. Crear la clave foránea para registrado_salida_por
-- Primero eliminar la constraint si existe (por si acaso)
ALTER TABLE public.registros_llegada
DROP CONSTRAINT IF EXISTS registros_llegada_registrado_salida_por_fkey;

-- Crear la clave foránea
ALTER TABLE public.registros_llegada
ADD CONSTRAINT registros_llegada_registrado_salida_por_fkey
FOREIGN KEY (registrado_salida_por)
REFERENCES public.usuarios(id_usuario)
ON DELETE SET NULL;

-- 3. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_registros_llegada_hora_salida 
ON public.registros_llegada(hora_salida) 
WHERE hora_salida IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registros_llegada_tipo_salida 
ON public.registros_llegada(tipo_salida) 
WHERE tipo_salida IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registros_llegada_sin_salida 
ON public.registros_llegada(fecha, id_estudiante) 
WHERE hora_salida IS NULL;

-- 4. Comentarios en las nuevas columnas
COMMENT ON COLUMN public.registros_llegada.hora_salida IS 'Hora de salida del estudiante';
COMMENT ON COLUMN public.registros_llegada.registrado_salida_por IS 'Usuario que registró la salida';
COMMENT ON COLUMN public.registros_llegada.fecha_salida IS 'Fecha y hora en que se registró la salida';
COMMENT ON COLUMN public.registros_llegada.tipo_salida IS 'Tipo de salida: Normal, Autorizada, o Sin registro';

