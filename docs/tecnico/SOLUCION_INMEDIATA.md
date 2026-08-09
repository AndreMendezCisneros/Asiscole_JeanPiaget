# 🔧 Solución Inmediata - Error de Validación de Contraseña

## ⚠️ Problema Actual

La función `validar_password` devuelve `false` porque tu contraseña está hasheada con bcrypt (`$2a$06$...`), pero la función actual compara texto plano.

## ✅ Solución Rápida (5 minutos)

### Paso 1: Abrir SQL Editor en Supabase

1. Ve a: https://app.supabase.com
2. Selecciona tu proyecto
3. Click en **"SQL Editor"** (menú lateral)
4. Click en **"New query"**

### Paso 2: Copiar y Pegar este SQL

Copia **TODO** este código y pégalo en el SQL Editor:

```sql
-- Instalar extensión pgcrypto (requerida para bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Actualizar función para soportar bcrypt
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

### Paso 3: Ejecutar

1. Click en el botón **"Run"** (o `Ctrl + Enter`)
2. Deberías ver: `Success. No rows returned`

### Paso 4: Probar el Login

1. Recarga tu aplicación en el navegador
2. Intenta iniciar sesión con:
   - Usuario: `Rudeus`
   - Contraseña: (la contraseña que usaste al crear el usuario)

## ✅ Verificación

Si todo está correcto, deberías poder iniciar sesión sin errores y ser redirigido al dashboard.

## 🔍 Si Aún No Funciona

1. **Verifica que la función existe**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'validar_password';
   ```

2. **Verifica que pgcrypto está instalado**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
   ```

3. **Prueba la función manualmente**:
   ```sql
   SELECT validar_password('Rudeus', 'tu_contraseña_aqui');
   ```

## 📝 Nota

Tu contraseña está hasheada con bcrypt (`$2a$06$...`), por lo que necesitas usar la contraseña **ORIGINAL** (sin hash) para iniciar sesión. La función ahora validará correctamente usando `crypt()`.

