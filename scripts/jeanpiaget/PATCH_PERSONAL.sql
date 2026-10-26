-- Jean Piaget: módulo Personal (asistencia de empleados del colegio).
-- Tablas propias (mismo criterio que taller_llegadas): no se tocan las de estudiantes,
-- así los triggers de outbox de estudiantes no avisan a padres por eventos del personal.
-- Idempotente. Aplicar con: python3 apply_patch.py [--check] PATCH_PERSONAL.sql

-- =============================================================================
-- 1) Personal
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.personal (
  id_personal serial PRIMARY KEY,
  codigo_barras varchar(20) NOT NULL UNIQUE,
  nombre_completo varchar(255) NOT NULL,
  categoria text NOT NULL,
  cargo text NULL,
  fecha_nacimiento date NULL,
  direccion text NULL,
  telefono varchar(20) NULL,
  email varchar(150) NULL,
  foto_perfil text NULL,
  activo boolean NOT NULL DEFAULT true,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_actualizacion timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal DROP CONSTRAINT IF EXISTS personal_categoria_check;
ALTER TABLE public.personal ADD CONSTRAINT personal_categoria_check CHECK (categoria IN (
  'Directivo y Jerárquico',
  'Administrativo',
  'Docente Inicial',
  'Docente Primaria',
  'Docente Secundaria',
  'Servicio y Mantenimiento'
));

CREATE INDEX IF NOT EXISTS idx_personal_categoria ON public.personal (categoria);

-- =============================================================================
-- 2) Horario semanal (una fila por día que asiste; sin fila = no le toca)
--    dia_semana: 1 = lunes … 7 = domingo (ISO)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.personal_horario (
  id_horario serial PRIMARY KEY,
  id_personal integer NOT NULL REFERENCES public.personal(id_personal) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_entrada time NOT NULL,
  hora_salida time NULL,
  UNIQUE (id_personal, dia_semana),
  CHECK (hora_salida IS NULL OR hora_salida > hora_entrada)
);

-- =============================================================================
-- 3) Llegadas / salidas del personal (una fila por empleado y día)
--    hora_*_esperada = foto del horario de ese día (cambiar el horario no reescribe historia)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.registros_llegada_personal (
  id_registro serial PRIMARY KEY,
  id_personal integer NOT NULL REFERENCES public.personal(id_personal) ON DELETE CASCADE,
  fecha date NOT NULL,
  hora_llegada time NOT NULL,
  estado varchar(20) NOT NULL,
  hora_entrada_esperada time NULL,
  hora_salida_esperada time NULL,
  registrado_por integer NULL REFERENCES public.usuarios(id_usuario),
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  hora_salida time NULL,
  registrado_salida_por integer NULL REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_salida timestamptz NULL,
  tipo_salida varchar(20) NULL,
  motivo_justificacion text NULL,
  justificado_por integer NULL REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  fecha_justificacion timestamptz NULL,
  UNIQUE (id_personal, fecha)
);

ALTER TABLE public.registros_llegada_personal DROP CONSTRAINT IF EXISTS registros_llegada_personal_estado_check;
ALTER TABLE public.registros_llegada_personal ADD CONSTRAINT registros_llegada_personal_estado_check
  CHECK (estado IN ('A tiempo', 'Tarde', 'Tarde justificada', 'Falta justificada', 'Falta', 'Fuera de horario'));

ALTER TABLE public.registros_llegada_personal DROP CONSTRAINT IF EXISTS registros_llegada_personal_tipo_salida_check;
ALTER TABLE public.registros_llegada_personal ADD CONSTRAINT registros_llegada_personal_tipo_salida_check
  CHECK (tipo_salida IS NULL OR tipo_salida IN ('Normal', 'Anticipada', 'Autorizada'));

CREATE INDEX IF NOT EXISTS idx_rlp_fecha ON public.registros_llegada_personal (fecha);
CREATE INDEX IF NOT EXISTS idx_rlp_personal_fecha ON public.registros_llegada_personal (id_personal, fecha);

