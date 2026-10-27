-- Jean Piaget: avisos de la app (pensión, citación, corrección de llegada) por asis_outbox.
--  * Antes iban solo por HTTP desde el navegador: si fallaba la red o se cerraba la
--    pestaña, el aviso se perdía. Ahora el SIE los encola en asis_outbox y el poller
--    del canal los procesa con reintentos (el mismo camino que llegadas e incidencias).
--  * El canal no cambia: su poller ya procesa tipo 'aviso' con la misma plantilla
--    que la ingesta HTTP (origen_evento = 'aviso:<id_registro>').
--  * Se conserva UNIQUE (tipo, id_registro) que usan los triggers. Si el id ya está
--    ocupado por OTRO aviso (otro alumno o contexto), la RPC lo informa y el SIE usa
--    el envío HTTP de siempre: nada se pierde.
-- Idempotente.

-- =============================================================================
-- 1) asis_outbox acepta 'aviso'
-- =============================================================================
ALTER TABLE public.asis_outbox DROP CONSTRAINT IF EXISTS asis_outbox_tipo_check;
ALTER TABLE public.asis_outbox ADD CONSTRAINT asis_outbox_tipo_check CHECK (tipo = ANY (ARRAY[
  'entrada', 'salida', 'incidencia',
  'personal_entrada', 'personal_salida', 'personal_incidencia',
  'aviso'
])) NOT VALID;
ALTER TABLE public.asis_outbox VALIDATE CONSTRAINT asis_outbox_tipo_check;

-- =============================================================================
-- 2) Encolar un aviso desde el SIE (staff con sesión)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_encolar_aviso_app(
  p_token text,
  p_id_estudiante int,
  p_id_registro int,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rol text;
  v_contexto text := lower(trim(coalesce(p_payload->>'contexto', '')));
  v_payload jsonb;
  v_id bigint;
  v_previo record;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol NOT IN ('Admin', 'Director', 'Supervisor', 'Cajero') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payload inválido');
  END IF;
  IF v_contexto NOT IN ('pension', 'cita', 'correccion_llegada') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'contexto no permitido');
  END IF;
  IF coalesce(p_id_registro, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id_registro inválido');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.estudiantes WHERE id_estudiante = p_id_estudiante) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Estudiante no encontrado');
  END IF;

  -- El destinatario lo resuelve el canal por directorio: nunca viajan teléfonos.
  v_payload := (p_payload - 'telefono_contacto' - 'codigo_barras')
    || jsonb_build_object('tipo', 'aviso', 'id_estudiante', p_id_estudiante);

  INSERT INTO public.asis_outbox (tipo, id_estudiante, id_registro, payload)
  VALUES ('aviso', p_id_estudiante, p_id_registro, v_payload)
  ON CONFLICT (tipo, id_registro) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'queued', true, 'id', v_id);
  END IF;

  SELECT o.id_estudiante, o.payload->>'contexto' AS contexto INTO v_previo
  FROM public.asis_outbox o WHERE o.tipo = 'aviso' AND o.id_registro = p_id_registro;
  IF v_previo.id_estudiante = p_id_estudiante AND v_previo.contexto = v_contexto THEN
    -- Mismo aviso ya encolado: el canal tampoco lo repetiría.
    RETURN jsonb_build_object('ok', true, 'queued', false, 'duplicate', true);
  END IF;
  RETURN jsonb_build_object('ok', false, 'conflict', true, 'error', 'id_registro ocupado por otro aviso');
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_encolar_aviso_app(text, int, int, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
