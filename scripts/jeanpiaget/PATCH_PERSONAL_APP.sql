-- Jean Piaget: el personal en la app Asiscole, igual que los estudiantes.
-- Un celular de Promotoría queda vinculado a todos los empleados activos; ese
-- celular inicia sesión en la app con el DNI de cualquier empleado y recibe
-- sus llegadas, salidas, inasistencias e incidencias.
-- El canal lee la vista asis_v_directorio_personal además de `estudiantes`.
-- Id en la app = 1 000 000 + id_personal (no choca con id_estudiante).
-- Idempotente.

INSERT INTO public.configuracion_sistema (clave, valor, descripcion)
VALUES ('promotoria_telefono', '963852741',
        'Celular(es) de la Promotoría vinculados en la app a todo el personal, separados por coma')
ON CONFLICT (clave) DO NOTHING;

CREATE OR REPLACE VIEW public.asis_v_directorio_personal AS
SELECT 1000000 + p.id_personal AS id_estudiante,
       p.codigo_barras,
       p.nombre_completo,
       'Personal'::text AS grado,
       p.categoria AS seccion,
       'Personal'::text AS nivel_educativo,
       c.valor AS telefono
  FROM public.personal p
 CROSS JOIN (
       SELECT valor FROM public.configuracion_sistema
        WHERE clave = 'promotoria_telefono' AND nullif(btrim(valor), '') IS NOT NULL
 ) c
 WHERE p.activo;

COMMENT ON VIEW public.asis_v_directorio_personal IS
  'Directorio del canal para el personal: cada empleado activo vinculado al celular de Promotoría (id = 1000000 + id_personal).';

-- Configuración de Promotoría (solo RRHH).
CREATE OR REPLACE FUNCTION public.sie_promotoria_config(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('error', 'No autorizado');
  END IF;
  RETURN jsonb_build_object(
    'error', NULL,
    'telefono', coalesce((SELECT valor FROM configuracion_sistema WHERE clave = 'promotoria_telefono'), ''),
    'personal_activo', (SELECT count(*) FROM personal WHERE activo)
  );
END;
$$;

-- Guarda uno o varios celulares (9 dígitos peruanos o con 51), separados por coma.
CREATE OR REPLACE FUNCTION public.sie_promotoria_guardar_telefono(p_token text, p_telefono text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_rol text;
  v_item text;
  v_digitos text;
  v_lista text[] := ARRAY[]::text[];
BEGIN
  SELECT rol INTO v_rol FROM public._sie_validar_token(p_token) LIMIT 1;
  IF v_rol IS NULL OR v_rol <> 'RRHH' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;
  FOREACH v_item IN ARRAY regexp_split_to_array(coalesce(p_telefono, ''), '[,;/]') LOOP
    v_digitos := regexp_replace(v_item, '\D', '', 'g');
    CONTINUE WHEN v_digitos = '';
    IF v_digitos ~ '^51[0-9]{9}$' THEN
      v_digitos := substr(v_digitos, 3);
    END IF;
    IF v_digitos !~ '^9[0-9]{8}$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Celular inválido: ' || btrim(v_item) || ' (9 dígitos, empieza con 9).');
    END IF;
    IF NOT v_digitos = ANY(v_lista) THEN
      v_lista := v_lista || v_digitos;
    END IF;
  END LOOP;
  INSERT INTO configuracion_sistema (clave, valor, descripcion, fecha_actualizacion)
  VALUES ('promotoria_telefono', array_to_string(v_lista, ', '),
          'Celular(es) de la Promotoría vinculados en la app a todo el personal, separados por coma', now())
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, fecha_actualizacion = now();
  RETURN jsonb_build_object('ok', true, 'error', NULL, 'telefono', array_to_string(v_lista, ', '));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sie_promotoria_config(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sie_promotoria_guardar_telefono(text, text) TO anon, authenticated;
