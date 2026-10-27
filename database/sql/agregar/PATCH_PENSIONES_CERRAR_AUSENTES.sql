-- Excel de deudas: poner al día a los alumnos que ya no salen en el archivo.
-- Antes bastaba una fila sin match para no cerrar a nadie. Ahora el panel lista
-- a los ausentes y envía p_cerrar_ids con los que el usuario confirmó.
-- Requiere PATCH_CAJERO_PENSIONES_RECONCILIAR.sql.

-- Impagos en los meses del archivo (para la vista previa de ausentes).
CREATE OR REPLACE FUNCTION public.sie_pensiones_impagos_periodos(p_periodos text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public._sie_puede_pensiones() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permiso');
  END IF;
  IF p_periodos IS NULL OR cardinality(p_periodos) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'rows', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'idEstudiante', x.id_estudiante,
      'nombreEstudiante', x.nombre_completo,
      'grado', x.grado,
      'seccion', x.seccion,
      'nivel', x.nivel,
      'periodos', x.periodos
    )
    ORDER BY x.nombre_completo
  ), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      p.id_estudiante,
      e.nombre_completo,
      e.grado,
      e.seccion,
      e.nivel_educativo::text AS nivel,
      array_agg(p.periodo ORDER BY p.periodo) AS periodos
    FROM public.pensiones p
    JOIN public.estudiantes e ON e.id_estudiante = p.id_estudiante
    WHERE p.pagado = 0
      AND p.periodo = ANY(p_periodos)
    GROUP BY p.id_estudiante, e.nombre_completo, e.grado, e.seccion, e.nivel_educativo
  ) x;

  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sie_pensiones_impagos_periodos(text[])
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.sie_pensiones_reconciliar_deudas(integer, integer[], jsonb, text, integer, integer);

