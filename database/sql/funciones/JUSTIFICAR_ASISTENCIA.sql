-- Justificación de asistencia (TJ / IJ) en registros_llegada.
-- Amplía estado y guarda motivo, usuario y fecha de justificación.

ALTER TABLE public.registros_llegada
  ADD COLUMN IF NOT EXISTS motivo_justificacion text,
  ADD COLUMN IF NOT EXISTS justificado_por integer,
  ADD COLUMN IF NOT EXISTS fecha_justificacion timestamptz;

DO $$
DECLARE
  typ text;
  enum_typ text;
  conname text;
BEGIN
  SELECT t.typtype, t.typname
    INTO typ, enum_typ
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE n.nspname = 'public'
    AND c.relname = 'registros_llegada'
    AND a.attname = 'estado'
    AND NOT a.attisdropped;

  IF typ = 'e' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = enum_typ AND e.enumlabel = 'Tarde justificada'
    ) THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_typ, 'Tarde justificada');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = enum_typ AND e.enumlabel = 'Falta justificada'
    ) THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_typ, 'Falta justificada');
    END IF;
  END IF;

  SELECT con.conname
    INTO conname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'registros_llegada'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%estado%'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.registros_llegada DROP CONSTRAINT %I', conname);
    ALTER TABLE public.registros_llegada
      ADD CONSTRAINT registros_llegada_estado_check
      CHECK (estado::text IN (
        'A tiempo',
        'Tarde',
        'Tarde justificada',
        'Falta justificada',
        'Falta',
        'Justificada',
        'Injustificada'
      ));
  END IF;
END $$;
