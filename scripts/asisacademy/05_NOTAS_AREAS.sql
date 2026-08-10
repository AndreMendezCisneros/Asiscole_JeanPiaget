-- =============================================================================
-- 05_NOTAS_AREAS.sql — Notas semanales por área (Asis Academy)
-- Idempotente. Escala nota 0–20. Semanas configurables.
-- =============================================================================

-- 1) Catálogo áreas
CREATE TABLE IF NOT EXISTS public.notas_areas (
  id smallserial PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  orden smallint NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true
);

INSERT INTO public.notas_areas (codigo, nombre, descripcion, orden) VALUES
  ('salud', 'Ciencias de la Salud', 'Biología humana, medicina y cuidado de la salud', 1),
  ('ingenierias', 'Ingenierías y Ciencias Básicas / Exactas', 'Matemática, física, lógica y procesos técnicos', 2),
  ('letras', 'Letras, Ciencias Sociales y Económicas', 'Humanidades, derecho, gestión, educación y comunicación', 3)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden,
  activo = true;

-- 2) Carreras
CREATE TABLE IF NOT EXISTS public.notas_carreras (
  id serial PRIMARY KEY,
  area_id smallint NOT NULL REFERENCES public.notas_areas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  UNIQUE (area_id, nombre)
);

INSERT INTO public.notas_carreras (area_id, nombre)
SELECT a.id, c.nombre
FROM public.notas_areas a
JOIN (VALUES
  ('salud', 'Medicina Humana'),
  ('salud', 'Enfermería'),
  ('salud', 'Obstetricia'),
  ('salud', 'Odontología / Estomatología'),
  ('salud', 'Farmacia y Bioquímica'),
  ('salud', 'Tecnología Médica / Biología'),
  ('ingenierias', 'Ingeniería de Sistemas / Software'),
  ('ingenierias', 'Ingeniería Civil'),
  ('ingenierias', 'Ingeniería Agrícola / Agronomía'),
  ('ingenierias', 'Ingeniería de Minas'),
  ('ingenierias', 'Arquitectura'),
  ('ingenierias', 'Estadística / Matemáticas / Física'),
  ('letras', 'Derecho / Ciencias Políticas'),
  ('letras', 'Administración de Empresas'),
  ('letras', 'Contabilidad / Economía'),
  ('letras', 'Educación'),
  ('letras', 'Ciencias de la Comunicación'),
  ('letras', 'Trabajo Social / Antropología / Arqueología')
) AS c(area_codigo, nombre) ON c.area_codigo = a.codigo
ON CONFLICT (area_id, nombre) DO NOTHING;

-- 3) Semanas configurables
CREATE TABLE IF NOT EXISTS public.notas_semanas (
  id serial PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  etiqueta text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  abierta_declaracion boolean NOT NULL DEFAULT true,
  abierta_carga_notas boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

-- 4) Declaración de área por semana
CREATE TABLE IF NOT EXISTS public.notas_declaracion_semana (
  id bigserial PRIMARY KEY,
  id_estudiante integer NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  semana_id integer NOT NULL REFERENCES public.notas_semanas(id) ON DELETE CASCADE,
  area_id smallint NOT NULL REFERENCES public.notas_areas(id),
  carrera_id integer NULL REFERENCES public.notas_carreras(id) ON DELETE SET NULL,
  declarado_en timestamptz NOT NULL DEFAULT now(),
  declarado_por integer NULL REFERENCES public.usuarios(id_usuario),
  UNIQUE (id_estudiante, semana_id)
);

CREATE INDEX IF NOT EXISTS idx_notas_decl_semana ON public.notas_declaracion_semana (semana_id);
CREATE INDEX IF NOT EXISTS idx_notas_decl_area ON public.notas_declaracion_semana (area_id);

