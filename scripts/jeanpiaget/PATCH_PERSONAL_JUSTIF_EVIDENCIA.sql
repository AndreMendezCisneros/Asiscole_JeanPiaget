-- Evidencia (foto o PDF) y nombre de quien justificó en las justificaciones del personal.
-- El archivo va al bucket público 'evidencias', carpeta personal/{id_registro}/.
-- Actualizar estas columnas no genera avisos (asis_fn_encolar_evento_personal solo mira
-- hora_salida y estado) y el trigger llegada_fija no las bloquea.

ALTER TABLE public.registros_llegada_personal
  ADD COLUMN IF NOT EXISTS justificado_por_nombre text,
  ADD COLUMN IF NOT EXISTS evidencia_ruta text,
  ADD COLUMN IF NOT EXISTS evidencia_nombre text,
  ADD COLUMN IF NOT EXISTS evidencia_mime text,
  ADD COLUMN IF NOT EXISTS evidencia_subida_por integer,
  ADD COLUMN IF NOT EXISTS evidencia_fecha timestamptz;

COMMENT ON COLUMN public.registros_llegada_personal.evidencia_ruta IS
  'Ruta en el bucket evidencias (personal/{id_registro}/archivo) de la evidencia de la justificación.';

-- RRHH no lee la tabla usuarios: el nombre de quien justifica se guarda en el registro.
CREATE OR REPLACE FUNCTION public.sie_fn_personal_justificado_nombre()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.justificado_por IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.justificado_por IS DISTINCT FROM OLD.justificado_por
          OR NEW.justificado_por_nombre IS NULL) THEN
    SELECT nombre_completo INTO NEW.justificado_por_nombre FROM usuarios WHERE id_usuario = NEW.justificado_por;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_justificado_nombre ON public.registros_llegada_personal;
CREATE TRIGGER sie_trg_personal_justificado_nombre
  BEFORE INSERT OR UPDATE OF justificado_por ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_justificado_nombre();

-- Nombre de quien justificó en las justificaciones ya hechas.
UPDATE public.registros_llegada_personal r
   SET justificado_por_nombre = u.nombre_completo
  FROM public.usuarios u
 WHERE u.id_usuario = r.justificado_por
   AND r.justificado_por IS NOT NULL
   AND r.justificado_por_nombre IS NULL;

SELECT count(*) FILTER (WHERE justificado_por IS NOT NULL) AS justificadas,
       count(*) FILTER (WHERE justificado_por_nombre IS NOT NULL) AS con_nombre
  FROM public.registros_llegada_personal;
