# ¿De qué trata este sistema? — Todo lo que ofrece

## En pocas palabras

Este es un **Sistema de Control Escolar** pensado para colegios de **Primaria y Secundaria**. Sirve para que el personal de la institución pueda:

- Registrar y dar seguimiento a **faltas disciplinarias** (incidencias).
- Controlar **quién llega y quién sale** del colegio cada día.
- Llevar un **historial de cada estudiante** con su nivel de comportamiento (reincidencia).
- **Coordinar citas con padres** y darles un **portal** para ver la información de sus hijos.
- Generar **reportes y estadísticas** para tomar decisiones.

Todo funciona desde el navegador (computadora o tablet). No hace falta instalar un programa aparte: se entra con usuario y contraseña y cada persona ve solo lo que le corresponde según su rol.

---

## ¿Para quién está hecho?

| Usuario | Para qué lo usa |
|---------|-----------------|
| **Administrador** | Configura el sistema, revisa auditoría y catálogos |
| **Director** | Ve el panorama general, reportes y gestión académica |
| **Supervisor** | Registra incidencias, asistencia y citas en el día a día |
| **Tutor** | Escanea estudiantes y registra faltas o llegadas de forma rápida |
| **Padre de familia** | Consulta asistencia, citas e información de su hijo |

---

## Resumen: todo lo que el sistema ofrece

| Área | Qué puedes hacer |
|------|------------------|
| **Incidencias** | Registrar faltas, subir fotos, listar, justificar, anular, comentar |
| **Asistencia** | Marcar llegadas, tardanzas, salidas y ver alertas |
| **Estudiantes** | Alta, edición, búsqueda, foto, contacto de padres, nivel de reincidencia |
| **Reincidencia** | Cálculo automático del nivel 0–5 según faltas recientes |
| **Citas con padres** | Programar, confirmar, registrar asistencia a la cita |
| **Portal padres** | Ver entradas, salidas, alertas y citas del hijo |
| **Reportes** | Incidencias y asistencias por mes o bimestre; exportar PDF y Excel |
| **Dashboard** | Métricas, gráficos, alertas y accesos rápidos |
| **Catálogo de faltas** | Definir tipos de falta (conducta, uniforme, etc.) |
| **Seguridad** | Login, roles, sesión con tiempo límite, bloqueo por intentos fallidos |
| **Auditoría** | Historial de cambios en la base de datos (solo Admin) |

---

## Módulos y funciones (detalle completo)

---

### 1. Inicio de sesión y seguridad

**¿De qué trata?**  
La puerta de entrada al sistema. Solo entran usuarios autorizados.

**Funciones:**

- Iniciar sesión con **usuario y contraseña**
- **Cerrar sesión** desde el menú lateral
- La sesión **se cierra sola** tras 30 minutos sin actividad
- **Protección contra intentos repetidos**: tras varios fallos, bloqueo temporal
- Cada pantalla está **limitada por rol** (un tutor no ve configuración del sistema, un padre no registra incidencias, etc.)
- Redirección automática: el tutor va al escáner, el padre al portal, el resto al panel principal

---

### 2. Panel principal (Dashboard)

**¿De qué trata?**  
Vista general para directivos y supervisores: cómo va el colegio en incidencias y asistencia.

**Funciones:**

- Ver **total de incidencias del mes** y comparación con el mes anterior
- Ver **porcentaje de incidencias con foto** (evidencia)
- Identificar la **falta más frecuente** del periodo
- Ver el **grado con más incidencias**
- **Gráficos** de distribución por nivel de reincidencia (0 a 5)
- **Gráfico de tendencia** mensual de incidencias
- Lista de **últimas incidencias registradas**
- **Alertas de salida no registrada**: estudiantes que llegaron pero aún no tienen hora de salida (se actualizan automáticamente; las críticas destacan en rojo)
- **Botones de acción rápida** para ir a registrar incidencia, asistencia, estudiantes, etc.

**Quién lo usa:** Supervisor, Director, Admin.

---

### 3. Control de asistencia (llegadas y salidas)

**¿De qué trata?**  
El registro diario de entrada y salida de los alumnos.

**Funciones:**

