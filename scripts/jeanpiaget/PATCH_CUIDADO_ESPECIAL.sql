-- =============================================================================
-- PATCH: cuidado especial (alerta interna al escanear).
-- Idempotente. No se expone en _sie_student_json_basico (portal padres).
-- Escritura solo Admin/Director. Aplicar con scripts/jeanpiaget/apply_patch.py
-- =============================================================================

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS cuidado_especial boolean NOT NULL DEFAULT false;

ALTER TABLE public.estudiantes
  ADD COLUMN IF NOT EXISTS condicion_especial_nota text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estudiantes_condicion_especial_nota_len'
      AND conrelid = 'public.estudiantes'::regclass
  ) THEN
    ALTER TABLE public.estudiantes
      ADD CONSTRAINT estudiantes_condicion_especial_nota_len
      CHECK (condicion_especial_nota IS NULL OR char_length(condicion_especial_nota) <= 200);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._sie_student_json_completo(
  e public.estudiantes,
  p_nivel integer DEFAULT 0,
  p_faltas bigint DEFAULT 0
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public._sie_student_json_basico(e) || jsonb_build_object(
    'reincidenceLevel', coalesce(p_nivel, 0),
    'faultsLast60Days', coalesce(p_faltas, 0)::int,
    'contactPhone', e.telefono_contacto,
    'contactEmail', e.email_contacto,
    'responsibleName', e.nombre_responsable,
    'responsibleRelationship', e.parentesco_responsable,
    'emergencyPhone', e.telefono_emergencia,
    'estadoPension', coalesce(e.estado_pension, 'sin_dato'),
    'cuidadoEspecial', coalesce(e.cuidado_especial, false),
    'condicionEspecialNota', e.condicion_especial_nota
  );
$$;

CREATE OR REPLACE FUNCTION public._sie_student_json_tutor(e public.estudiantes)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public._sie_student_json_basico(e) || jsonb_build_object(
    'contactPhone', e.telefono_contacto,
    'emergencyPhone', e.telefono_emergencia,
    'estadoPension', coalesce(e.estado_pension, 'sin_dato'),
    'cuidadoEspecial', coalesce(e.cuidado_especial, false),
    'condicionEspecialNota', e.condicion_especial_nota
  );
$$;

CREATE OR REPLACE FUNCTION public.sie_actualizar_estudiante(p_token text, p_id integer, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rol text;
  v_puede_cuidado boolean;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR NOT public._sie_es_staff(v_rol) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  v_puede_cuidado := v_rol IN ('Admin', 'Director');

  UPDATE public.estudiantes SET
    nombre_completo = coalesce(p_payload->>'nombre_completo', nombre_completo),
    grado = coalesce(p_payload->>'grado', grado),
    seccion = coalesce(p_payload->>'seccion', seccion),
    nivel_educativo = coalesce(nullif(p_payload->>'nivel_educativo', '')::public.nivel_educativo, nivel_educativo),
    foto_perfil = CASE WHEN p_payload ? 'foto_perfil' THEN nullif(p_payload->>'foto_perfil', '') ELSE foto_perfil END,
    activo = coalesce((p_payload->>'activo')::boolean, activo),
    telefono_contacto = CASE WHEN p_payload ? 'telefono_contacto' THEN nullif(p_payload->>'telefono_contacto', '') ELSE telefono_contacto END,
    email_contacto = CASE WHEN p_payload ? 'email_contacto' THEN nullif(p_payload->>'email_contacto', '') ELSE email_contacto END,
    nombre_responsable = CASE WHEN p_payload ? 'nombre_responsable' THEN nullif(p_payload->>'nombre_responsable', '') ELSE nombre_responsable END,
    parentesco_responsable = CASE WHEN p_payload ? 'parentesco_responsable' THEN nullif(p_payload->>'parentesco_responsable', '') ELSE parentesco_responsable END,
    telefono_emergencia = CASE WHEN p_payload ? 'telefono_emergencia' THEN nullif(p_payload->>'telefono_emergencia', '') ELSE telefono_emergencia END,
    cuidado_especial = CASE
      WHEN v_puede_cuidado AND p_payload ? 'cuidado_especial'
        THEN coalesce((p_payload->>'cuidado_especial')::boolean, false)
      ELSE cuidado_especial
    END,
    condicion_especial_nota = CASE
      WHEN v_puede_cuidado AND p_payload ? 'condicion_especial_nota'
        THEN left(nullif(trim(p_payload->>'condicion_especial_nota'), ''), 200)
      ELSE condicion_especial_nota
    END
  WHERE id_estudiante = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Estudiante no encontrado');
  END IF;
  RETURN jsonb_build_object('ok', true, 'error', null);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
