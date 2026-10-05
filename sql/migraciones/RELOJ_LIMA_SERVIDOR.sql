-- Fecha y hora de los escaneos: las pone Postgres en America/Lima, no el reloj de la laptop.
-- Ejecutar en Supabase → SQL Editor del proyecto de Asis Academy.

CREATE OR REPLACE FUNCTION public._sie_config_hora(p_clave text, p_default text DEFAULT '08:00')
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT left(
    coalesce(
      (SELECT valor::text FROM public.configuracion_sistema WHERE clave = p_clave LIMIT 1),
      p_default
    ),
    5
  );
$$;

CREATE OR REPLACE FUNCTION public._sie_hora_limite_por_nivel(p_nivel text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN replace(lower(coalesce(p_nivel, '')), '-', '') LIKE '%preuniv%'
      THEN public._sie_config_hora('hora_limite_llegada_preuniversitario', public._sie_config_hora('hora_limite_llegada', '08:00'))
    WHEN lower(coalesce(p_nivel, '')) LIKE '%prim%'
      THEN public._sie_config_hora('hora_limite_llegada_primaria', public._sie_config_hora('hora_limite_llegada', '08:00'))
    WHEN lower(coalesce(p_nivel, '')) LIKE '%sec%'
      THEN public._sie_config_hora('hora_limite_llegada_secundaria', public._sie_config_hora('hora_limite_llegada', '08:00'))
    ELSE public._sie_config_hora('hora_limite_llegada', '08:00')
  END;
$$;

CREATE OR REPLACE FUNCTION public._sie_estado_llegada(p_hora text, p_nivel text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN left(coalesce(p_hora, ''), 5) <= public._sie_hora_limite_por_nivel(p_nivel) THEN 'A tiempo'
    ELSE 'Tarde'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sie_reloj_lima()
RETURNS TABLE (fecha date, hora text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (timezone('America/Lima', now()))::date,
    to_char(timezone('America/Lima', now()), 'HH24:MI');
$$;

REVOKE ALL ON FUNCTION public.sie_reloj_lima() FROM public;
GRANT EXECUTE ON FUNCTION public.sie_reloj_lima() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sie_llegada_usar_reloj_lima()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hora text := to_char(timezone('America/Lima', now()), 'HH24:MI');
  v_nivel text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fecha := (timezone('America/Lima', now()))::date;
    NEW.hora_llegada := v_hora;
    SELECT e.nivel_educativo INTO v_nivel
    FROM public.estudiantes e
    WHERE e.id_estudiante = NEW.id_estudiante;
    NEW.estado := public._sie_estado_llegada(v_hora, v_nivel);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.hora_salida IS NULL
     AND NEW.hora_salida IS NOT NULL THEN
    NEW.hora_salida := v_hora::time;
    NEW.fecha_salida := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registros_llegada_reloj_lima ON public.registros_llegada;
CREATE TRIGGER trg_registros_llegada_reloj_lima
BEFORE INSERT OR UPDATE ON public.registros_llegada
FOR EACH ROW
EXECUTE FUNCTION public.sie_llegada_usar_reloj_lima();

CREATE OR REPLACE FUNCTION public.sie_taller_usar_reloj_lima()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hora text := to_char(timezone('America/Lima', now()), 'HH24:MI');
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.fecha := (timezone('America/Lima', now()))::date;
    NEW.hora_llegada := v_hora;
    IF NEW.hora_salida IS NOT NULL THEN
      NEW.hora_salida := v_hora;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.hora_llegada IS NOT NULL THEN
    NEW.hora_llegada := OLD.hora_llegada;
  END IF;
  NEW.fecha := OLD.fecha;

  IF OLD.hora_salida IS NULL AND NEW.hora_salida IS NOT NULL THEN
    NEW.hora_salida := v_hora;
  ELSIF OLD.hora_salida IS NOT NULL THEN
    NEW.hora_salida := OLD.hora_salida;
  END IF;

  RETURN NEW;
END;
$$;

-- Asis Academy aún no tiene esta tabla. No abortar el resto del script.
DO $$
BEGIN
  IF to_regclass('public.taller_llegadas') IS NULL THEN
    RAISE NOTICE 'Se omite el reloj de talleres: public.taller_llegadas no existe';
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_taller_llegadas_reloj_lima ON public.taller_llegadas';
  EXECUTE $trg$
    CREATE TRIGGER trg_taller_llegadas_reloj_lima
    BEFORE INSERT OR UPDATE ON public.taller_llegadas
    FOR EACH ROW
    EXECUTE FUNCTION public.sie_taller_usar_reloj_lima()
  $trg$;
END $$;

-- La incidencia no manda hora desde el navegador. Si la columna no tiene default, usa now().
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incidencias'
      AND column_name = 'fecha_hora_registro'
      AND column_default IS NULL
  ) THEN
    EXECUTE 'ALTER TABLE public.incidencias ALTER COLUMN fecha_hora_registro SET DEFAULT now()';
  END IF;
END $$;
