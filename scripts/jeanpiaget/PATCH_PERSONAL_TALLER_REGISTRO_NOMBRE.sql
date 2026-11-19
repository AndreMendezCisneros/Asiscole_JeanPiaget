-- Jean Piaget: nombre de quien marcó la entrada y la salida del taller del personal.
-- RRHH no lee la tabla usuarios: el nombre se guarda en el registro (como en
-- justificaciones). Requiere PATCH_PERSONAL_TALLER.sql. Idempotente.

ALTER TABLE public.personal_taller
  ADD COLUMN IF NOT EXISTS registrado_por_nombre text NULL,
  ADD COLUMN IF NOT EXISTS registrado_salida_por_nombre text NULL;

CREATE OR REPLACE FUNCTION public.sie_fn_personal_taller_nombre()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.registrado_por IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.registrado_por IS DISTINCT FROM OLD.registrado_por
          OR NEW.registrado_por_nombre IS NULL) THEN
    SELECT nombre_completo INTO NEW.registrado_por_nombre FROM usuarios WHERE id_usuario = NEW.registrado_por;
  END IF;
  IF NEW.registrado_salida_por IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.registrado_salida_por IS DISTINCT FROM OLD.registrado_salida_por
          OR NEW.registrado_salida_por_nombre IS NULL) THEN
    SELECT nombre_completo INTO NEW.registrado_salida_por_nombre FROM usuarios WHERE id_usuario = NEW.registrado_salida_por;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_taller_nombre ON public.personal_taller;
CREATE TRIGGER sie_trg_personal_taller_nombre
  BEFORE INSERT OR UPDATE OF registrado_por, registrado_salida_por ON public.personal_taller
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_taller_nombre();

-- Nombres en los talleres ya marcados.
UPDATE public.personal_taller t
   SET registrado_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = t.registrado_por AND t.registrado_por_nombre IS NULL;

UPDATE public.personal_taller t
   SET registrado_salida_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = t.registrado_salida_por AND t.registrado_salida_por_nombre IS NULL;

SELECT count(*) AS talleres,
       count(*) FILTER (WHERE registrado_por IS NULL) AS sin_quien_entrada,
       count(*) FILTER (WHERE registrado_por_nombre IS NOT NULL) AS con_nombre_entrada,
       count(*) FILTER (WHERE hora_salida IS NOT NULL AND registrado_salida_por IS NULL) AS sin_quien_salida,
       count(*) FILTER (WHERE registrado_salida_por_nombre IS NOT NULL) AS con_nombre_salida
  FROM public.personal_taller;
