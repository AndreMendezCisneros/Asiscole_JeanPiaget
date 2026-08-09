# 📊 Explicación del Sistema de Reincidencia

## ¿Qué es el Sistema de Reincidencia?

El sistema de **reincidencia** (no "residencia") es un mecanismo que **detecta y clasifica automáticamente** el nivel de comportamiento de un estudiante basándose en sus faltas registradas en un período determinado.

---

## 🔍 ¿Cómo se Detecta que un Estudiante está Reincidiendo?

### 1. **Cálculo Automático al Registrar una Falta**

Cuando se registra una nueva incidencia (falta), el sistema:

1. **Ejecuta automáticamente** la función `calcular_nivel_reincidencia()` mediante un **trigger** en la base de datos
2. **Cuenta las faltas activas** del estudiante en una **ventana de tiempo** (ej: últimos 60 días)
3. **Asigna puntos** según el tipo de falta:
   - Faltas **leves**: X puntos (configurable)
   - Faltas **graves**: Y puntos (configurable, generalmente el doble)
4. **Suma todos los puntos** de las faltas en la ventana
5. **Determina el nivel** comparando con umbrales configurados:
   - Nivel 0: 0 puntos (sin reincidencias)
   - Nivel 1: ≥ umbral_nivel_1 puntos
   - Nivel 2: ≥ umbral_nivel_2 puntos
   - Nivel 3: ≥ umbral_nivel_3 puntos
   - Nivel 4: ≥ umbral_nivel_4 puntos
   - Nivel 5: ≥ umbral_nivel_5 puntos (máximo)

### 2. **Vista de Base de Datos**

El sistema usa la vista `v_estudiantes_nivel_actual` que:
- Calcula el nivel actual de cada estudiante
- Cuenta las faltas de los últimos 60 días
- Se actualiza automáticamente cuando hay cambios

---

## 📋 Proceso Detallado

### Paso 1: Configuración del Sistema

El sistema tiene una tabla `configuracion_reincidencia` que define:

```sql
- ventana_dias: Período de análisis (ej: 60 días)
- puntos_falta_leve: Puntos por falta leve (ej: 1 punto)
- puntos_falta_grave: Puntos por falta grave (ej: 2 puntos)
- umbral_nivel_1: Puntos necesarios para nivel 1 (ej: 1 punto)
- umbral_nivel_2: Puntos necesarios para nivel 2 (ej: 3 puntos)
- umbral_nivel_3: Puntos necesarios para nivel 3 (ej: 5 puntos)
- umbral_nivel_4: Puntos necesarios para nivel 4 (ej: 8 puntos)
- umbral_nivel_5: Puntos necesarios para nivel 5 (ej: 12 puntos)
```

### Paso 2: Registro de una Incidencia

Cuando un usuario registra una falta:

1. Se inserta el registro en la tabla `incidencias`
2. El **trigger** `trigger_incidencias_calcular_nivel` se ejecuta automáticamente
3. Llama a la función `calcular_nivel_reincidencia()`

### Paso 3: Cálculo del Nivel

La función SQL `calcular_nivel_reincidencia()` hace lo siguiente:

```sql
1. Obtiene la configuración activa
2. Calcula la fecha de inicio: fecha_actual - ventana_dias
3. Suma los puntos de todas las faltas ACTIVAS en ese período:
   - Si la falta es grave → puntos_falta_grave
   - Si la falta es leve → puntos_falta_leve
4. Compara el total con los umbrales
5. Retorna el nivel correspondiente (0-5)
```

### Paso 4: Almacenamiento

El nivel calculado se guarda en el campo `nivel_reincidencia` de la incidencia.

---

## 🎯 Ejemplo Práctico

### Escenario:
- **Configuración**: 
  - Ventana: 60 días
  - Falta leve: 1 punto
  - Falta grave: 2 puntos
  - Umbral nivel 1: 1 punto
  - Umbral nivel 2: 3 puntos

