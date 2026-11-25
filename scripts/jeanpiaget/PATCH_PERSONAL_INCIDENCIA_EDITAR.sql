-- Jean Piaget: RR.HH. puede quitar fotos de evidencia de una incidencia del personal
-- (al editar la incidencia). Cambiar falta/observación no necesita SQL: la política
-- sie_incidencias_personal_rrhh_all (FOR ALL) ya permite el UPDATE.
-- Editar NO reenvía el aviso a la app (asis_trg_personal_incidencia es solo AFTER INSERT).
-- Idempotente.

CREATE OR REPLACE FUNCTION public.sie_eliminar_evidencia_personal(p_id_evidencia integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
  v_ruta text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(public.sie_request_token()) LIMIT 1;
  IF v_rol IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida o expirada';
  END IF;
  IF v_rol <> 'RRHH' THEN
    RAISE EXCEPTION 'Solo RR.HH. puede quitar evidencias del personal';
  END IF;

  DELETE FROM public.evidencias_fotograficas_personal
   WHERE id_evidencia = p_id_evidencia
  RETURNING ruta_archivo INTO v_ruta;

  IF v_ruta IS NULL THEN
    RAISE EXCEPTION 'Evidencia no encontrada';
  END IF;

  RETURN jsonb_build_object('ruta_archivo', v_ruta);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_eliminar_evidencia_personal(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sie_eliminar_evidencia_personal(integer) TO anon, authenticated;

SELECT 'sie_eliminar_evidencia_personal OK' AS resultado;
