-- Script para crear la tabla citas_padres
-- Esta tabla almacena las citas programadas con padres de familia

CREATE TABLE IF NOT EXISTS public.citas_padres (
  id_cita SERIAL PRIMARY KEY,
  id_estudiante INTEGER NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  motivo VARCHAR(255) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Confirmada', 'Reprogramada', 'Completada', 'No asistió', 'Cancelada')),
  asistencia BOOLEAN DEFAULT NULL,
  notas TEXT,
  id_usuario_creador INTEGER NOT NULL REFERENCES public.usuarios(id_usuario),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_citas_padres_estudiante ON public.citas_padres(id_estudiante);
CREATE INDEX IF NOT EXISTS idx_citas_padres_fecha ON public.citas_padres(fecha);
CREATE INDEX IF NOT EXISTS idx_citas_padres_estado ON public.citas_padres(estado);
CREATE INDEX IF NOT EXISTS idx_citas_padres_usuario_creador ON public.citas_padres(id_usuario_creador);

-- Trigger para actualizar fecha_actualizacion automáticamente
CREATE OR REPLACE FUNCTION actualizar_fecha_cita_padre()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_fecha_cita_padre
  BEFORE UPDATE ON public.citas_padres
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_cita_padre();

-- Comentarios en la tabla y columnas
COMMENT ON TABLE public.citas_padres IS 'Tabla para gestionar las citas programadas con padres de familia';
COMMENT ON COLUMN public.citas_padres.id_cita IS 'Identificador único de la cita';
COMMENT ON COLUMN public.citas_padres.id_estudiante IS 'Estudiante relacionado con la cita';
COMMENT ON COLUMN public.citas_padres.motivo IS 'Motivo de la cita con el padre';
COMMENT ON COLUMN public.citas_padres.fecha IS 'Fecha programada para la cita';
COMMENT ON COLUMN public.citas_padres.hora IS 'Hora programada para la cita';
COMMENT ON COLUMN public.citas_padres.estado IS 'Estado actual de la cita: Pendiente, Confirmada, Reprogramada, Completada, No asistió, Cancelada';
COMMENT ON COLUMN public.citas_padres.asistencia IS 'Indica si el padre asistió a la cita (true) o no (false). NULL si aún no se ha realizado';
COMMENT ON COLUMN public.citas_padres.notas IS 'Notas adicionales sobre la cita';
COMMENT ON COLUMN public.citas_padres.id_usuario_creador IS 'Usuario que creó la cita';