- Ver **todos los registros del día** (o de otra fecha con el selector de calendario)
- Filtrar por **Primaria / Secundaria**
- Filtrar por estado: **a tiempo**, **tarde** o todos
- Buscar estudiante por nombre
- Ver **estadísticas del día**: total de registros, a tiempo, tarde
- **Registrar salida** de un estudiante que ya tiene llegada (tipo: Normal, Autorizada, Sin registro)
- Ver en la tabla la **hora de llegada** y la **hora de salida** (si ya se registró)
- Integración con **alertas del dashboard** cuando falta la salida

**Quién lo usa:** Supervisor, Director, Admin.  
*(El tutor también puede registrar llegadas desde su escáner.)*

---

### 4. Incidencias — Registrar falta

**¿De qué trata?**  
Registrar una falta disciplinaria de un alumno de forma rápida y con respaldo.

**Funciones:**

- Buscar estudiante por **código de barras** (lector o teclado)
- Buscar estudiante por **nombre** (autocompletado)
- Ver ficha del alumno: grado, sección, **nivel de reincidencia**
- **Alerta automática** si el estudiante ya tiene reincidencia alta (nivel 2 o más), con sugerencia de acción
- Elegir tipo de falta del **catálogo** (conducta, uniforme, académica, puntualidad)
- Ver si la falta es **leve o grave**
- Escribir **observaciones**
- **Subir fotos** como evidencia (una o varias)
- Guardar la incidencia; el sistema calcula el **nuevo nivel de reincidencia** solo

**Quién lo usa:** Supervisor, Director, Admin.

---

### 5. Incidencias — Lista y gestión

**¿De qué trata?**  
Consultar, revisar y administrar todas las faltas registradas.

**Funciones:**

- Ver **tabla de incidencias** con estudiante, falta, fecha, severidad, reincidencia, estado
- **Buscar** por ID, nombre del estudiante o tipo de falta
- Filtrar por **nivel educativo** (Primaria / Secundaria)
- **Ver detalle** de una incidencia en ventana emergente
- Ver si tiene **evidencia fotográfica**
- **Anular** incidencias (con motivo; según permisos)
- Indicador visual de **estado**: Activa, Anulada, En revisión, Justificada
- Opción de **exportar** listado
- Badges de **nivel de reincidencia** y **severidad** (leve/grave)

**Quién lo usa:** Supervisor, Director, Admin.

---

### 6. Justificar faltas

**¿De qué trata?**  
Cuando una falta tiene motivo válido (certificado médico, permiso, etc.), se marca como justificada.

**Funciones:**

- Listar incidencias **activas** o ya **justificadas**
- Filtrar por nivel (Primaria/Secundaria), **fecha** y estado
- Buscar por estudiante o falta
- Abrir detalle y **escribir el motivo de justificación**
- Cambiar estado a **Justificada** (deja de contar igual en reincidencia según reglas del colegio)
- Ver historial de incidencias justificadas

**Quién lo usa:** Supervisor, Director, Admin.

---

### 7. Gestión de estudiantes

**¿De qué trata?**  
El padrón de alumnos: datos personales, contacto familiar y comportamiento.

**Funciones:**

- **Listar** todos los estudiantes activos
- **Buscar** por nombre
- Filtrar por **Primaria / Secundaria**
- **Registrar nuevo estudiante**: nombre, grado, sección, nivel, código de barras
- **Editar** datos de un estudiante existente
- **Ver ficha** completa en ventana de solo lectura
- Subir o cambiar **foto de perfil**
- Guardar **datos de contacto familiar**:
  - Teléfono y correo de contacto
  - Nombre y parentesco del responsable
  - Teléfono de emergencia
- Ver **nivel de reincidencia actual** (0 a 5) en cada ficha
- Desactivar o gestionar estado **activo/inactivo**

**Quién lo usa:** Supervisor, Director, Admin.

---

### 8. Catálogo de faltas

**¿De qué trata?**  
Define qué tipos de falta existen en el colegio y cuánto “pesan” para la reincidencia.

**Funciones:**

- Ver listado de faltas por **categoría**:
  - Conducta
  - Uniforme
  - Académica
  - Puntualidad
- **Crear** nueva falta: nombre, descripción, categoría
- Marcar si es **leve o grave**
- Asignar **puntos de reincidencia** por falta
- **Editar** faltas existentes
- **Activar/desactivar** faltas del catálogo
- Buscar en el catálogo por nombre o descripción

**Quién lo usa:** Director, Admin.

---

### 9. Sistema de reincidencia (automático)

