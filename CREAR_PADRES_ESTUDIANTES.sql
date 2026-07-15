-- Vincular usuarios Padre con estudiantes (portal familiar)

CREATE TABLE IF NOT EXISTS public.padres_estudiantes (
  id_relacion SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  id_estudiante INTEGER NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  parentesco VARCHAR(50) DEFAULT 'Apoderado',
  es_principal BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (id_usuario, id_estudiante)
);

CREATE INDEX IF NOT EXISTS idx_padres_estudiantes_usuario
  ON public.padres_estudiantes (id_usuario);

CREATE INDEX IF NOT EXISTS idx_padres_estudiantes_estudiante
  ON public.padres_estudiantes (id_estudiante);

-- Ejemplo: vincular usuario Padre con estudiante DNI 76127901 (id 32)
-- Ajuste id_usuario al padre real en su tabla usuarios.
/*
INSERT INTO public.padres_estudiantes (id_usuario, id_estudiante, parentesco, es_principal)
SELECT u.id_usuario, 32, 'Apoderado', true
FROM public.usuarios u
WHERE u.username = 'padre.humani'
ON CONFLICT (id_usuario, id_estudiante) DO NOTHING;
*/

-- Alternativa sin tabla: en usuarios.grados_asignados guardar JSON:
-- UPDATE public.usuarios SET grados_asignados = '{"studentIds":[32]}'::jsonb WHERE username = 'padre.humani';
