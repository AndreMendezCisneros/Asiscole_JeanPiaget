-- ============================================================================
-- FUNCIONES SQL REQUERIDAS PARA EL SISTEMA
-- ============================================================================
-- Ejecuta este archivo en el SQL Editor de Supabase después de crear las tablas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Función: Validar contraseña
-- ----------------------------------------------------------------------------
-- Esta función valida la contraseña del usuario
-- IMPORTANTE: Para producción, usa bcrypt. Esta versión es para desarrollo.
-- ============================================================================

-- Primero, instalar extensión pgcrypto (debe estar fuera de la función)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función que soporta tanto bcrypt como texto plano (desarrollo)
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

-- Dar permisos a usuarios anónimos para usar esta función
GRANT EXECUTE ON FUNCTION validar_password TO anon;
GRANT EXECUTE ON FUNCTION validar_password TO authenticated;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 
-- 1. SEGURIDAD: Esta función es SOLO PARA DESARROLLO.
--    En producción, DEBES usar bcrypt. Para hacerlo:
--
--    a) Instala la extensión pgcrypto:
--       CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
--    b) Usa esta versión mejorada:
--
--    CREATE OR REPLACE FUNCTION validar_password(
--      p_username VARCHAR,
--      p_password VARCHAR
--    )
--    RETURNS BOOLEAN AS $$
--    DECLARE
--      v_password_hash VARCHAR;
--    BEGIN
--      SELECT password_hash INTO v_password_hash
--      FROM usuarios
--      WHERE username = p_username
--        AND activo = TRUE;
--      
--      IF v_password_hash IS NULL THEN
--        RETURN FALSE;
--      END IF;
--      
--      -- Validar con bcrypt usando crypt
--      RETURN v_password_hash = crypt(p_password, v_password_hash);
--    EXCEPTION
--      WHEN OTHERS THEN
--        RETURN FALSE;
--    END;
--    $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- 2. Para crear usuarios con bcrypt en producción:
--    INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol)
--    VALUES (
--      'admin',
--      crypt('tu_contraseña', gen_salt('bf')),  -- bf = bcrypt
--      'Administrador',
--      'admin@escuela.edu',
--      'Admin'
--    );
--
-- 3. Para desarrollo rápido (texto plano):
--    INSERT INTO usuarios (username, password_hash, nombre_completo, email, rol)
--    VALUES (
--      'admin',
--      'admin123',  -- Contraseña en texto plano (SOLO DESARROLLO)
--      'Administrador',
--      'admin@escuela.edu',
--      'Admin'
--    );
--
-- ============================================================================


