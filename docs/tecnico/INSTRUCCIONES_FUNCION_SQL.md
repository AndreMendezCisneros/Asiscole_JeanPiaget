# 🔧 Instrucciones para Crear la Función SQL de Validación

## ⚠️ ERROR ACTUAL

Estás recibiendo este error:
```
POST https://YOUR_PROJECT.supabase.co/rest/v1/rpc/validar_password 404 (Not Found)
Could not find the function public.validar_password(p_password, p_username) in the schema cache
```

Esto significa que **la función SQL no existe en tu base de datos de Supabase**.

## ✅ SOLUCIÓN

### Paso 1: Abrir SQL Editor en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, haz clic en **"SQL Editor"**
3. Haz clic en **"New query"** para crear una nueva consulta

### Paso 2: Copiar y Ejecutar el SQL

**IMPORTANTE**: Si tu contraseña está hasheada con bcrypt (comienza con `$2a$`, `$2b$`, o `$2y$`), usa este SQL:

```sql
-- Instalar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función que soporta bcrypt y texto plano
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
  
  -- Si el hash comienza con $2a$, $2b$, o $2y$, es bcrypt
  IF v_password_hash LIKE '$2%' THEN
    -- Validar con bcrypt usando crypt
    RETURN v_password_hash = crypt(p_password, v_password_hash);
  ELSE
    -- Fallback: comparación directa (solo para desarrollo)
    RETURN v_password_hash = p_password;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos
GRANT EXECUTE ON FUNCTION validar_password TO anon;
GRANT EXECUTE ON FUNCTION validar_password TO authenticated;
```

**O** usa el archivo `sql/schema/FUNCION_VALIDAR_PASSWORD_BCRYPT.sql` que ya tiene esta versión.

### Paso 3: Ejecutar la Consulta

1. Haz clic en el botón **"Run"** (o presiona `Ctrl + Enter`)
2. Deberías ver un mensaje de éxito: `Success. No rows returned`

### Paso 4: Verificar que la Función Existe

Ejecuta esta consulta para verificar:

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'validar_password';
```

Si ves resultados, la función fue creada correctamente.

## 📝 Crear Usuario de Prueba

Ahora crea un usuario de prueba para poder iniciar sesión:

```sql
-- Usuario administrador (desarrollo)
INSERT INTO usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo
) VALUES (
  'admin',
  'admin123',  -- Contraseña en texto plano (SOLO DESARROLLO)
  'Administrador del Sistema',
  'admin@escuela.edu',
  'Admin',
  true
);

-- Usuario supervisor
INSERT INTO usuarios (
  username,
  password_hash,
  nombre_completo,
  email,
  rol,
  activo
) VALUES (
  'supervisor',
  'supervisor123',
  'Supervisor de Control',
  'supervisor@escuela.edu',
  'Supervisor',
  true
);
```

## 🧪 Probar el Login

1. Recarga la aplicación en el navegador
2. Intenta iniciar sesión con:
   - Usuario: `admin`
   - Contraseña: `admin123`

Si todo está correcto, deberías poder iniciar sesión sin errores.

## ⚠️ IMPORTANTE

**Esta función es SOLO PARA DESARROLLO**. Usa comparación de texto plano.

**Para producción**, debes:
1. Instalar extensión pgcrypto
2. Usar bcrypt para hashear contraseñas
3. Comparar usando `crypt()`

Ver el archivo `sql/schema/FUNCIONES_SQL_REQUERIDAS.sql` para la versión de producción con bcrypt.