**¿De qué trata?**  
No es una pantalla aparte: es el “motor” que clasifica el comportamiento de cada alumno según sus faltas recientes.

**Cómo funciona para el usuario:**

- Cada vez que se registra una falta, el sistema **recalcula** el nivel (0 a 5)
- Solo cuenta faltas **activas** en un periodo (por ejemplo, últimos 60 días)
- Las faltas **graves** suman más puntos que las **leves**
- El nivel se muestra con **colores** en fichas e incidencias:
  - **Verde** — Sin problema (nivel 0)
  - **Amarillo** — Atención leve (1–2)
  - **Naranja** — Requiere seguimiento (3)
  - **Rojo** — Situación crítica (4–5)
- Al registrar una nueva falta, aparece **alerta y acción sugerida** según el nivel

**Quién lo configura:** Admin (umbrales y puntos en configuración del sistema).

---

### 10. Citas con padres

**¿De qué trata?**  
Organizar reuniones entre la escuela y los padres (por conducta, rendimiento, etc.).

**Funciones:**

- Ver citas en **lista** o **calendario**
- **Crear cita**: estudiante, motivo, fecha, hora, notas
- Tipos de cita: **individual** u otras variantes del formulario
- Buscar estudiante por **código de barras** al crear cita
- Estados de cita:
  - Pendiente
  - Confirmada
  - Reprogramada
  - Completada
  - No asistió
  - Cancelada
- **Confirmar**, **reprogramar** o **cancelar** citas
- **Registrar asistencia** del padre a la cita
- Registrar si el padre llegó **tarde** y la hora real de llegada
- **Estadísticas**: total de citas, pendientes, confirmadas, completadas, tasa de asistencia
- Filtros por **estado** y búsqueda por estudiante
- Creación de citas **masivas** (varios estudiantes a la vez)

**Quién lo usa:** Supervisor, Director, Admin.

---

### 11. Portal para padres

**¿De qué trata?**  
Espacio para que los padres vean información de su hijo sin acceder al resto del sistema.

**Funciones:**

- Ver **datos del estudiante** (nombre, grado, sección)
- Ver **contacto** registrado en la ficha
- **Resumen mensual de asistencia**: a tiempo, tarde, justificadas, injustificadas
- **Historial de entradas y salidas** por fecha
- **Alertas** si el hijo llegó pero no tiene salida registrada
- Ver **citas programadas** con la institución (fecha, hora, motivo, estado)
- Filtrar registros por **fecha**

**Quién lo usa:** Padre (principalmente). Staff puede entrar para pruebas.

---

### 12. Escáner de tutor

**¿De qué trata?**  
Pantalla simplificada para el tutor en aula o en puerta: escanear y actuar en segundos.

**Funciones:**

- Interfaz **sin menú completo** (solo lo necesario)
- Escanear o escribir **código de barras** del estudiante
- Ver **perfil rápido** del alumno
- Ver si ya tiene **registro de llegada** del día
- **Registrar llegada** (a tiempo / tarde)
- **Registrar incidencia** eligiendo falta y observaciones
- Ver nivel de reincidencia del estudiante
- Cerrar sesión

**Quién lo usa:** Tutor (acceso limitado a sus grados asignados).

---

### 13. Reportes de incidencias

**¿De qué trata?**  
Análisis estadístico de faltas para reuniones, informes a dirección o UGEL.

**Funciones:**

- Filtros por:
  - **Año escolar**
  - **Bimestre** (calendario escolar peruano: 4 bimestres)
  - **Nivel** (Primaria / Secundaria)
  - **Grado**
  - **Severidad** (moderadas / críticas)
- **Gráficos**: barras, líneas, comparativas por grado y sección
- Comparar **incidencias por grado** y por sección
- Ver distribución de **niveles de reincidencia** por grupo
- Tendencia **semanal** y **mensual**
- **Exportar a PDF**
- **Exportar a Excel**

**Quién lo usa:** Director, Admin (Supervisor según permisos de reportes).

---

### 14. Reporte de asistencias

**¿De qué trata?**  
Matriz de asistencia tipo “planilla mensual” o por bimestre.

**Funciones:**

