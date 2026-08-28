-- Segundo hijo de prueba para padre.humani (nick id 32 + alumno id 31)
-- Ejecutar en Supabase SQL Editor
-- No requiere la tabla padres_estudiantes (usa grados_asignados en usuarios)

UPDATE public.usuarios
SET grados_asignados = '{"studentIds":[32,31]}'::jsonb
WHERE username = 'padre.humani';

-- Verificar usuario y alumnos vinculados
SELECT u.id_usuario, u.username, u.grados_asignados
FROM public.usuarios u
WHERE u.username = 'padre.humani';

SELECT e.id_estudiante, e.codigo_barras, e.nombre_completo, e.grado, e.seccion
FROM public.usuarios u
CROSS JOIN LATERAL jsonb_array_elements_text(u.grados_asignados -> 'studentIds') AS sid(val)
JOIN public.estudiantes e ON e.id_estudiante = (sid.val)::integer
WHERE u.username = 'padre.humani'
ORDER BY e.id_estudiante;

-- ── Opcional: si más adelante quiere la tabla de vínculos, ejecute antes CREAR_PADRES_ESTUDIANTES.sql
-- y luego descomente lo siguiente:
/*
INSERT INTO public.padres_estudiantes (id_usuario, id_estudiante, parentesco, es_principal)
SELECT u.id_usuario, 32, 'Apoderado', true
FROM public.usuarios u WHERE u.username = 'padre.humani'
ON CONFLICT (id_usuario, id_estudiante) DO NOTHING;

INSERT INTO public.padres_estudiantes (id_usuario, id_estudiante, parentesco, es_principal)
SELECT u.id_usuario, 31, 'Apoderado', false
FROM public.usuarios u WHERE u.username = 'padre.humani'
ON CONFLICT (id_usuario, id_estudiante) DO NOTHING;
*/
