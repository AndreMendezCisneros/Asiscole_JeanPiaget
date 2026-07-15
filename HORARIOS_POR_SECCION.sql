-- Horarios por salón/sección — I.E. San Ramón
-- Ejecutar en Supabase SQL Editor (opcional; el sistema usa defaults si no existe).

INSERT INTO public.configuracion_sistema (clave, valor, descripcion, fecha_actualizacion)
VALUES (
  'horarios_por_seccion',
  '{
    "defaults": {
      "entradaInicio": "06:30",
      "entradaFin": "08:45",
      "salidaInicio": "14:00",
      "salidaFin": "15:30",
      "tallerInicio": "15:30",
      "tallerFin": "18:00",
      "notas": "Primaria y Secundaria — jornada única mañana"
    },
    "inicial": {
      "salidaInicio": "11:45",
      "salidaFin": "12:15",
      "notas": "Inicial — salida al mediodía"
    },
    "sections": {
      "Secundaria|5|A": {
        "salidaInicio": "14:30",
        "salidaFin": "15:00",
        "notas": "5º A Secundaria"
      }
    }
  }',
  'Horarios de entrada, salida y talleres por sección (JSON). Clave: Nivel|Grado|Sección',
  NOW()
)
ON CONFLICT (clave) DO UPDATE SET
  valor = EXCLUDED.valor,
  descripcion = EXCLUDED.descripcion,
  fecha_actualizacion = NOW();
