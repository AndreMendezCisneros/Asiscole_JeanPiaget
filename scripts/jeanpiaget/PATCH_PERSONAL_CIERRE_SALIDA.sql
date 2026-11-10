-- =============================================================================
-- Cierre automático de salidas del PERSONAL
--  * A la hora de cierre (configuracion_sistema.personal_hora_cierre_salida,
--    por defecto 22:00 Lima), quien llegó y no marcó salida queda con salida
--    Normal a su hora de salida del horario, con motivo "Cierre automático".
--  * Días anteriores sin cerrar también se cierran (por si el cron no corrió),
--    solo desde 2026-11-10 (lo anterior se corrigió a mano).
--  * No se avisa a la app (se quitan los avisos personal_salida encolados).
-- Lo llama el cron jp-personal-cierre (cada 10 min). Idempotente.
-- =============================================================================

INSERT INTO public.configuracion_sistema (clave, valor, descripcion)
VALUES ('personal_hora_cierre_salida', '22:00',
        'Hora (Lima) a la que el personal que no marcó salida queda con salida normal automática')
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sie_jp_cerrar_salidas_personal(
  p_ahora timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_local timestamp := timezone('America/Lima', p_ahora);
  v_hoy date := v_local::date;
  v_hora time := v_local::time;
  v_cierre time;
  v_hasta date;
  v_ids int[];
BEGIN
  SELECT CASE WHEN valor ~ '^\s*\d{1,2}:\d{2}' THEN valor::time END INTO v_cierre
  FROM configuracion_sistema WHERE clave = 'personal_hora_cierre_salida';
  v_cierre := coalesce(v_cierre, TIME '22:00');

  v_hasta := CASE WHEN v_hora >= v_cierre THEN v_hoy ELSE v_hoy - 1 END;

  WITH candidatos AS (
    SELECT r.id_registro,
           coalesce(r.hora_salida_esperada, h.hora_salida) AS salida
    FROM registros_llegada_personal r
    LEFT JOIN personal_horario h
      ON h.id_personal = r.id_personal
     AND h.dia_semana = EXTRACT(ISODOW FROM r.fecha)::smallint
    WHERE r.fecha >= DATE '2026-11-10'
      AND r.fecha <= v_hasta
      AND r.hora_salida IS NULL
      AND r.estado IN ('A tiempo', 'Tarde', 'Fuera de horario')
  ), cerrados AS (
    UPDATE registros_llegada_personal r
       SET hora_salida = c.salida,
           hora_salida_esperada = c.salida,
           tipo_salida = 'Normal',
           fecha_salida = now(),
           registrado_salida_por = NULL,
           motivo_salida = 'Cierre automático: no marcó salida'
      FROM candidatos c
     WHERE r.id_registro = c.id_registro
       AND c.salida IS NOT NULL
       AND r.hora_llegada <= c.salida
       AND r.hora_salida IS NULL
    RETURNING r.id_registro
  )
  SELECT coalesce(array_agg(id_registro), '{}') INTO v_ids FROM cerrados;

  IF cardinality(v_ids) > 0 THEN
    DELETE FROM asis_outbox
     WHERE tipo = 'personal_salida' AND procesado = false
       AND id_registro = ANY (v_ids);
  END IF;

  RETURN cardinality(v_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.sie_jp_cerrar_salidas_personal(timestamptz) FROM PUBLIC, anon, authenticated;