CREATE OR REPLACE FUNCTION public.sie_pensiones_reconciliar_deudas(
  p_anio integer,
  p_meses integer[],
  p_deudas jsonb,
  p_nombre_archivo text DEFAULT NULL,
  p_filas_sin_match integer DEFAULT 0,
  p_filas_ambiguas integer DEFAULT 0,
  p_cerrar_ids integer[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_cfg public.pensiones_config%ROWTYPE;
  v_hoy date := public._sie_hoy_lima();
  v_user int;
  v_deuda jsonb;
  v_id int;
  v_month int;
  v_periodo text;
  v_venc date;
  v_estado text;
  v_meses_debe int[];
  v_periodos text[];
  v_ids int[];
  v_ok int := 0;
  v_pagados int := 0;
  v_cerrados int := 0;
  v_log_id bigint;
  v_cerrar boolean;
BEGIN
  IF NOT public._sie_puede_pensiones() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sin permiso');
  END IF;
  IF p_anio IS NULL OR p_anio < 2000 OR p_anio > 2100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Año inválido');
  END IF;
  IF p_meses IS NULL OR cardinality(p_meses) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El Excel no trae meses');
  END IF;
  IF p_deudas IS NULL OR jsonb_typeof(p_deudas) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deudas inválidas');
  END IF;

  SELECT * INTO v_cfg FROM public.pensiones_config WHERE id = 1;
  v_user := public.sie_sesion_usuario_id();
  -- Sin lista explícita se mantiene la regla antigua: cerrar solo si todo hizo match.
  v_cerrar := p_cerrar_ids IS NULL
    AND coalesce(p_filas_sin_match, 0) = 0
    AND coalesce(p_filas_ambiguas, 0) = 0;

  SELECT array_agg(to_char(make_date(p_anio, m, 1), 'YYYY-MM') ORDER BY m)
  INTO v_periodos
  FROM unnest(p_meses) AS m
  WHERE m BETWEEN 1 AND 12;

  CREATE TEMP TABLE IF NOT EXISTS tmp_pension_touch (id int PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE tmp_pension_touch;

  FOR v_deuda IN SELECT * FROM jsonb_array_elements(p_deudas)
  LOOP
    v_id := NULLIF(v_deuda->>'id_estudiante', '')::int;
    IF v_id IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO tmp_pension_touch (id) VALUES (v_id) ON CONFLICT DO NOTHING;
    v_ok := v_ok + 1;

    SELECT coalesce(array_agg(value::int), ARRAY[]::int[])
    INTO v_meses_debe
    FROM jsonb_array_elements_text(coalesce(v_deuda->'meses', '[]'::jsonb)) AS value;

    FOREACH v_month IN ARRAY p_meses
    LOOP
      IF v_month < 1 OR v_month > 12 THEN
        CONTINUE;
      END IF;
      v_periodo := to_char(make_date(p_anio, v_month, 1), 'YYYY-MM');
      v_venc := public._sie_fecha_vencimiento_periodo(v_periodo, v_cfg.dia_vencimiento);

      IF v_month = ANY(v_meses_debe) THEN
        IF v_hoy > v_venc THEN
          v_estado := 'moroso';
        ELSE
          v_estado := 'pendiente';
        END IF;
        INSERT INTO public.pensiones (
          id_estudiante, periodo, fecha_vencimiento, pagado, estado,
          monto, fuente, registrado_por, actualizado_en
        ) VALUES (
          v_id, v_periodo, v_venc, 0, v_estado,
          v_cfg.monto_mensual, 'banco_excel', v_user, now()
        )
        ON CONFLICT (id_estudiante, periodo) DO UPDATE SET
          fecha_vencimiento = EXCLUDED.fecha_vencimiento,
          pagado = 0,
          estado = EXCLUDED.estado,
          fecha_pago = NULL,
          fuente = EXCLUDED.fuente,
          monto = COALESCE(public.pensiones.monto, EXCLUDED.monto),
          actualizado_en = now();
      ELSE
        UPDATE public.pensiones
        SET pagado = 1,
            estado = 'pagado',
            fecha_pago = COALESCE(fecha_pago, v_hoy),
            actualizado_en = now()
        WHERE id_estudiante = v_id
          AND periodo = v_periodo
          AND pagado = 0;
        v_pagados := v_pagados + 1;
      END IF;
    END LOOP;
  END LOOP;

  SELECT coalesce(array_agg(id), ARRAY[]::int[]) INTO v_ids FROM tmp_pension_touch;

  IF p_cerrar_ids IS NOT NULL AND cardinality(p_cerrar_ids) > 0 THEN
    -- Ausentes confirmados en la vista previa; nunca a quien viene en el archivo.
    INSERT INTO tmp_pension_touch (id)
    SELECT DISTINCT p.id_estudiante
    FROM public.pensiones p
    WHERE p.pagado = 0
      AND p.periodo = ANY(v_periodos)
      AND p.id_estudiante = ANY(p_cerrar_ids)
      AND NOT (p.id_estudiante = ANY(v_ids))
    ON CONFLICT DO NOTHING;

    UPDATE public.pensiones p
    SET pagado = 1,
        estado = 'pagado',
        fecha_pago = COALESCE(p.fecha_pago, v_hoy),
        actualizado_en = now()
    WHERE p.pagado = 0
      AND p.periodo = ANY(v_periodos)
      AND p.id_estudiante = ANY(p_cerrar_ids)
      AND NOT (p.id_estudiante = ANY(v_ids));
    GET DIAGNOSTICS v_cerrados = ROW_COUNT;
  ELSIF v_cerrar THEN
    INSERT INTO tmp_pension_touch (id)
    SELECT DISTINCT p.id_estudiante
    FROM public.pensiones p
    WHERE p.pagado = 0
      AND p.periodo = ANY(v_periodos)
      AND NOT (p.id_estudiante = ANY(v_ids))
    ON CONFLICT DO NOTHING;

    UPDATE public.pensiones p
    SET pagado = 1,
        estado = 'pagado',
        fecha_pago = COALESCE(p.fecha_pago, v_hoy),
        actualizado_en = now()
    WHERE p.pagado = 0
      AND p.periodo = ANY(v_periodos)
      AND NOT (p.id_estudiante = ANY(v_ids));
    GET DIAGNOSTICS v_cerrados = ROW_COUNT;
  END IF;

  UPDATE public.estudiantes e
  SET estado_pension = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.pensiones p
      WHERE p.id_estudiante = e.id_estudiante AND p.pagado = 0
    ) THEN 'moroso'
    ELSE 'al_dia'
  END
  WHERE e.id_estudiante IN (SELECT id FROM tmp_pension_touch);

  PERFORM public.marcar_pensiones_morosas();

  INSERT INTO public.pensiones_import_log (
    periodo, modo, nombre_archivo, filas_leidas, filas_ok,
    filas_sin_match, filas_ambiguas, fuente, importado_por
  ) VALUES (
    to_char(make_date(p_anio, (SELECT min(m) FROM unnest(p_meses) AS m), 1), 'YYYY-MM'),
    'no_pagaron',
    p_nombre_archivo,
    v_ok,
    v_ok,
    coalesce(p_filas_sin_match, 0),
    coalesce(p_filas_ambiguas, 0),
    'banco_excel',
    v_user
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'ok', true,
    'importId', v_log_id,
    'filasOk', v_ok,
    'marcadosPagados', v_pagados,
    'cerroAusentes', v_cerrar OR v_cerrados > 0,
    'cerrados', v_cerrados
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sie_pensiones_reconciliar_deudas(integer, integer[], jsonb, text, integer, integer, integer[])
  TO anon, authenticated, service_role;
