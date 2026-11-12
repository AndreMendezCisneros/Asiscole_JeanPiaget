-- Evidencias fotográficas de incidencias del personal.
-- El catálogo de alumnos (evidencias_fotograficas + insertar_evidencia) no aplica:
-- esa tabla exige id_incidencia de estudiantes.
-- Quien ya puede registrar (Admin, Tutor, RRHH) sube por RPC.
-- RR.HH. lee las fotos para la lista y el PDF.

CREATE TABLE IF NOT EXISTS public.evidencias_fotograficas_personal (
  id_evidencia serial PRIMARY KEY,
  id_incidencia integer NOT NULL REFERENCES public.incidencias_personal(id_incidencia) ON DELETE CASCADE,
  ruta_archivo text NOT NULL,
  nombre_original text NOT NULL,
  nombre_archivo text NOT NULL,
  tamano_bytes integer,
  tipo_mime text,
  id_usuario_subida integer,
  fecha_subida timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidencias_personal_incidencia
  ON public.evidencias_fotograficas_personal(id_incidencia);

ALTER TABLE public.evidencias_fotograficas_personal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sie_evidencias_personal_rrhh_sel ON public.evidencias_fotograficas_personal;
CREATE POLICY sie_evidencias_personal_rrhh_sel ON public.evidencias_fotograficas_personal
  FOR SELECT TO anon, authenticated
  USING ((SELECT sie_sesion_rol()) = 'RRHH' AND (SELECT sie_tiene_sesion()));

GRANT SELECT, INSERT ON public.evidencias_fotograficas_personal TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.evidencias_fotograficas_personal_id_evidencia_seq TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sie_incidencia_personal_crear(
  p_id_personal integer,
  p_id_falta integer,
  p_id_usuario_registro integer,
  p_observaciones text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_id integer;
  v_nombre text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(public.sie_request_token()) LIMIT 1;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida o expirada';
  END IF;
  IF v_rol NOT IN ('Admin', 'Tutor', 'RRHH') THEN
    RAISE EXCEPTION 'No autorizado para registrar incidencia del personal';
  END IF;

  SELECT nombre_completo INTO v_nombre
    FROM public.usuarios
   WHERE id_usuario = p_id_usuario_registro;

  INSERT INTO public.incidencias_personal (
    id_personal, id_falta, id_usuario_registro, observaciones, registrado_por_nombre
  ) VALUES (
    p_id_personal,
    p_id_falta,
    p_id_usuario_registro,
    nullif(btrim(p_observaciones), ''),
    v_nombre
  )
  RETURNING id_incidencia INTO v_id;

  RETURN jsonb_build_object('id_incidencia', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_insertar_evidencia_personal(
  p_id_incidencia integer,
  p_ruta_archivo text,
  p_nombre_original text,
  p_nombre_archivo text,
  p_tamano_bytes integer,
  p_tipo_mime text,
  p_id_usuario_subida integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_row public.evidencias_fotograficas_personal%ROWTYPE;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(public.sie_request_token()) LIMIT 1;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida o expirada';
  END IF;
  IF v_rol NOT IN ('Admin', 'Tutor', 'RRHH') THEN
    RAISE EXCEPTION 'No autorizado para subir evidencia del personal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.incidencias_personal WHERE id_incidencia = p_id_incidencia
  ) THEN
    RAISE EXCEPTION 'Incidencia del personal no encontrada';
  END IF;

  INSERT INTO public.evidencias_fotograficas_personal (
    id_incidencia, ruta_archivo, nombre_original, nombre_archivo,
    tamano_bytes, tipo_mime, id_usuario_subida, fecha_subida
  ) VALUES (
    p_id_incidencia, p_ruta_archivo, p_nombre_original, p_nombre_archivo,
    p_tamano_bytes, p_tipo_mime, p_id_usuario_subida, now()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_incidencia_personal_crear(integer, integer, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_insertar_evidencia_personal(integer, text, text, text, integer, text, integer) TO anon, authenticated;
