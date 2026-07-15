  -- ============================================================================
-- FUNCIÓN SQL PARA VALIDAR CONTRASEÑAS CON BCRYPT
-- ============================================================================
-- Esta función valida contraseñas hasheadas con bcrypt
-- Ejecuta esto en el SQL Editor de Supabase
-- ============================================================================

-- ============================================================================
-- PASO 1: Instalar extensión pgcrypto
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PASO 2: Crear función para validar contraseña con bcrypt
-- ============================================================================
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
  -- Usar crypt() para validar
  IF v_password_hash LIKE '$2%' THEN
    -- Validar con bcrypt usando crypt
    RETURN v_password_hash = crypt(p_password, v_password_hash);
  ELSE
    -- Fallback: si no es bcrypt, comparación directa (solo para desarrollo)
    RETURN v_password_hash = p_password;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permisos a usuarios anónimos para usar esta función
GRANT EXECUTE ON FUNCTION validar_password TO anon;
GRANT EXECUTE ON FUNCTION validar_password TO authenticated;

-- ============================================================================
-- NOTAS:
-- ============================================================================
-- 1. Esta función detecta automáticamente si el hash es bcrypt
-- 2. Si el hash comienza con $2a$, $2b$, o $2y$, usa crypt() para validar
-- 3. Si no, hace comparación directa (solo para desarrollo)
-- ============================================================================

