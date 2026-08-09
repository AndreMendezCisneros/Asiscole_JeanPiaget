-- Actualizar teléfono de contacto — DNI/código 76127901
-- Estudiante: nick Humani Espinoza

UPDATE public.estudiantes
SET
  telefono_contacto = '947854586',
  fecha_actualizacion = NOW()
WHERE codigo_barras = '76127901';

-- Verificar
SELECT id_estudiante, nombre_completo, codigo_barras, telefono_contacto
FROM public.estudiantes
WHERE codigo_barras = '76127901';
