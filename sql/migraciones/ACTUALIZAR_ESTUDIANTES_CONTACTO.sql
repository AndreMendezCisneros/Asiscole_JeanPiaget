-- Script para agregar campos de contacto familiar a la tabla estudiantes

-- Agregar columnas de contacto si no existen
ALTER TABLE public.estudiantes
ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(20),
ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(255),
ADD COLUMN IF NOT EXISTS nombre_responsable VARCHAR(255),
ADD COLUMN IF NOT EXISTS parentesco_responsable VARCHAR(50),
ADD COLUMN IF NOT EXISTS telefono_emergencia VARCHAR(20);

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_estudiantes_telefono_contacto 
ON public.estudiantes(telefono_contacto) 
WHERE telefono_contacto IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estudiantes_email_contacto 
ON public.estudiantes(email_contacto) 
WHERE email_contacto IS NOT NULL;

-- Comentarios en las nuevas columnas
COMMENT ON COLUMN public.estudiantes.telefono_contacto IS 'Teléfono de contacto del padre/madre/apoderado';
COMMENT ON COLUMN public.estudiantes.email_contacto IS 'Email de contacto del padre/madre/apoderado';
COMMENT ON COLUMN public.estudiantes.nombre_responsable IS 'Nombre completo del responsable (padre/madre/apoderado)';
COMMENT ON COLUMN public.estudiantes.parentesco_responsable IS 'Parentesco del responsable (Padre, Madre, Apoderado, etc.)';
COMMENT ON COLUMN public.estudiantes.telefono_emergencia IS 'Teléfono de emergencia adicional';

