-- Jean Piaget: compromisos de apoderado para reiniciar alarma de deuda
-- (tardanzas / faltas / pagos). El historial de asistencia NO se borra;
-- el conteo de alarma parte desde firmado_en del último compromiso activo.

CREATE TABLE IF NOT EXISTS public.compromisos_alarma (
  id bigserial PRIMARY KEY,
  id_estudiante integer NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('tardanza', 'falta', 'pago')),
  nombre_apoderado text NOT NULL,
  documento_url text NULL,
  firmado_en timestamptz NOT NULL DEFAULT now(),
  registrado_por integer NULL REFERENCES public.usuarios(id_usuario),
  observaciones text NULL,
  activo boolean NOT NULL DEFAULT true,
  fecha_creacion timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compromisos_alarma_est_tipo_firmado
  ON public.compromisos_alarma (id_estudiante, tipo, firmado_en DESC);

CREATE INDEX IF NOT EXISTS idx_compromisos_alarma_activos
  ON public.compromisos_alarma (id_estudiante, tipo)
  WHERE activo IS TRUE;

COMMENT ON TABLE public.compromisos_alarma IS
  'Compromiso firmado del apoderado; reinicia el conteo/sonido de alarma por tipo.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compromisos_alarma TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.compromisos_alarma_id_seq TO anon, authenticated;

ALTER TABLE public.compromisos_alarma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sie_compromisos_alarma_staff_all ON public.compromisos_alarma;
CREATE POLICY sie_compromisos_alarma_staff_all ON public.compromisos_alarma
  FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion())
  WITH CHECK (public.sie_es_staff_sesion());

DROP POLICY IF EXISTS sie_compromisos_alarma_tutor_sel ON public.compromisos_alarma;
CREATE POLICY sie_compromisos_alarma_tutor_sel ON public.compromisos_alarma
  FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_compromisos_alarma_tutor_ins ON public.compromisos_alarma;
CREATE POLICY sie_compromisos_alarma_tutor_ins ON public.compromisos_alarma
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());
