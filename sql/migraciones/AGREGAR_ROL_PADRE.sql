-- Ejecutar PRIMERO en Supabase SQL Editor
-- Agrega el valor 'Padre' al enum rol_usuario (requerido para el portal familiar)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'rol_usuario'
      AND e.enumlabel = 'Padre'
  ) THEN
    ALTER TYPE public.rol_usuario ADD VALUE 'Padre';
  END IF;
END $$;

-- Verificar valores del enum
SELECT enumlabel AS rol
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'rol_usuario'
ORDER BY e.enumsortorder;
