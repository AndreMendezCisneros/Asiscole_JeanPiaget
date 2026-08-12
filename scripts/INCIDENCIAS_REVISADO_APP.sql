-- Lectura del aviso de incidencia en la app (check azul) → columna Revisado en el SIE.
-- Idempotente. Ejecutar en cada BD de colegio (Asis Academy, Jean Piaget, …).

ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS revisado_app BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.incidencias
  ADD COLUMN IF NOT EXISTS revisado_app_en TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.incidencias.revisado_app IS
  'True cuando el apoderado abrió el aviso de esta incidencia en la app (mensaje leído).';
COMMENT ON COLUMN public.incidencias.revisado_app_en IS
  'Momento en que se marcó revisado_app por primera vez (zona del servidor).';

CREATE INDEX IF NOT EXISTS idx_incidencias_revisado_app
  ON public.incidencias (revisado_app)
  WHERE revisado_app = FALSE;
