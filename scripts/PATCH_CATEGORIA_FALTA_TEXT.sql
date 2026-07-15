-- PATCH: catalogo_faltas.categoria de enum a text
-- Permite categorias personalizadas (ej. Asistencia).
-- Ejecutar entero en Supabase SQL Editor.

DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT c.udt_name
  INTO v_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'catalogo_faltas'
    AND c.column_name = 'categoria';

  IF v_udt IS NULL THEN
    RAISE NOTICE 'Columna catalogo_faltas.categoria no encontrada; nada que hacer.';
    RETURN;
  END IF;

  IF v_udt = 'text' OR v_udt = 'varchar' THEN
    RAISE NOTICE 'categoria ya es %; nada que hacer.', v_udt;
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.catalogo_faltas ALTER COLUMN categoria TYPE text USING categoria::text';
  RAISE NOTICE 'catalogo_faltas.categoria convertida de % a text.', v_udt;
END $$;

ALTER TABLE public.catalogo_faltas
  DROP CONSTRAINT IF EXISTS catalogo_faltas_categoria_len;

ALTER TABLE public.catalogo_faltas
  ADD CONSTRAINT catalogo_faltas_categoria_len
  CHECK (char_length(trim(categoria)) BETWEEN 1 AND 50);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_falta')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_type t ON t.oid = a.atttypid
       WHERE n.nspname = 'public'
         AND t.typname = 'categoria_falta'
         AND a.attnum > 0
         AND NOT a.attisdropped
     )
  THEN
    DROP TYPE public.categoria_falta;
    RAISE NOTICE 'Tipo enum categoria_falta eliminado.';
  ELSE
    RAISE NOTICE 'Enum categoria_falta se conserva (aun en uso o no existia).';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
