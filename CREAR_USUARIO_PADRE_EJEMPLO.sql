-- Usuario apoderado — solo ve datos del hijo DNI 76127901 (id_estudiante 32)
-- Requiere: AGREGAR_ROL_PADRE.sql ya ejecutado

INSERT INTO public.usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo,
  grados_asignados
) VALUES (
  'padre.humani',
  'padre123',
  'Apoderado Humani Espinoza',
  'padre.humani@colegio.local',
  'Padre'::rol_usuario,
  true,
  '{"studentIds":[32,31]}'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  rol = EXCLUDED.rol,
  grados_asignados = EXCLUDED.grados_asignados,
  activo = true;

-- Verificar vínculo
SELECT id_usuario, username, rol, grados_asignados
FROM public.usuarios
WHERE username = 'padre.humani';

SELECT id_estudiante, codigo_barras, nombre_completo, telefono_contacto
FROM public.estudiantes
WHERE id_estudiante = 32;