- Tipo de reporte: **mensual** o **bimestral**
- Elegir **mes y año** o **bimestre y año escolar**
- Filtrar por nivel, **grado** y **sección**
- Tabla con **un día por columna** y cada estudiante en fila
- Códigos de estado por día: a tiempo, tarde, justificada, injustificada, sin registro
- **Totales** por alumno (cuántos días a tiempo, tarde, etc.)
- **Exportar a PDF**
- **Exportar a Excel**

**Quién lo usa:** Supervisor, Director, Admin.

---

### 15. Configuración del sistema

**¿De qué trata?**  
Parámetros generales que solo el administrador puede cambiar.

**Funciones:**

- Ver y editar **configuraciones clave-valor** (horarios, textos, límites, etc.)
- **Crear** nuevas configuraciones
- **Eliminar** configuraciones obsoletas
- Ajustar parámetros del **algoritmo de reincidencia** (ventana de días, puntos, umbrales por nivel)

**Quién lo usa:** Admin.

---

### 16. Auditoría

**¿De qué trata?**  
Registro de quién cambió qué en la base de datos (trazabilidad).

**Funciones:**

- Ver **historial de cambios** (INSERT, UPDATE, DELETE)
- Filtrar por **tabla** afectada
- Filtrar por **tipo de operación**
- **Paginación** del listado
- Ver **detalle** de un registro: datos anteriores y nuevos
- **Estadísticas** de actividad de los últimos 7 días
- Buscar en los logs

**Quién lo usa:** Admin.

---

## Funciones transversales (en todo el sistema)

Estas capacidades aparecen en varios módulos:

| Función | Descripción |
|---------|-------------|
| **Código de barras** | Identificar estudiantes rápido en registro de faltas, asistencia y citas |
| **Búsqueda en tiempo real** | Por nombre en estudiantes e incidencias |
| **Filtros** | Por nivel, grado, sección, fecha, estado |
| **Notificaciones** | Mensajes de éxito o error al guardar o fallar una acción |
| **Evidencia fotográfica** | Fotos guardadas en la nube (Supabase Storage) |
| **Comentarios en incidencias** | Seguimiento y notas del equipo (según módulo) |
| **Impresión** | Contador de veces impresa una incidencia (trazabilidad) |
| **Bimestres escolares** | Reportes alineados al año marzo–diciembre (Perú) |
| **Primaria y Secundaria** | Separación en casi todos los listados y reportes |
| **Interfaz responsive** | Uso en computadora, tablet o celular (menú adaptable) |

---

## Qué puede hacer cada rol (resumen)

### Administrador
- Todo lo anterior
- Configuración del sistema
- Auditoría
- Catálogo de faltas

### Director
- Dashboard, incidencias, estudiantes, asistencia, citas, justificar faltas
- Reportes completos y catálogo de faltas
- Sin auditoría ni configuración global

### Supervisor
- Registrar y consultar incidencias
- Control de asistencia y salidas
- Estudiantes y citas con padres
- Justificar faltas
- Reportes de incidencias y asistencias

### Tutor
- Escáner: buscar alumno, registrar llegada o incidencia
- Ver información de estudiantes de sus grados

### Padre
- Portal: asistencia, salidas, alertas y citas de su hijo
- Solo lectura (no registra faltas ni asistencia)

---

## Beneficios para la institución

1. **Un solo lugar** para incidencias, asistencia y citas — menos planillas en papel.
2. **Reincidencia automática** — no hay que calcular a mano quién está en riesgo.
3. **Alertas de salida** — seguridad cuando un alumno no tiene hora de salida registrada.
4. **Padres informados** — portal con datos actualizados.
5. **Reportes listos** — PDF y Excel para dirección o reuniones.
6. **Trazabilidad** — quién registró qué y cuándo (auditoría y evidencias).
7. **Roles claros** — cada usuario ve solo lo que necesita.

---

## Documentos relacionados

| Si necesitas… | Lee este archivo |
|---------------|------------------|
| Uso paso a paso (manual de usuario) | `MANUAL_DE_USUARIO.md` |
| Detalles técnicos y arquitectura | `DOCUMENTACION_SISTEMA.md` |
| Cómo instalar y configurar Supabase | `CONFIGURACION_COMPLETA.md` |
| Cómo funciona la reincidencia por dentro | `EXPLICACION_SISTEMA_REINCIDENCIA.md` |

---

*Este documento describe **qué ofrece** el sistema y **todas sus funciones** desde el punto de vista del usuario y la institución.*
