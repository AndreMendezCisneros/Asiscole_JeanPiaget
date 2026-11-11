-- Evidencia (foto o PDF) y nombre de quien autorizó en las salidas anticipadas con permiso.
-- Archivo en el bucket público 'evidencias', carpeta personal-salida/{id_registro}/.
-- Estas columnas no generan avisos (el outbox solo mira hora_salida y estado) y el
-- trigger llegada_fija no las bloquea.

ALTER TABLE public.registros_llegada_personal
  ADD COLUMN IF NOT EXISTS salida_autorizada_por_nombre text,
  ADD COLUMN IF NOT EXISTS salida_evidencia_ruta text,
  ADD COLUMN IF NOT EXISTS salida_evidencia_nombre text,
  ADD COLUMN IF NOT EXISTS salida_evidencia_mime text,
  ADD COLUMN IF NOT EXISTS salida_evidencia_subida_por integer,
  ADD COLUMN IF NOT EXISTS salida_evidencia_fecha timestamptz;

-- RRHH no lee la tabla usuarios: el nombre de quien autoriza se guarda en el registro.
CREATE OR REPLACE FUNCTION public.sie_fn_personal_salida_autorizada_nombre()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.salida_autorizada_por IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.salida_autorizada_por IS DISTINCT FROM OLD.salida_autorizada_por
          OR NEW.salida_autorizada_por_nombre IS NULL) THEN
    SELECT nombre_completo INTO NEW.salida_autorizada_por_nombre FROM usuarios WHERE id_usuario = NEW.salida_autorizada_por;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_salida_autorizada_nombre ON public.registros_llegada_personal;
CREATE TRIGGER sie_trg_personal_salida_autorizada_nombre
  BEFORE INSERT OR UPDATE OF salida_autorizada_por ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_salida_autorizada_nombre();

UPDATE public.registros_llegada_personal r
   SET salida_autorizada_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = r.salida_autorizada_por
   AND r.salida_autorizada_por IS NOT NULL
   AND r.salida_autorizada_por_nombre IS NULL;

SELECT count(*) FILTER (WHERE tipo_salida = 'Autorizada') AS autorizadas,
       count(*) FILTER (WHERE salida_autorizada_por_nombre IS NOT NULL) AS con_nombre,
       count(*) FILTER (WHERE tipo_salida = 'Anticipada') AS sin_autorizacion
  FROM public.registros_llegada_personal;
