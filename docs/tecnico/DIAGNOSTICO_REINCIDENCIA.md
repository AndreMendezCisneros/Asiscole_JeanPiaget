# 🔍 Diagnóstico del Problema de Reincidencia

## ❌ PROBLEMA DETECTADO

**Estudiante:** Jeremi Isac Espino Escriba (Código: 70391919)
- ✅ **24 incidencias activas** en últimos 60 días
- ✅ **56 puntos totales** de faltas
- ❌ **Nivel de reincidencia: 0** (INCORRECTO - debería ser alto)

**Todas las incidencias muestran `nivel_reincidencia: 0`**, lo que indica que:
1. El trigger no se está ejecutando al insertar incidencias
2. O la configuración de reincidencia no existe/está inactiva
3. O los umbrales están mal configurados

---

## 🔧 SOLUCIÓN

### Paso 1: Verificar Configuración de Reincidencia

Ejecuta este SQL en Supabase para verificar si existe configuración:

```sql
-- Verificar configuración activa
SELECT * FROM configuracion_reincidencia WHERE activo = TRUE;
```

**Si no hay resultados**, necesitas crear la configuración:

```sql
-- Crear configuración de reincidencia
INSERT INTO configuracion_reincidencia (
  ventana_dias,
  puntos_falta_leve,
  puntos_falta_grave,
  umbral_nivel_1,
  umbral_nivel_2,
  umbral_nivel_3,
  umbral_nivel_4,
  umbral_nivel_5,
  activo
) VALUES (
  60,  -- Ventana de 60 días
  1,   -- 1 punto por falta leve
  2,   -- 2 puntos por falta grave
  1,   -- Nivel 1: 1 punto
  3,   -- Nivel 2: 3 puntos
  5,   -- Nivel 3: 5 puntos
  8,   -- Nivel 4: 8 puntos
  12,  -- Nivel 5: 12 puntos
  TRUE -- Activa
);
```

### Paso 2: Verificar que el Trigger Existe

```sql
-- Verificar trigger
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_incidencias_calcular_nivel';
```

**Si no existe**, ejecuta:

```sql
-- Crear trigger
CREATE TRIGGER trigger_incidencias_calcular_nivel
    BEFORE INSERT ON incidencias
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calcular_nivel_reincidencia();
```

### Paso 3: Recalcular Niveles de Incidencias Existentes

Como las incidencias ya fueron insertadas sin calcular el nivel, necesitas recalcularlas:

```sql
-- Recalcular nivel para todas las incidencias del estudiante
UPDATE incidencias
SET nivel_reincidencia = calcular_nivel_reincidencia(
  id_estudiante, 
  fecha_hora_registro
)
WHERE id_estudiante = 31  -- ID del estudiante Jeremi
  AND estado = 'Activa';
```

O para TODOS los estudiantes:

```sql
-- Recalcular nivel para TODAS las incidencias activas
UPDATE incidencias
SET nivel_reincidencia = calcular_nivel_reincidencia(
  id_estudiante, 
  fecha_hora_registro
)
WHERE estado = 'Activa';
```

### Paso 4: Verificar Resultado

Después de ejecutar los pasos anteriores, vuelve a ejecutar:

```javascript
verificarEstudiante("70391919")
```

Deberías ver:
- Nivel de reincidencia > 0 (probablemente nivel 3, 4 o 5)
- Cada incidencia con su nivel correcto

---

## 📊 Cálculo Esperado

Con la configuración sugerida:
- **56 puntos totales** de faltas
- **Umbral nivel 5: 12 puntos**
- **Resultado esperado: Nivel 5** (máximo)

---

## ⚠️ NOTA IMPORTANTE

El problema es que:
1. Las incidencias se insertaron **antes** de que existiera la configuración
2. O el trigger **no se ejecutó** al insertar
3. Por eso todas tienen `nivel_reincidencia = 0`

La solución es **recalcular** todas las incidencias existentes.

