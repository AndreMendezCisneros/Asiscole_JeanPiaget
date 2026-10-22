-- Ejecutar PRIMERO en Supabase SQL Editor (Jean Piaget)
-- Agrega el valor 'Cajero' al enum rol_usuario (pensiones + config de pensiones)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'rol_usuario'
      AND e.enumlabel = 'Cajero'
  ) THEN
    ALTER TYPE public.rol_usuario ADD VALUE 'Cajero';
  END IF;
END $$;

-- Verificar valores del enum
SELECT enumlabel AS rol
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'rol_usuario'
ORDER BY e.enumsortorder;