-- 5) Notas
CREATE TABLE IF NOT EXISTS public.notas_semana (
  id bigserial PRIMARY KEY,
  id_estudiante integer NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  semana_id integer NOT NULL REFERENCES public.notas_semanas(id) ON DELETE CASCADE,
  area_id smallint NOT NULL REFERENCES public.notas_areas(id),
  carrera_id integer NULL REFERENCES public.notas_carreras(id) ON DELETE SET NULL,
  nota numeric(5,2) NOT NULL CHECK (nota >= 0 AND nota <= 20),
  observacion text,
  fuente text NOT NULL DEFAULT 'excel',
  import_log_id bigint,
  registrado_en timestamptz NOT NULL DEFAULT now(),
  registrado_por integer NULL REFERENCES public.usuarios(id_usuario),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_estudiante, semana_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_notas_semana_semana ON public.notas_semana (semana_id);
CREATE INDEX IF NOT EXISTS idx_notas_semana_area ON public.notas_semana (area_id);

-- 6) Import log
CREATE TABLE IF NOT EXISTS public.notas_import_log (
  id bigserial PRIMARY KEY,
  semana_id integer NOT NULL REFERENCES public.notas_semanas(id) ON DELETE CASCADE,
  nombre_archivo text,
  filas_leidas integer NOT NULL DEFAULT 0,
  filas_ok integer NOT NULL DEFAULT 0,
  filas_sin_match integer NOT NULL DEFAULT 0,
  filas_sin_declaracion integer NOT NULL DEFAULT 0,
  filas_ambiguas integer NOT NULL DEFAULT 0,
  importado_por integer NULL REFERENCES public.usuarios(id_usuario),
  importado_en timestamptz NOT NULL DEFAULT now(),
  detalle_json jsonb
);

ALTER TABLE public.notas_semana
  DROP CONSTRAINT IF EXISTS notas_semana_import_log_id_fkey;
ALTER TABLE public.notas_semana
  ADD CONSTRAINT notas_semana_import_log_id_fkey
  FOREIGN KEY (import_log_id) REFERENCES public.notas_import_log(id) ON DELETE SET NULL;

-- 7) Grants + RLS
GRANT SELECT ON public.notas_areas TO anon, authenticated;
GRANT SELECT ON public.notas_carreras TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notas_semanas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_declaracion_semana TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_semana TO anon, authenticated;
GRANT SELECT, INSERT ON public.notas_import_log TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