-- =============================================================================
-- 4) Incidencias del personal (mismo catálogo de faltas que estudiantes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.incidencias_personal (
  id_incidencia serial PRIMARY KEY,
  id_personal integer NOT NULL REFERENCES public.personal(id_personal) ON DELETE CASCADE,
  id_falta integer NOT NULL REFERENCES public.catalogo_faltas(id_falta),
  fecha_hora_registro timestamptz NOT NULL DEFAULT now(),
  id_usuario_registro integer NOT NULL REFERENCES public.usuarios(id_usuario),
  observaciones text NULL,
  estado public.estado_incidencia NOT NULL DEFAULT 'Activa',
  motivo_anulacion text NULL,
  id_usuario_anulacion integer NULL REFERENCES public.usuarios(id_usuario),
  fecha_anulacion timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_incp_personal ON public.incidencias_personal (id_personal);
CREATE INDEX IF NOT EXISTS idx_incp_fecha ON public.incidencias_personal (fecha_hora_registro);

-- =============================================================================
-- 5) Auditoría (trigger genérico existente)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_auditoria_personal ON public.personal;
CREATE TRIGGER trg_auditoria_personal AFTER INSERT OR DELETE OR UPDATE ON public.personal
  FOR EACH ROW EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_auditoria_registros_llegada_personal ON public.registros_llegada_personal;
CREATE TRIGGER trg_auditoria_registros_llegada_personal AFTER INSERT OR DELETE OR UPDATE ON public.registros_llegada_personal
  FOR EACH ROW EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

DROP TRIGGER IF EXISTS trg_auditoria_incidencias_personal ON public.incidencias_personal;
CREATE TRIGGER trg_auditoria_incidencias_personal AFTER INSERT OR DELETE OR UPDATE ON public.incidencias_personal
  FOR EACH ROW EXECUTE FUNCTION public.fn_sie_auditoria_trigger();

-- =============================================================================
-- 6) Permisos y RLS (patrón x-sie-token)
--    Staff (Admin/Director/Supervisor): todo. Tutor: leer personal/horario y
--    registrar llegadas/salidas (escáner).
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal, public.personal_horario,
  public.registros_llegada_personal, public.incidencias_personal TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.personal_id_personal_seq, public.personal_horario_id_horario_seq,
  public.registros_llegada_personal_id_registro_seq, public.incidencias_personal_id_incidencia_seq
  TO anon, authenticated;

ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_llegada_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias_personal ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personal', 'personal_horario', 'registros_llegada_personal', 'incidencias_personal'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS sie_%s_staff_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY sie_%s_staff_all ON public.%I FOR ALL TO anon, authenticated
         USING (public.sie_es_staff_sesion()) WITH CHECK (public.sie_es_staff_sesion())', t, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['personal', 'personal_horario', 'registros_llegada_personal'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS sie_%s_tutor_sel ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY sie_%s_tutor_sel ON public.%I FOR SELECT TO anon, authenticated
         USING (public.sie_sesion_rol() = ''Tutor'' AND public.sie_tiene_sesion())', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS sie_registros_llegada_personal_tutor_ins ON public.registros_llegada_personal;
CREATE POLICY sie_registros_llegada_personal_tutor_ins ON public.registros_llegada_personal FOR INSERT TO anon, authenticated
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_registros_llegada_personal_tutor_upd ON public.registros_llegada_personal;
CREATE POLICY sie_registros_llegada_personal_tutor_upd ON public.registros_llegada_personal FOR UPDATE TO anon, authenticated
  USING (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion())
  WITH CHECK (public.sie_sesion_rol() = 'Tutor' AND public.sie_tiene_sesion());

-- =============================================================================
-- 7) Estado de llegada: tarde desde el minuto siguiente a su hora de entrada.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._sie_estado_llegada_personal(p_hora time, p_hora_esperada time)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_hora_esperada IS NULL THEN 'Fuera de horario'
    WHEN date_trunc('minute', p_hora) <= date_trunc('minute', p_hora_esperada) THEN 'A tiempo'
    ELSE 'Tarde'
  END;
