# Configuración de la Base de Datos

## Estado de la Conexión

✅ **URL de Supabase configurada**: `https://spdugaykkcgpcfslcpac.supabase.co`
✅ **API Key configurada**: Clave anónima configurada en `src/lib/supabaseClient.ts`

## Pasos para Completar la Configuración

### 1. Ejecutar el Script SQL

Ejecuta el script SQL proporcionado en tu base de datos de Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **SQL Editor**
3. Pega el script completo de creación de tablas
4. Ejecuta el script

### 2. Configurar Storage Bucket para Evidencias

El sistema necesita un bucket en Supabase Storage para almacenar las fotos de evidencia:

1. Ve a **Storage** en el Dashboard de Supabase
2. Crea un nuevo bucket llamado `evidencias`
3. Configura las políticas de acceso:

```sql
-- Política para permitir lectura pública de evidencias
CREATE POLICY "Evidencias son públicas para lectura"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidencias');

-- Política para permitir inserción a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden subir evidencias"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'evidencias' 
  AND auth.role() = 'authenticated'
);

-- Política para permitir eliminación a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden eliminar evidencias"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'evidencias' 
  AND auth.role() = 'authenticated'
);
```

### 3. Configurar Autenticación (IMPORTANTE)

**Nota**: El servicio de autenticación actual (`authService.ts`) intenta usar una función RPC para validar contraseñas. Debes crear esta función en Supabase:

#### Crear Función RPC para Validar Contraseñas

Ejecuta este SQL en el SQL Editor de Supabase:

```sql
-- Instalar extensión pgcrypto si no está instalada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función para validar contraseña
CREATE OR REPLACE FUNCTION validar_password(
  p_username VARCHAR,
  p_password VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_password_hash VARCHAR;
BEGIN
  -- Obtener hash de contraseña del usuario
  SELECT password_hash INTO v_password_hash
  FROM usuarios
  WHERE username = p_username
    AND activo = TRUE;
  
  IF v_password_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Validar contraseña con crypt (bcrypt)
  -- Nota: Esto asume que las contraseñas están hasheadas con bcrypt
  -- Si usas otro método, ajusta esta validación
  RETURN v_password_hash = crypt(p_password, v_password_hash);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos a usuarios anónimos para usar esta función
GRANT EXECUTE ON FUNCTION validar_password TO anon;
GRANT EXECUTE ON FUNCTION validar_password TO authenticated;
```

**IMPORTANTE**: Esta función usa `crypt()` de pgcrypto. Si tus contraseñas están hasheadas con bcrypt de otra forma, deberás ajustar la validación.

#### Para Desarrollo Rápido (NO PRODUCCIÓN)

Si necesitas probar rápidamente sin bcrypt, puedes modificar temporalmente la función:

```sql
-- SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
CREATE OR REPLACE FUNCTION validar_password(
  p_username VARCHAR,
  p_password VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_password_hash VARCHAR;
BEGIN
  SELECT password_hash INTO v_password_hash
  FROM usuarios
  WHERE username = p_username
    AND activo = TRUE;
  
  IF v_password_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- COMPARACIÓN EN TEXTO PLANO - SOLO PARA DESARROLLO
  RETURN v_password_hash = p_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Crear Usuario de Prueba

Para probar el sistema, crea un usuario en la base de datos:

```sql
INSERT INTO usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo
) VALUES (
  'admin',
  -- IMPORTANTE: Reemplaza esto con un hash bcrypt de tu contraseña
  -- Puedes generar uno en: https://bcrypt-generator.com/
  '$2a$10$TuHashAqui',
  'Administrador del Sistema',
  'admin@escuela.edu',
  'Admin',
  true
);
```

### 5. Verificar Funciones RPC

Si necesitas usar funciones RPC personalizadas (como `obtener_faltas_por_grado_simple`), créalas en el SQL Editor de Supabase:

```sql
-- Ejemplo de función RPC para faltas por grado
CREATE OR REPLACE FUNCTION obtener_faltas_por_grado_simple()
RETURNS TABLE(grado VARCHAR, total INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.grado,
    COUNT(*)::INTEGER as total
  FROM incidencias i
  INNER JOIN estudiantes e ON i.id_estudiante = e.id_estudiante
  WHERE i.estado = 'Activa'
  GROUP BY e.grado
  ORDER BY e.grado;
END;
$$ LANGUAGE plpgsql;
```

## Verificación

Para verificar que todo está configurado correctamente:

1. **Probar Login**: Intenta iniciar sesión con un usuario creado
2. **Probar Dashboard**: Verifica que el dashboard carga estadísticas
3. **Probar Registro de Incidencia**: Intenta crear una incidencia de prueba
4. **Probar Subida de Evidencias**: Verifica que puedes subir una foto

## Estructura de Servicios Creados

Todos los servicios están en `src/lib/services/`:

- ✅ `authService.ts` - Autenticación y sesión
- ✅ `studentsService.ts` - Gestión de estudiantes
- ✅ `faultsService.ts` - Catálogo de faltas
- ✅ `incidentsService.ts` - Incidencias
- ✅ `evidenceService.ts` - Evidencias fotográficas
- ✅ `commentsService.ts` - Comentarios
- ✅ `dashboardService.ts` - Dashboard y reportes

## Notas Importantes

1. **Validación de Contraseñas**: El servicio actual NO valida contraseñas con bcrypt en el cliente. Debes implementar esto antes de producción.

2. **Políticas RLS**: Asegúrate de configurar Row Level Security (RLS) en Supabase para proteger los datos.

3. **Variables de Entorno**: Considera mover las credenciales a variables de entorno en producción.

## Problemas Comunes

### Error: "relation does not exist"
- **Solución**: Ejecuta el script SQL completo en Supabase

### Error: "storage: bucket not found"
- **Solución**: Crea el bucket `evidencias` en Storage

### Error: "permission denied"
- **Solución**: Verifica las políticas RLS y de Storage

### Error en login siempre falla
- **Solución**: Implementa validación de contraseña con bcrypt

