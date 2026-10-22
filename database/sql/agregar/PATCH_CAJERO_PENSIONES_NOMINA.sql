-- Nómina mínima para match de Excel de pensiones (Admin/Director/Cajero).
-- SECURITY DEFINER: no depende de RLS staff en estudiantes.

CREATE OR REPLACE FUNCTION public.sie_pensiones_nomina()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NOT public._sie_puede_pensiones() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Sin permiso',
      'students', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'students', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e.id_estudiante,
            'barcode', e.codigo_barras,
            'fullName', e.nombre_completo,
            'grade', e.grado,
            'section', e.seccion,
            'level', e.nivel_educativo,
            'contactPhone', e.telefono_contacto,
            'emergencyPhone', e.telefono_emergencia,
            'active', e.activo
          )
          ORDER BY e.nombre_completo
        )
        FROM public.estudiantes e
        WHERE e.activo IS TRUE
      ),
      '[]'::jsonb
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sie_pensiones_nomina() TO anon, authenticated, service_role;