$$;

-- =============================================================================
-- 8) Cierre del día: Falta + incidencia para quien debía asistir y no marcó.
--    No pisa justificaciones ni llegadas reales.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sie_jp_marcar_faltas_personal_dia(
  p_fecha date DEFAULT (timezone('America/Lima', now()))::date
)
RETURNS TABLE(personal_marcado integer, incidencias_creadas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id_falta int;
  v_id_user int;
  v_dia smallint := EXTRACT(ISODOW FROM p_fecha)::smallint;
  v_marcados int := 0;
  v_inc int := 0;
  r record;
BEGIN
  IF p_fecha > (timezone('America/Lima', now()))::date
     OR EXISTS (SELECT 1 FROM calendario_no_lectivo c WHERE c.fecha = p_fecha AND c.activo IS TRUE)
  THEN
    personal_marcado := 0;
    incidencias_creadas := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT id_falta INTO v_id_falta
  FROM catalogo_faltas
  WHERE lower(nombre_falta) = 'falta' AND COALESCE(activo, true)
  ORDER BY id_falta LIMIT 1;

  IF v_id_falta IS NULL THEN
    RAISE EXCEPTION 'No existe catalogo_faltas «Falta» activa';
  END IF;

  SELECT id_usuario INTO v_id_user FROM usuarios WHERE rol IN ('Admin', 'Director') ORDER BY id_usuario LIMIT 1;
  IF v_id_user IS NULL THEN
    SELECT id_usuario INTO v_id_user FROM usuarios ORDER BY id_usuario LIMIT 1;
  END IF;

  FOR r IN
    SELECT p.id_personal, h.hora_entrada, h.hora_salida
    FROM personal p
    JOIN personal_horario h ON h.id_personal = p.id_personal AND h.dia_semana = v_dia
    WHERE p.activo
      AND p.fecha_creacion::date <= p_fecha
      AND NOT EXISTS (
        SELECT 1 FROM registros_llegada_personal rl
        WHERE rl.id_personal = p.id_personal AND rl.fecha = p_fecha
      )
  LOOP
    INSERT INTO registros_llegada_personal (
      id_personal, fecha, hora_llegada, estado, hora_entrada_esperada, hora_salida_esperada, registrado_por
    ) VALUES (
      r.id_personal, p_fecha, TIME '00:00:00', 'Falta', r.hora_entrada, r.hora_salida, v_id_user
    )
    ON CONFLICT (id_personal, fecha) DO NOTHING;

    IF FOUND THEN
      v_marcados := v_marcados + 1;
      IF NOT EXISTS (
        SELECT 1 FROM incidencias_personal i
        WHERE i.id_personal = r.id_personal
          AND i.id_falta = v_id_falta
          AND i.estado IS DISTINCT FROM 'Anulada'
          AND (timezone('America/Lima', i.fecha_hora_registro))::date = p_fecha
      ) THEN
        INSERT INTO incidencias_personal (id_personal, id_falta, id_usuario_registro, observaciones, fecha_hora_registro)
        VALUES (
          r.id_personal, v_id_falta, v_id_user,
          'Generada automáticamente: sin registro de entrada al cierre de jornada.',
          (p_fecha + time '20:00') AT TIME ZONE 'America/Lima'
        );
        v_inc := v_inc + 1;
      END IF;
    END IF;
  END LOOP;

  personal_marcado := v_marcados;
  incidencias_creadas := v_inc;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sie_jp_marcar_faltas_personal_dia(date) IS
  'JP: marca Falta + incidencia al personal que debía asistir (personal_horario) y no registró llegada; omite calendario_no_lectivo.';

REVOKE ALL ON FUNCTION public.sie_jp_marcar_faltas_personal_dia(date) FROM PUBLIC, anon, authenticated;
