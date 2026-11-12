-- Nombre de quien registró la llegada y la salida del personal.
-- registrado_por y registrado_salida_por ya se guardaban; RRHH no lee la tabla
-- usuarios, así que el nombre se copia al registro (igual que justificado_por_nombre).
-- Estas columnas no generan avisos (el outbox solo mira hora_salida y estado) y el
-- trigger llegada_fija no las bloquea. Idempotente.

ALTER TABLE public.registros_llegada_personal
  ADD COLUMN IF NOT EXISTS registrado_por_nombre text,
  ADD COLUMN IF NOT EXISTS registrado_salida_por_nombre text;

CREATE OR REPLACE FUNCTION public.sie_fn_personal_registrado_nombre()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.registrado_por IS NULL THEN
    NEW.registrado_por_nombre := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.registrado_por IS DISTINCT FROM OLD.registrado_por
        OR NEW.registrado_por_nombre IS NULL THEN
    SELECT nombre_completo INTO NEW.registrado_por_nombre FROM usuarios WHERE id_usuario = NEW.registrado_por;
  END IF;

  -- El cierre automático de las 22:00 deja registrado_salida_por en NULL.
  IF NEW.registrado_salida_por IS NULL THEN
    NEW.registrado_salida_por_nombre := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.registrado_salida_por IS DISTINCT FROM OLD.registrado_salida_por
        OR NEW.registrado_salida_por_nombre IS NULL THEN
    SELECT nombre_completo INTO NEW.registrado_salida_por_nombre FROM usuarios WHERE id_usuario = NEW.registrado_salida_por;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_registrado_nombre ON public.registros_llegada_personal;
CREATE TRIGGER sie_trg_personal_registrado_nombre
  BEFORE INSERT OR UPDATE OF registrado_por, registrado_salida_por ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_registrado_nombre();

UPDATE public.registros_llegada_personal r
   SET registrado_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = r.registrado_por
   AND r.registrado_por_nombre IS NULL;

UPDATE public.registros_llegada_personal r
   SET registrado_salida_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = r.registrado_salida_por
   AND r.registrado_salida_por_nombre IS NULL;

SELECT count(*) FILTER (WHERE registrado_por IS NOT NULL) AS llegadas_con_usuario,
       count(*) FILTER (WHERE registrado_por_nombre IS NOT NULL) AS llegadas_con_nombre,
       count(*) FILTER (WHERE registrado_salida_por IS NOT NULL) AS salidas_con_usuario,
       count(*) FILTER (WHERE registrado_salida_por_nombre IS NOT NULL) AS salidas_con_nombre
  FROM public.registros_llegada_personal;
