-- Usuario Cajero — solo Pensiones y Configuración de pensiones
-- Requiere: AGREGAR_ROL_CAJERO.sql ya ejecutado
-- Reemplace username, password_hash (bcrypt) y nombre antes de ejecutar en producción.
-- NO suba contraseñas en texto plano ni hashes de producción a git.

INSERT INTO public.usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo,
  grados_asignados
) VALUES (
  'cajero',
  '<REEMPLAZAR_CON_HASH_BCRYPT>',
  'Cajero pensiones',
  'cajero@colegio.local',
  'Cajero'::rol_usuario,
  true,
  '{}'::jsonb
)
ON CONFLICT (username) DO UPDATE SET
  rol = EXCLUDED.rol,
  activo = true,
  nombre_completo = EXCLUDED.nombre_completo;

SELECT id_usuario, username, rol, activo
FROM public.usuarios
WHERE username = 'cajero';
