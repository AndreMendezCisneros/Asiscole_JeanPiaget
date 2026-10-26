-- Jean Piaget: la llegada registrada del personal no se puede modificar
-- (a diferencia de estudiantes). Solo se permite:
--   * Falta (cierre del día)  → llegada real, o Falta justificada
--   * Tarde                  → Tarde justificada (motivo)
-- y registrar la salida. Idempotente.

CREATE OR REPLACE FUNCTION public.sie_fn_personal_llegada_fija()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'Falta' THEN
    RETURN NEW;
  END IF;

  IF NEW.hora_llegada IS DISTINCT FROM OLD.hora_llegada
     OR NEW.hora_entrada_esperada IS DISTINCT FROM OLD.hora_entrada_esperada THEN
    RAISE EXCEPTION 'La hora de llegada del personal no se puede modificar.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (OLD.estado = 'Tarde' AND NEW.estado = 'Tarde justificada') THEN
    RAISE EXCEPTION 'El estado de llegada del personal no se puede modificar (solo justificar una tardanza).'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sie_trg_personal_llegada_fija ON public.registros_llegada_personal;
CREATE TRIGGER sie_trg_personal_llegada_fija
  BEFORE UPDATE ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.sie_fn_personal_llegada_fija();