### Estudiante con Historial:
- **Hace 50 días**: 1 falta leve (1 punto)
- **Hace 30 días**: 1 falta grave (2 puntos)
- **Hoy**: Se registra 1 falta leve (1 punto)

### Cálculo:
1. **Faltas en ventana** (últimos 60 días):
   - Falta leve (50 días): 1 punto
   - Falta grave (30 días): 2 puntos
   - Falta leve (hoy): 1 punto
   - **Total: 4 puntos**

2. **Nivel asignado**:
   - 4 puntos ≥ umbral_nivel_2 (3 puntos)
   - 4 puntos < umbral_nivel_3 (5 puntos)
   - **Resultado: Nivel 2** ✅

---

## 📊 Niveles de Reincidencia

| Nivel | Descripción | Acción Sugerida |
|-------|-------------|-----------------|
| **0** | Sin reincidencias | Ninguna |
| **1** | Primera reincidencia | Observación |
| **2** | Reincidencia moderada | Llamada de atención |
| **3** | Reincidencia alta | Reunión con padres |
| **4** | Reincidencia crítica | Acción disciplinaria |
| **5** | Reincidencia extrema | Medidas severas |

---

## 🔄 Actualización Automática

### ¿Cuándo se actualiza el nivel?

1. **Al registrar una nueva incidencia** → Se recalcula automáticamente
2. **Al anular una incidencia** → El nivel puede bajar (si la falta estaba en la ventana)
3. **Al consultar un estudiante** → Se obtiene el nivel actual desde la vista

### ¿Cómo se consulta?

El sistema consulta el nivel desde:
- **Vista**: `v_estudiantes_nivel_actual`
- **Campo**: `nivel_actual`
- **También incluye**: `total_faltas_60_dias`

---

## 💻 Código Relevante

### Función SQL (Base de Datos):
```sql
CREATE OR REPLACE FUNCTION calcular_nivel_reincidencia(
    p_id_estudiante INTEGER,
    p_fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS INTEGER AS $$
-- Calcula puntos y compara con umbrales
-- Retorna nivel 0-5
$$;
```

### Trigger Automático:
```sql
CREATE TRIGGER trigger_incidencias_calcular_nivel
    BEFORE INSERT ON incidencias
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calcular_nivel_reincidencia();
```

### Consulta en Frontend:
```typescript
// En studentsService.ts
const { data: nivelData } = await supabase
  .from('v_estudiantes_nivel_actual')
  .select('nivel_actual, total_faltas_60_dias')
  .eq('id_estudiante', studentId)
  .single();

student.reincidenceLevel = nivelData?.nivel_actual || 0;
```

---

## 🎨 Visualización en la Interfaz

### Componente ReincidenceBadge:
- Muestra el nivel con colores:
  - **Verde**: Nivel 0
  - **Amarillo**: Nivel 1-2
  - **Naranja**: Nivel 3
  - **Rojo**: Nivel 4-5

### Alertas Automáticas:
- Si nivel ≥ 2: Muestra alerta al registrar nueva falta
- Sugiere acciones según el nivel

---

## ⚙️ Configuración

El sistema permite configurar:
- Período de análisis (ventana de días)
- Puntos por tipo de falta
- Umbrales para cada nivel

**Ubicación**: Módulo de Configuración → Algoritmo de Reincidencia

---

## 📝 Resumen

1. ✅ **Detección automática**: Se calcula al registrar cada falta
2. ✅ **Basado en puntos**: Faltas leves y graves tienen diferentes valores
3. ✅ **Ventana temporal**: Solo cuenta faltas en un período determinado
4. ✅ **Niveles 0-5**: Clasificación clara del comportamiento
5. ✅ **Actualización en tiempo real**: Siempre muestra el nivel actual
6. ✅ **Visualización clara**: Badges de colores y alertas

---

**¿Tienes alguna pregunta específica sobre el funcionamiento del sistema de reincidencia?**

