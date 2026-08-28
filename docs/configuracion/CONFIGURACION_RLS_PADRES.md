# Configuración de RLS (Row Level Security) para Rol Padre

Este documento describe cómo configurar las políticas de seguridad a nivel de fila (RLS) en Supabase para permitir que los padres accedan únicamente a la información de sus hijos.

## Requisitos Previos

1. Tabla `usuarios` con columna `rol` que incluya el valor 'Padre'
2. Tabla de relación `padres_estudiantes` que vincule padres con estudiantes
3. Habilitar RLS en las tablas relevantes

## 1. Crear Tabla de Relación Padres-Estudiantes

```sql
-- Tabla para vincular padres con estudiantes
CREATE TABLE IF NOT EXISTS public.padres_estudiantes (
  id_relacion SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  id_estudiante INTEGER NOT NULL REFERENCES public.estudiantes(id_estudiante) ON DELETE CASCADE,
  parentesco VARCHAR(50), -- 'Padre', 'Madre', 'Apoderado', etc.
  es_principal BOOLEAN DEFAULT false,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(id_usuario, id_estudiante)
);

CREATE INDEX idx_padres_estudiantes_usuario ON public.padres_estudiantes(id_usuario);
CREATE INDEX idx_padres_estudiantes_estudiante ON public.padres_estudiantes(id_estudiante);
```

## 2. Habilitar RLS en Tablas Relevantes

```sql
-- Habilitar RLS en las tablas que los padres necesitan ver
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_llegada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas_padres ENABLE ROW LEVEL SECURITY;
```

## 3. Crear Políticas RLS

### Política para Estudiantes
Los padres solo pueden ver información de sus hijos:

```sql
-- Política para que padres vean solo sus hijos
CREATE POLICY "Padres pueden ver solo sus hijos"
ON public.estudiantes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.padres_estudiantes
    WHERE padres_estudiantes.id_estudiante = estudiantes.id_estudiante
    AND padres_estudiantes.id_usuario = auth.uid()::integer
  )
);
```

### Política para Registros de Llegada
Los padres solo pueden ver los registros de llegada de sus hijos:

```sql
-- Política para registros de llegada
CREATE POLICY "Padres pueden ver llegadas de sus hijos"
ON public.registros_llegada
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.padres_estudiantes
    WHERE padres_estudiantes.id_estudiante = registros_llegada.id_estudiante
    AND padres_estudiantes.id_usuario = auth.uid()::integer
  )
);
```

### Política para Incidencias
Los padres solo pueden ver las incidencias de sus hijos:

```sql
-- Política para incidencias
CREATE POLICY "Padres pueden ver incidencias de sus hijos"
ON public.incidencias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.padres_estudiantes
    WHERE padres_estudiantes.id_estudiante = incidencias.id_estudiante
    AND padres_estudiantes.id_usuario = auth.uid()::integer
  )
);
```

### Política para Citas con Padres
Los padres solo pueden ver las citas relacionadas con sus hijos:

```sql
-- Política para citas con padres
CREATE POLICY "Padres pueden ver citas de sus hijos"
ON public.citas_padres
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.padres_estudiantes
    WHERE padres_estudiantes.id_estudiante = citas_padres.id_estudiante
    AND padres_estudiantes.id_usuario = auth.uid()::integer
  )
);
```

## 4. Función Helper para Obtener Estudiantes del Padre

```sql
-- Función para obtener los IDs de estudiantes vinculados a un padre
CREATE OR REPLACE FUNCTION obtener_estudiantes_del_padre(p_id_usuario INTEGER)
RETURNS TABLE(id_estudiante INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT pe.id_estudiante
  FROM public.padres_estudiantes pe
  WHERE pe.id_usuario = p_id_usuario;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 5. Notas Importantes

1. **Autenticación**: Asegúrate de que Supabase Auth esté configurado correctamente y que los usuarios tengan el rol 'Padre' en la tabla `usuarios`.

2. **Vínculo Usuario-Estudiante**: La tabla `padres_estudiantes` debe estar correctamente poblada con las relaciones padre-hijo.

3. **Testing**: Prueba las políticas con diferentes usuarios para asegurar que:
   - Los padres solo ven información de sus hijos
   - Los directores/supervisores pueden ver toda la información
   - Los tutores tienen acceso según sus permisos

4. **Seguridad**: Las políticas RLS se aplican automáticamente a todas las consultas, por lo que no es necesario modificar el código del frontend.

## 6. Script de Ejemplo para Vincular Padre con Estudiante

```sql
-- Ejemplo: Vincular un padre (usuario ID 10) con un estudiante (estudiante ID 5)
INSERT INTO public.padres_estudiantes (id_usuario, id_estudiante, parentesco, es_principal)
VALUES (10, 5, 'Padre', true)
ON CONFLICT (id_usuario, id_estudiante) DO NOTHING;
```

## 7. Verificación

Para verificar que las políticas funcionan correctamente:

```sql
-- Como usuario padre, intentar ver todos los estudiantes (debería mostrar solo sus hijos)
SELECT * FROM public.estudiantes;

-- Como usuario padre, intentar ver registros de llegada (debería mostrar solo de sus hijos)
SELECT * FROM public.registros_llegada;
```

