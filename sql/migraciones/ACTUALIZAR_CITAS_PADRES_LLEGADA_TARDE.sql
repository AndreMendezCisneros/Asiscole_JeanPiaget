-- Script para agregar campo de llegada tarde a la tabla citas_padres
-- Ejecutar en el SQL Editor de Supabase

-- Agregar columna para registrar si llegó tarde
ALTER TABLE public.citas_padres 
ADD COLUMN IF NOT EXISTS llegada_tarde BOOLEAN DEFAULT FALSE;

-- Agregar columna para registrar la hora de llegada real
ALTER TABLE public.citas_padres 
ADD COLUMN IF NOT EXISTS hora_llegada_real TIME;

-- Comentarios
COMMENT ON COLUMN public.citas_padres.llegada_tarde IS 'Indica si el padre llegó tarde a la cita';
COMMENT ON COLUMN public.citas_padres.hora_llegada_real IS 'Hora real en que el padre llegó a la cita';

