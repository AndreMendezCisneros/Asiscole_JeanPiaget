-- Jean Piaget: llegadas/salidas a taller (sin catálogo, sin a tiempo/tarde).
-- Una fila por estudiante y día. Hora de llegada + hora de salida (escáner).

CREATE TABLE IF NOT EXISTS public.taller_llegadas (
  id_registro bigserial PRIMARY KEY,
  id_estudiante integer NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_llegada text NOT NULL,
  hora_salida text NULL,
  registrado_por integer NULL REFERENCES public.usuarios(id_usuario),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_estudiante, fecha)
);

-- Si la tabla ya existía sin salida:
ALTER TABLE public.taller_llegadas
  ADD COLUMN IF NOT EXISTS hora_salida text NULL;

CREATE INDEX IF NOT EXISTS idx_taller_llegadas_estudiante_fecha
  ON public.taller_llegadas (id_estudiante, fecha);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taller_llegadas TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.taller_llegadas_id_registro_seq TO anon, authenticated;

ALTER TABLE public.taller_llegadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sie_taller_llegadas_staff_all ON public.taller_llegadas;
CREATE POLICY sie_taller_llegadas_staff_all ON public.taller_llegadas FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion())
  WITH CHECK (public.sie_es_staff_sesion());

DROP POLICY IF EXISTS sie_taller_llegadas_tutor_ins ON public.taller_llegadas;
CREATE POLICY sie_taller_llegadas_tutor_ins ON public.taller_llegadas FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_taller_llegadas_tutor_sel ON public.taller_llegadas;
CREATE POLICY sie_taller_llegadas_tutor_sel ON public.taller_llegadas FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_taller_llegadas_tutor_upd ON public.taller_llegadas;
CREATE POLICY sie_taller_llegadas_tutor_upd ON public.taller_llegadas FOR UPDATE TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion())
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_taller_llegadas_padre_sel ON public.taller_llegadas;
CREATE POLICY sie_taller_llegadas_padre_sel ON public.taller_llegadas FOR SELECT TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Padre' AND public.sie_padre_puede_ver_estudiante(id_estudiante));