ALTER TABLE public.notas_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_carreras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_declaracion_semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_import_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sie_notas_areas_select ON public.notas_areas;
CREATE POLICY sie_notas_areas_select ON public.notas_areas FOR SELECT TO anon, authenticated
  USING (public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_notas_carreras_select ON public.notas_carreras;
CREATE POLICY sie_notas_carreras_select ON public.notas_carreras FOR SELECT TO anon, authenticated
  USING (public.sie_tiene_sesion());

DROP POLICY IF EXISTS sie_notas_semanas_staff ON public.notas_semanas;
CREATE POLICY sie_notas_semanas_staff ON public.notas_semanas FOR ALL TO anon, authenticated
  USING (public.sie_es_staff_sesion() OR public._sie_es_admin_o_director())
  WITH CHECK (public._sie_es_admin_o_director());

DROP POLICY IF EXISTS sie_notas_decl_staff ON public.notas_declaracion_semana;
CREATE POLICY sie_notas_decl_staff ON public.notas_declaracion_semana FOR ALL TO anon, authenticated
  USING (public._sie_es_admin_o_director())
  WITH CHECK (public._sie_es_admin_o_director());

DROP POLICY IF EXISTS sie_notas_nota_staff ON public.notas_semana;
CREATE POLICY sie_notas_nota_staff ON public.notas_semana FOR ALL TO anon, authenticated
  USING (public._sie_es_admin_o_director())
  WITH CHECK (public._sie_es_admin_o_director());

DROP POLICY IF EXISTS sie_notas_log_staff ON public.notas_import_log;
CREATE POLICY sie_notas_log_staff ON public.notas_import_log FOR ALL TO anon, authenticated
  USING (public._sie_es_admin_o_director())
  WITH CHECK (public._sie_es_admin_o_director());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._sie_es_admin_o_director()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.sie_tiene_sesion()
    AND public.sie_sesion_rol() IN ('Admin', 'Director');
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_listar_areas()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sie_tiene_sesion() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin sesión');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'areas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'codigo', a.codigo, 'nombre', a.nombre,
        'descripcion', a.descripcion, 'orden', a.orden
      ) ORDER BY a.orden)
      FROM public.notas_areas a WHERE a.activo
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_listar_carreras(p_area_id int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sie_tiene_sesion() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin sesión');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'carreras', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'areaId', c.area_id, 'nombre', c.nombre
      ) ORDER BY c.nombre)
      FROM public.notas_carreras c
      WHERE c.activo AND (p_area_id IS NULL OR c.area_id = p_area_id)
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_listar_semanas(p_solo_activas boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sie_tiene_sesion() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin sesión');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'semanas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'etiqueta', s.etiqueta,
        'fechaInicio', s.fecha_inicio,
        'fechaFin', s.fecha_fin,
        'abiertaDeclaracion', s.abierta_declaracion,
        'abiertaCargaNotas', s.abierta_carga_notas,
        'activo', s.activo
      ) ORDER BY s.fecha_inicio DESC)
      FROM public.notas_semanas s
      WHERE (NOT p_solo_activas) OR s.activo
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_upsert_semana(
  p_id int DEFAULT NULL,
  p_codigo text DEFAULT NULL,
  p_etiqueta text DEFAULT NULL,
  p_fecha_inicio date DEFAULT NULL,
  p_fecha_fin date DEFAULT NULL,
  p_abierta_declaracion boolean DEFAULT NULL,
  p_abierta_carga_notas boolean DEFAULT NULL,
  p_activo boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.notas_semanas%ROWTYPE;
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;

  IF p_id IS NULL THEN
    IF p_codigo IS NULL OR p_etiqueta IS NULL OR p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Faltan datos para crear la semana');
    END IF;
    INSERT INTO public.notas_semanas (
      codigo, etiqueta, fecha_inicio, fecha_fin,
      abierta_declaracion, abierta_carga_notas, activo
    ) VALUES (
      trim(p_codigo), trim(p_etiqueta), p_fecha_inicio, p_fecha_fin,
      coalesce(p_abierta_declaracion, true),
      coalesce(p_abierta_carga_notas, true),
      coalesce(p_activo, true)
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.notas_semanas SET
      codigo = coalesce(nullif(trim(p_codigo), ''), codigo),
      etiqueta = coalesce(nullif(trim(p_etiqueta), ''), etiqueta),
      fecha_inicio = coalesce(p_fecha_inicio, fecha_inicio),
      fecha_fin = coalesce(p_fecha_fin, fecha_fin),
      abierta_declaracion = coalesce(p_abierta_declaracion, abierta_declaracion),
      abierta_carga_notas = coalesce(p_abierta_carga_notas, abierta_carga_notas),
      activo = coalesce(p_activo, activo),
      actualizado_en = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Semana no encontrada');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'semana', jsonb_build_object(
      'id', v_row.id,
      'codigo', v_row.codigo,
      'etiqueta', v_row.etiqueta,
      'fechaInicio', v_row.fecha_inicio,
      'fechaFin', v_row.fecha_fin,
      'abiertaDeclaracion', v_row.abierta_declaracion,
      'abiertaCargaNotas', v_row.abierta_carga_notas,
      'activo', v_row.activo
    )
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Ya existe una semana con ese código');
WHEN check_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'Fechas inválidas');
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_listar_declaraciones(p_semana_id int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;
  IF p_semana_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Falta semana');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'declaraciones', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'idEstudiante', d.id_estudiante,
        'nombreEstudiante', e.nombre_completo,
        'barcode', e.codigo_barras,
        'semanaId', d.semana_id,
        'areaId', d.area_id,
        'areaNombre', a.nombre,
        'carreraId', d.carrera_id,
        'carreraNombre', c.nombre,
        'declaradoEn', d.declarado_en
      ) ORDER BY e.nombre_completo)
      FROM public.notas_declaracion_semana d
      JOIN public.estudiantes e ON e.id_estudiante = d.id_estudiante
      JOIN public.notas_areas a ON a.id = d.area_id
      LEFT JOIN public.notas_carreras c ON c.id = d.carrera_id
      WHERE d.semana_id = p_semana_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_upsert_declaraciones(
  p_semana_id int,
  p_filas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_semana public.notas_semanas%ROWTYPE;
  v_item jsonb;
  v_ok int := 0;
  v_fail int := 0;
  v_uid int;
  v_carrera int;
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;
  SELECT * INTO v_semana FROM public.notas_semanas WHERE id = p_semana_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Semana no encontrada');
  END IF;
  IF NOT v_semana.abierta_declaracion THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La declaración de esta semana está cerrada');
  END IF;
  v_uid := public.sie_sesion_usuario_id();

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_filas, '[]'::jsonb))
  LOOP
    BEGIN
      v_carrera := nullif(v_item->>'carrera_id', '')::int;
      IF v_carrera IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.notas_carreras
          WHERE id = v_carrera AND area_id = (v_item->>'area_id')::int
        ) THEN
          v_fail := v_fail + 1;
          CONTINUE;
        END IF;
      END IF;
      INSERT INTO public.notas_declaracion_semana (
        id_estudiante, semana_id, area_id, carrera_id, declarado_por
      ) VALUES (
        (v_item->>'id_estudiante')::int,
        p_semana_id,
        (v_item->>'area_id')::int,
        v_carrera,
        v_uid
      )
      ON CONFLICT (id_estudiante, semana_id) DO UPDATE SET
        area_id = EXCLUDED.area_id,
        carrera_id = EXCLUDED.carrera_id,
        declarado_en = now(),
        declarado_por = EXCLUDED.declarado_por;
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'okCount', v_ok, 'failCount', v_fail);
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_listar(p_semana_id int, p_area_id int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'notas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id,
        'idEstudiante', n.id_estudiante,
        'nombreEstudiante', e.nombre_completo,
        'barcode', e.codigo_barras,
        'semanaId', n.semana_id,
        'areaId', n.area_id,
        'areaNombre', a.nombre,
        'carreraId', n.carrera_id,
        'carreraNombre', c.nombre,
        'nota', n.nota,
        'observacion', n.observacion,
        'registradoEn', n.registrado_en
      ) ORDER BY a.orden, n.nota DESC, e.nombre_completo)
      FROM public.notas_semana n
      JOIN public.estudiantes e ON e.id_estudiante = n.id_estudiante
      JOIN public.notas_areas a ON a.id = n.area_id
      LEFT JOIN public.notas_carreras c ON c.id = n.carrera_id
      WHERE n.semana_id = p_semana_id
        AND (p_area_id IS NULL OR n.area_id = p_area_id)
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_upsert_lote(
  p_semana_id int,
  p_filas jsonb,
  p_nombre_archivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_semana public.notas_semanas%ROWTYPE;
  v_item jsonb;
  v_ok int := 0;
  v_sin_match int := 0;
  v_sin_decl int := 0;
  v_amb int := 0;
  v_leidas int := 0;
  v_uid int;
  v_log_id bigint;
  v_est int;
  v_decl public.notas_declaracion_semana%ROWTYPE;
  v_nota numeric;
  v_area_id smallint;
  v_carrera_id int;
  v_area_txt text;
  v_carrera_txt text;
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;
  SELECT * INTO v_semana FROM public.notas_semanas WHERE id = p_semana_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Semana no encontrada');
  END IF;
  IF NOT v_semana.abierta_carga_notas THEN
    RETURN jsonb_build_object('ok', false, 'error', 'La carga de notas de esta semana está cerrada');
  END IF;
  v_uid := public.sie_sesion_usuario_id();
  v_leidas := jsonb_array_length(coalesce(p_filas, '[]'::jsonb));

  INSERT INTO public.notas_import_log (semana_id, nombre_archivo, filas_leidas, importado_por)
  VALUES (p_semana_id, p_nombre_archivo, v_leidas, v_uid)
  RETURNING id INTO v_log_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_filas, '[]'::jsonb))
  LOOP
    BEGIN
      IF coalesce(v_item->>'match_status', 'ok') = 'sin_match' THEN
        v_sin_match := v_sin_match + 1;
        CONTINUE;
      END IF;
      IF coalesce(v_item->>'match_status', 'ok') = 'ambiguo' THEN
        v_amb := v_amb + 1;
        CONTINUE;
      END IF;
      v_est := (v_item->>'id_estudiante')::int;
      SELECT * INTO v_decl
      FROM public.notas_declaracion_semana
      WHERE id_estudiante = v_est AND semana_id = p_semana_id;

      -- Sin declaración previa: crear desde carrera/área del Excel
      IF NOT FOUND THEN
        v_area_id := NULL;
        v_carrera_id := NULL;
        v_area_txt := nullif(trim(coalesce(v_item->>'area_codigo', v_item->>'area_nombre', '')), '');
        v_carrera_txt := nullif(trim(coalesce(v_item->>'carrera_nombre', '')), '');

        IF nullif(v_item->>'carrera_id', '') IS NOT NULL THEN
          SELECT c.id, c.area_id INTO v_carrera_id, v_area_id
          FROM public.notas_carreras c
          WHERE c.id = (v_item->>'carrera_id')::int AND c.activo
          LIMIT 1;
        END IF;

        IF v_area_id IS NULL AND nullif(v_item->>'area_id', '') IS NOT NULL THEN
          SELECT a.id INTO v_area_id
          FROM public.notas_areas a
          WHERE a.id = (v_item->>'area_id')::smallint AND a.activo
          LIMIT 1;
        END IF;

        IF v_carrera_id IS NULL AND v_carrera_txt IS NOT NULL THEN
          SELECT c.id, c.area_id INTO v_carrera_id, v_area_id
          FROM public.notas_carreras c
          WHERE c.activo
            AND (
              lower(c.nombre) = lower(v_carrera_txt)
              OR lower(c.nombre) LIKE '%' || lower(v_carrera_txt) || '%'
              OR lower(v_carrera_txt) LIKE '%' || lower(c.nombre) || '%'
            )
          ORDER BY
            CASE WHEN lower(c.nombre) = lower(v_carrera_txt) THEN 0 ELSE 1 END,
            length(c.nombre)
          LIMIT 1;
        END IF;

        IF v_area_id IS NULL AND v_area_txt IS NOT NULL THEN
          SELECT a.id INTO v_area_id
          FROM public.notas_areas a
          WHERE a.activo
            AND (
              lower(a.codigo) = lower(v_area_txt)
              OR lower(a.nombre) = lower(v_area_txt)
              OR lower(a.nombre) LIKE '%' || lower(v_area_txt) || '%'
              OR lower(v_area_txt) LIKE '%' || lower(a.codigo) || '%'
            )
          ORDER BY
            CASE WHEN lower(a.codigo) = lower(v_area_txt) THEN 0
                 WHEN lower(a.nombre) = lower(v_area_txt) THEN 1
                 ELSE 2 END
          LIMIT 1;
        END IF;

        IF v_area_id IS NULL THEN
          v_sin_decl := v_sin_decl + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.notas_declaracion_semana (
          id_estudiante, semana_id, area_id, carrera_id, declarado_por
        ) VALUES (
          v_est, p_semana_id, v_area_id, v_carrera_id, v_uid
        )
        ON CONFLICT (id_estudiante, semana_id) DO UPDATE SET
          area_id = EXCLUDED.area_id,
          carrera_id = COALESCE(EXCLUDED.carrera_id, public.notas_declaracion_semana.carrera_id),
          declarado_por = EXCLUDED.declarado_por,
          declarado_en = now()
        RETURNING * INTO v_decl;
      ELSIF nullif(trim(coalesce(v_item->>'carrera_nombre', '')), '') IS NOT NULL
            AND v_decl.carrera_id IS NULL THEN
        -- Completar carrera si la declaración no la tenía
        SELECT c.id INTO v_carrera_id
        FROM public.notas_carreras c
        WHERE c.activo
          AND c.area_id = v_decl.area_id
          AND (
            lower(c.nombre) = lower(trim(v_item->>'carrera_nombre'))
            OR lower(c.nombre) LIKE '%' || lower(trim(v_item->>'carrera_nombre')) || '%'
          )
        ORDER BY length(c.nombre)
        LIMIT 1;
        IF v_carrera_id IS NOT NULL THEN
          UPDATE public.notas_declaracion_semana
          SET carrera_id = v_carrera_id, declarado_en = now()
          WHERE id = v_decl.id
          RETURNING * INTO v_decl;
        END IF;
      END IF;

      v_nota := (v_item->>'nota')::numeric;
      IF v_nota < 0 OR v_nota > 20 THEN
        v_sin_match := v_sin_match + 1;
        CONTINUE;
      END IF;
      INSERT INTO public.notas_semana (
        id_estudiante, semana_id, area_id, carrera_id, nota, observacion,
        fuente, import_log_id, registrado_por
      ) VALUES (
        v_est, p_semana_id, v_decl.area_id, v_decl.carrera_id, v_nota,
        nullif(v_item->>'observacion', ''),
        'excel', v_log_id, v_uid
      )
      ON CONFLICT (id_estudiante, semana_id, area_id) DO UPDATE SET
        nota = EXCLUDED.nota,
        observacion = EXCLUDED.observacion,
        carrera_id = COALESCE(EXCLUDED.carrera_id, public.notas_semana.carrera_id),
        import_log_id = EXCLUDED.import_log_id,
        registrado_por = EXCLUDED.registrado_por,
        actualizado_en = now();
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_sin_match := v_sin_match + 1;
    END;
  END LOOP;

  UPDATE public.notas_import_log SET
    filas_ok = v_ok,
    filas_sin_match = v_sin_match,
    filas_sin_declaracion = v_sin_decl,
    filas_ambiguas = v_amb
  WHERE id = v_log_id;

  RETURN jsonb_build_object(
    'ok', true,
    'importLogId', v_log_id,
    'filasLeidas', v_leidas,
    'filasOk', v_ok,
    'filasSinMatch', v_sin_match,
    'filasSinDeclaracion', v_sin_decl,
    'filasAmbiguas', v_amb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_ranking(p_semana_id int, p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit int := greatest(coalesce(p_limit, 10), 1);
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'porArea', coalesce((
      SELECT jsonb_agg(area_block ORDER BY (area_block->>'orden')::int)
      FROM (
        SELECT jsonb_build_object(
          'areaId', a.id,
          'areaCodigo', a.codigo,
          'areaNombre', a.nombre,
          'orden', a.orden,
          'top', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'idEstudiante', x.id_estudiante,
              'nombreEstudiante', x.nombre_completo,
              'barcode', x.codigo_barras,
              'nota', x.nota,
              'puesto', x.rn
            ) ORDER BY x.rn)
            FROM (
              SELECT n.id_estudiante, e.nombre_completo, e.codigo_barras, n.nota,
                     row_number() OVER (ORDER BY n.nota DESC, e.nombre_completo) AS rn
              FROM public.notas_semana n
              JOIN public.estudiantes e ON e.id_estudiante = n.id_estudiante
              WHERE n.semana_id = p_semana_id AND n.area_id = a.id
            ) x
            WHERE x.rn <= v_limit
          ), '[]'::jsonb)
        ) AS area_block
        FROM public.notas_areas a
        WHERE a.activo
      ) q
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sie_notas_import_logs(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._sie_es_admin_o_director() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo Admin o Director');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'logs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'semanaId', l.semana_id,
        'semanaCodigo', s.codigo,
        'nombreArchivo', l.nombre_archivo,
        'filasLeidas', l.filas_leidas,
        'filasOk', l.filas_ok,
        'filasSinMatch', l.filas_sin_match,
        'filasSinDeclaracion', l.filas_sin_declaracion,
        'filasAmbiguas', l.filas_ambiguas,
        'importadoEn', l.importado_en
      ) ORDER BY l.importado_en DESC)
      FROM (
        SELECT * FROM public.notas_import_log ORDER BY importado_en DESC LIMIT greatest(coalesce(p_limit, 20), 1)
      ) l
      JOIN public.notas_semanas s ON s.id = l.semana_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_notas_listar_areas() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_listar_carreras(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_listar_semanas(boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_upsert_semana(int, text, text, date, date, boolean, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_listar_declaraciones(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_upsert_declaraciones(int, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_listar(int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_upsert_lote(int, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_ranking(int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_notas_import_logs(int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
