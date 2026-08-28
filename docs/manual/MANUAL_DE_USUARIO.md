# 📘 Manual de Usuario
## Sistema de Control de Incidencias Escolares

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Roles y Permisos](#roles-y-permisos)
4. [Dashboard Principal](#dashboard-principal)
5. [Módulo de Asistencia](#módulo-de-asistencia)
6. [Módulo de Incidencias](#módulo-de-incidencias)
7. [Gestión de Estudiantes](#gestión-de-estudiantes)
8. [Citas con Padres](#citas-con-padres)
9. [Portal para Padres](#portal-para-padres)
10. [Reportes](#reportes)
11. [Configuración del Sistema](#configuración-del-sistema)
12. [Consejos y Trucos](#consejos-y-trucos)
13. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Introducción

Bienvenido al **Sistema de Control de Incidencias Escolares**. Este sistema está diseñado para facilitar la gestión integral de estudiantes, incluyendo el control de asistencia, registro de incidencias disciplinarias, gestión de citas con padres y generación de reportes estadísticos.

### Características Principales

- ✅ Control de llegadas y salidas de estudiantes
- ✅ Registro rápido de incidencias con código de barras
- ✅ Sistema de reincidencia automático
- ✅ Gestión de citas con padres
- ✅ Portal para padres con información en tiempo real
- ✅ Reportes y estadísticas avanzadas
- ✅ Dashboard ejecutivo con métricas clave

---

## 🔐 Acceso al Sistema

### Iniciar Sesión

1. Abra su navegador web (Chrome, Firefox, Edge o Safari)
2. Ingrese la URL del sistema proporcionada por su administrador
3. Será redirigido automáticamente a la página de inicio de sesión

### Credenciales de Acceso

- **Usuario**: Su nombre de usuario asignado
- **Contraseña**: Su contraseña personal

> ⚠️ **Importante**: Si es su primer acceso, deberá cambiar su contraseña obligatoriamente.

### Pasos para Iniciar Sesión

1. Ingrese su **nombre de usuario** en el campo correspondiente
2. Ingrese su **contraseña**
3. Haga clic en el botón **"Iniciar Sesión"**
4. Si las credenciales son correctas, será redirigido al dashboard principal

### Cerrar Sesión

1. Haga clic en su nombre de usuario en la esquina superior derecha
2. Seleccione **"Cerrar Sesión"**
3. O simplemente cierre el navegador (la sesión expira automáticamente después de 30 minutos de inactividad)

> 🔒 **Seguridad**: Por su seguridad, siempre cierre sesión al terminar su trabajo, especialmente si usa una computadora compartida.

---

## 👥 Roles y Permisos

El sistema cuenta con diferentes roles, cada uno con permisos específicos:

### 🔴 Administrador (Admin)
- ✅ Acceso completo a todas las funcionalidades
- ✅ Gestión de usuarios
- ✅ Configuración del sistema
- ✅ Auditoría y logs
- ✅ Catálogo de faltas

### 🟡 Director
- ✅ Dashboard ejecutivo
- ✅ Ver todas las incidencias
- ✅ Editar y anular incidencias
- ✅ Gestión de citas con padres
- ✅ Reportes completos
- ✅ Ver estudiantes

### 🟢 Supervisor
- ✅ Registrar incidencias
- ✅ Ver incidencias (propias y todas)
- ✅ Editar sus propias incidencias (dentro de 24 horas)
- ✅ Control de asistencia
- ✅ Ver estudiantes
- ✅ Reportes básicos

### 🔵 Tutor
- ✅ Interfaz simplificada para escaneo
- ✅ Ver incidencias de sus grados asignados
- ✅ Agregar comentarios a incidencias
- ✅ Ver estudiantes de sus grados

### 🟣 Padre
- ✅ Portal dedicado
- ✅ Ver información de su(s) hijo(s)
- ✅ Ver asistencia y salidas
- ✅ Ver citas programadas
- ✅ Ver incidencias (solo lectura)

---

## 📊 Dashboard Principal

El Dashboard es la pantalla principal del sistema y muestra información clave en tiempo real.

### Elementos del Dashboard

#### 📈 Métricas Principales

1. **Total de Incidencias del Mes**
   - Muestra el número total de incidencias registradas en el mes actual
   - Incluye comparación con el mes anterior (↑ aumento, ↓ disminución)

2. **Incidencias con Evidencia**
   - Porcentaje de incidencias que tienen fotografías adjuntas
   - Indicador de calidad de los registros

3. **Falta Más Común**
   - Tipo de falta más registrada en el periodo
   - Útil para identificar patrones

4. **Grado con Más Incidencias**
   - Identifica qué grado requiere más atención
   - Facilita la toma de decisiones

#### 🚨 Alertas Críticas

- **Estudiantes sin Salida Registrada**
  - Lista de estudiantes que llegaron pero no tienen registro de salida
  - Se actualiza automáticamente cada 5 minutos
  - Muestra horas transcurridas desde la llegada
  - Alertas críticas (más de 6 horas) se destacan en rojo

#### 📋 Incidencias Recientes

- Muestra las últimas 6 incidencias registradas
- Información visible:
  - Estudiante
  - Tipo de falta
  - Fecha y hora
  - Nivel de reincidencia
- Clic en cualquier incidencia para ver detalles

#### 📉 Gráficos Estadísticos

1. **Tendencia Mensual**
   - Gráfico de línea mostrando la evolución de incidencias por mes
   - Permite identificar tendencias

2. **Distribución por Tipo de Falta**
   - Gráfico circular (pie chart)
   - Muestra porcentaje de cada tipo de falta
   - Clic para ver detalles

3. **Distribución por Categoría**
   - Gráfico de barras
   - Compara categorías: Conducta, Uniforme, Académica, Puntualidad

### Acciones Rápidas

Desde el Dashboard puede acceder rápidamente a:
- 📝 Registrar nueva incidencia
- 👥 Ver estudiantes
- 📊 Ver reportes
- ⏰ Control de asistencia

---

## ⏰ Módulo de Asistencia

El módulo de asistencia permite registrar y controlar las llegadas y salidas de los estudiantes.

### Control de Llegadas

#### Para Tutores (Interfaz Simplificada)

1. Acceda a la página de escaneo (se abre automáticamente al iniciar sesión como Tutor)
2. El campo de código de barras tiene el foco automático
3. Escanee el código de barras del estudiante o ingréselo manualmente
4. Presione **Enter** o haga clic en **"Registrar Llegada"**
5. El sistema mostrará:
   - Foto del estudiante
   - Nombre completo
   - Grado y sección
   - Estado: "A tiempo" o "Tarde"
   - Nivel de reincidencia actual
6. Si el estudiante tiene nivel de reincidencia ≥ 2, aparecerá una alerta
7. Puede registrar una incidencia directamente desde esta pantalla

#### Para Supervisores y Directores

1. Vaya a **"Asistencia"** en el menú lateral
2. Seleccione la fecha deseada usando el selector de fecha
3. Verá una tabla con todos los registros del día
4. Para registrar una nueva llegada:
   - Use el botón **"Registrar Llegada"**
   - Busque al estudiante por código de barras o nombre
   - Confirme el registro

### Control de Salidas

1. En la página de **"Asistencia"**, busque el estudiante en la tabla
2. Localice el registro de llegada correspondiente
3. Haga clic en el botón **"Registrar Salida"** en la fila del estudiante
4. El sistema registrará automáticamente:
   - Hora de salida
   - Fecha de salida
   - Usuario que registró
   - Tipo de salida (Normal)

### Filtros Disponibles

- **Por Estado**: A tiempo, Tarde, Todos
- **Por Nivel de Reincidencia**: Todos los niveles
- **Por Búsqueda**: Nombre del estudiante

### Alertas de Salidas No Registradas

El sistema detecta automáticamente estudiantes que:
- Tienen registro de llegada
- No tienen registro de salida
- Han pasado más de 2 horas desde la llegada

Estas alertas aparecen en:
- Dashboard principal
- Módulo de Asistencia
- Portal para Padres

---

## 📝 Módulo de Incidencias

El módulo de incidencias es el corazón del sistema, permitiendo registrar y gestionar todas las faltas disciplinarias.

### Registrar una Incidencia

#### Método 1: Con Código de Barras (Recomendado)

1. Vaya a **"Incidencias"** → **"Registrar Incidencia"**
2. El campo de código de barras tiene el foco automático
3. Escanee el código de barras del estudiante o ingréselo manualmente
4. Presione **Enter**
5. El sistema mostrará la ficha del estudiante:
   - Foto
   - Nombre completo
   - Grado y sección
   - Nivel de reincidencia actual (con indicador de color)
   - Cantidad de faltas en los últimos 60 días

#### Alerta de Reincidencia

Si el estudiante tiene nivel ≥ 2:
- Aparecerá un modal automático
- Mostrará las últimas 3 faltas
- Días transcurridos desde la última falta
- Sugerencia de acción disciplinaria
- Botón para notificar al tutor

#### Seleccionar Tipo de Falta

1. En el dropdown **"Tipo de Falta"**, seleccione la falta correspondiente
2. Las faltas están agrupadas por categoría:
   - 🟥 Conducta
   - 🟦 Uniforme
   - 🟨 Académica
   - 🟩 Puntualidad
3. Al seleccionar, aparecerá automáticamente un badge indicando si es **Leve** o **Grave**

#### Agregar Observaciones

1. En el campo **"Observaciones"**, escriba detalles adicionales (máximo 500 caracteres)
2. El contador muestra cuántos caracteres ha usado
3. Este campo es opcional pero recomendado

#### Subir Evidencia Fotográfica (Opcional)

1. Haga clic en **"Subir Evidencia"**
2. Seleccione hasta 3 fotografías (JPG o PNG, máximo 5MB cada una)
3. Verá una vista previa de las imágenes
4. Puede eliminar imágenes antes de guardar
5. Las imágenes se comprimen automáticamente

#### Guardar la Incidencia

1. Revise toda la información
2. Haga clic en **"Guardar Incidencia"**
3. El sistema:
   - Validará que se haya seleccionado un tipo de falta
   - Calculará automáticamente el nivel de reincidencia
   - Guardará el registro
   - Mostrará un mensaje de confirmación con el ID de incidencia
4. El formulario se limpiará automáticamente para el siguiente registro

#### Método 2: Búsqueda Manual

1. En lugar de escanear, use el campo **"Buscar Estudiante"**
2. Escriba el nombre del estudiante
3. Aparecerá un listado con coincidencias
4. Seleccione el estudiante deseado
5. Continúe con los pasos anteriores

### Ver Lista de Incidencias

1. Vaya a **"Incidencias"** → **"Lista de Incidencias"**
2. Verá una tabla con todas las incidencias registradas

#### Filtros Disponibles

- **Rango de Fechas**: Seleccione fecha inicial y final
- **Grado**: Filtre por grado específico
- **Sección**: Filtre por sección
- **Tipo de Falta**: Seleccione uno o varios tipos
- **Nivel de Reincidencia**: Filtre por nivel (0-5)
- **Estado de Evidencia**: Con evidencia / Sin evidencia
- **Usuario Registrador**: Filtre por quién registró
- **Búsqueda Rápida**: Busque por nombre de estudiante o ID de incidencia

#### Ordenamiento

- Haga clic en cualquier encabezado de columna para ordenar
- Clic nuevamente para invertir el orden

### Ver Detalle de una Incidencia

1. Haga clic en cualquier fila de la tabla
2. Se abrirá un modal con toda la información:
   - Datos del estudiante
   - Tipo de falta y gravedad
   - Fecha y hora del registro
   - Observaciones
   - Evidencias fotográficas (si las hay)
   - Historial de auditoría
   - Comentarios adicionales

### Editar una Incidencia

**Permisos**:
- **Supervisor**: Solo puede editar sus propias incidencias, dentro de las primeras 24 horas
- **Director/Admin**: Pueden editar cualquier incidencia

**Pasos**:
1. Abra el detalle de la incidencia
2. Haga clic en **"Editar"**
3. Modifique los campos permitidos:
   - Tipo de falta
   - Observaciones
4. Guarde los cambios
5. El sistema registrará la edición en el historial de auditoría

### Anular una Incidencia

**Solo Director o Admin**

1. Abra el detalle de la incidencia
2. Haga clic en **"Anular"**
3. Ingrese el motivo de anulación (obligatorio)
4. Confirme la acción
5. La incidencia cambiará a estado "Anulada" pero no se eliminará
6. Se registrará en auditoría

### Subir Evidencia Posterior

Si una incidencia no tiene evidencia y desea agregarla:

1. Abra el detalle de la incidencia
2. Haga clic en **"Subir Evidencia"**
3. Seleccione las fotografías
4. Confirme la carga
5. Las imágenes aparecerán en la galería

### Ver Galería de Evidencias

1. En el detalle de la incidencia, si hay evidencias, verá miniaturas
2. Haga clic en cualquier miniatura para verla en tamaño completo
3. Use las flechas para navegar entre imágenes
4. Puede descargar imágenes individuales

### Agregar Comentarios

**Permisos**: Tutor, Director, Admin

1. Abra el detalle de la incidencia
2. Vaya a la sección **"Comentarios"**
3. Escriba su comentario
4. Haga clic en **"Agregar Comentario"**
5. El comentario aparecerá con su nombre y fecha

### Imprimir Reporte de Incidencia

1. Abra el detalle de la incidencia
2. Haga clic en **"Imprimir"**
3. Se generará un PDF con:
   - Logo de la institución
   - Datos del estudiante
   - Detalles de la falta
   - Observaciones
   - Espacio para firma del padre
4. El sistema registrará la impresión en el historial

### Justificar Faltas

1. Vaya a **"Incidencias"** → **"Justificar Faltas"**
2. Busque la incidencia que desea justificar
3. Haga clic en **"Justificar"**
4. Seleccione el estado: **"Justificada"**
5. Agregue observaciones si es necesario
6. Guarde los cambios

---

## 👥 Gestión de Estudiantes

El módulo de estudiantes permite gestionar toda la información de los estudiantes del sistema.

### Ver Lista de Estudiantes

1. Vaya a **"Estudiantes"** en el menú lateral
2. Verá una tabla con todos los estudiantes activos

#### Filtros Disponibles

- **Nivel Educativo**: Primaria / Secundaria
- **Búsqueda**: Por nombre o código de barras
- **Estado**: Activo / Inactivo

### Ver Ficha Completa de un Estudiante

1. En la lista de estudiantes, haga clic en el ícono de **"Ver"** (👁️)
2. Se abrirá un modal con:
   - Foto del estudiante
   - Información personal
   - Grado y sección
   - Código de barras
   - Nivel de reincidencia actual
   - Datos de contacto familiar
   - Historial de incidencias
   - Historial de asistencias

### Crear un Nuevo Estudiante

1. Haga clic en **"Nuevo Estudiante"**
2. Complete el formulario:
   - **Código de Barras**: Obligatorio, debe ser único
   - **Nombre Completo**: Obligatorio
   - **Grado**: Seleccione el grado
   - **Sección**: Seleccione la sección
   - **Nivel Educativo**: Primaria o Secundaria
   - **Teléfono de Contacto**: Opcional
   - **Email de Contacto**: Opcional
   - **Nombre del Responsable**: Opcional
   - **Parentesco**: Opcional
   - **Teléfono de Emergencia**: Opcional
3. **Foto de Perfil** (Opcional):
   - Haga clic en **"Subir Foto"**
   - Seleccione una imagen (JPG o PNG, máximo 2MB)
   - La imagen se redimensionará automáticamente
4. Haga clic en **"Guardar"**

### Editar un Estudiante

1. En la lista, haga clic en el ícono de **"Editar"** (✏️)
2. Modifique los campos necesarios
3. Puede cambiar la foto de perfil
4. Haga clic en **"Guardar Cambios"**

> ⚠️ **Nota**: El código de barras no se puede modificar después de crear el estudiante.

### Desactivar un Estudiante

1. Abra la ficha del estudiante
2. Haga clic en **"Desactivar"**
3. Confirme la acción
4. El estudiante no aparecerá en búsquedas pero se conservará su historial

### Importar Estudiantes Masivamente

1. Haga clic en **"Importar Estudiantes"**
2. Descargue la plantilla Excel proporcionada
3. Complete la plantilla con los datos de los estudiantes
4. Suba el archivo completado
5. El sistema mostrará un preview de los datos
6. Revise y corrija errores si los hay
7. Confirme la importación

### Exportar Lista de Estudiantes

1. Aplique los filtros deseados
2. Haga clic en **"Exportar"**
3. Seleccione el formato: Excel o CSV
4. El archivo se descargará automáticamente

---

## 📅 Citas con Padres

El módulo de citas permite programar y gestionar reuniones con los padres de familia.

### Ver Lista de Citas

1. Vaya a **"Citas con Padres"** en el menú lateral
2. Verá una tabla con todas las citas programadas

#### Filtros Disponibles

- **Estado**: Todas, Programada, Confirmada, Realizada, Cancelada
- **Rango de Fechas**: Filtre por periodo
- **Estudiante**: Busque por nombre
- **Grado/Sección**: Filtre por aula

### Crear una Nueva Cita

1. Haga clic en **"Nueva Cita"**
2. Complete el formulario:
   - **Estudiante**: Busque y seleccione el estudiante
   - **Fecha**: Seleccione la fecha de la cita
   - **Hora**: Seleccione la hora
   - **Motivo**: Describa el motivo de la cita
   - **Observaciones**: Agregue detalles adicionales
3. Haga clic en **"Guardar"**
4. El sistema enviará una notificación al padre (si tiene email registrado)

### Registrar Asistencia a una Cita

1. En la lista de citas, localice la cita realizada
2. Haga clic en **"Registrar Asistencia"**
3. Seleccione el estado:
   - **Realizada**: El padre asistió
   - **Cancelada**: La cita fue cancelada
   - **No Asistió**: El padre no asistió
4. Agregue observaciones si es necesario
5. Guarde los cambios

### Cambiar Estado de una Cita

1. Abra el detalle de la cita
2. Haga clic en **"Cambiar Estado"**
3. Seleccione el nuevo estado
4. Guarde los cambios

### Estadísticas de Citas

En la parte superior de la página verá:
- Total de citas programadas
- Citas confirmadas
- Citas realizadas
- Tasa de asistencia

---

## 👨‍👩‍👧 Portal para Padres

El Portal para Padres es una interfaz dedicada donde los padres pueden ver información sobre sus hijos.

### Acceso

1. Los padres inician sesión con sus credenciales
2. Son redirigidos automáticamente al Portal para Padres

### Información Disponible

#### Información del Estudiante

- Nombre completo
- Grado y sección
- Foto de perfil
- Código de barras

#### Estadísticas de Asistencia

- **Mes Actual**:
  - Total de días con registro
  - Días a tiempo
  - Días con llegada tardía
  - Porcentaje de puntualidad

#### Registros de Entradas y Salidas

- Tabla con historial completo
- Filtros por fecha
- Muestra:
  - Fecha
  - Hora de llegada
  - Estado (A tiempo / Tarde)
  - Hora de salida (si está registrada)

#### Alertas de Salidas No Registradas

- Lista de días donde el estudiante llegó pero no tiene registro de salida
- Se actualiza en tiempo real
- Alertas críticas destacadas

#### Citas Programadas

- Lista de citas programadas con la institución
- Muestra:
  - Fecha y hora
  - Motivo
  - Estado
  - Observaciones

#### Incidencias (Solo Lectura)

- Lista de incidencias registradas
- Solo visualización, no se pueden editar
- Muestra:
  - Tipo de falta
  - Fecha
  - Observaciones
  - Estado (si está justificada)

---

## 📊 Reportes

El módulo de reportes permite generar análisis estadísticos y exportar información.

### Reportes de Incidencias

1. Vaya a **"Reportes"** → **"Reportes de Incidencias"**

#### Filtros Disponibles

- **Rango de Fechas**: Seleccione periodo
- **Grado**: Uno o varios grados
- **Sección**: Una o varias secciones
- **Tipo de Falta**: Seleccione tipos específicos
- **Categoría**: Conducta, Uniforme, Académica, Puntualidad
- **Nivel de Reincidencia**: Filtre por nivel
- **Año Escolar**: Seleccione el año
- **Bimestre**: Seleccione el bimestre

#### Gráficos Disponibles

1. **Tendencia Temporal**
   - Gráfico de línea
   - Muestra evolución de incidencias en el tiempo
   - Puede ver por día, semana o mes

2. **Distribución por Tipo de Falta**
   - Gráfico circular
   - Muestra porcentaje de cada tipo
   - Clic para ver detalles

3. **Distribución por Categoría**
   - Gráfico de barras
   - Compara categorías

4. **Distribución por Grado**
   - Gráfico de barras
   - Muestra incidencias por grado

#### Tablas de Datos

- **Ranking de Estudiantes**: Top estudiantes con más incidencias
- **Ranking de Grados/Secciones**: Grados con más incidencias
- **Distribución por Nivel de Reincidencia**: Estudiantes agrupados por nivel

#### Exportar Reportes

1. Aplique los filtros deseados
2. Haga clic en **"Exportar"**
3. Seleccione el formato:
   - **Excel**: Datos en formato de hoja de cálculo
   - **PDF**: Reporte formateado con gráficos
   - **CSV**: Datos en formato texto

### Reporte de Asistencias

1. Vaya a **"Reportes"** → **"Reporte de Asistencias"**

#### Filtros Disponibles

- **Rango de Fechas**
- **Grado/Sección**
- **Año Escolar**
- **Bimestre**

#### Información Mostrada

- Total de registros
- Estudiantes a tiempo
- Estudiantes con llegada tardía
- Porcentajes
- Gráficos de tendencia

#### Exportar

- Mismas opciones que Reportes de Incidencias

---

## ⚙️ Configuración del Sistema

El módulo de configuración está disponible solo para Administradores.

### Catálogo de Faltas

1. Vaya a **"Catálogos"** → **"Catálogo de Faltas"**

#### Crear una Nueva Falta

1. Haga clic en **"Nueva Falta"**
2. Complete el formulario:
   - **Nombre**: Nombre descriptivo de la falta
   - **Categoría**: Conducta, Uniforme, Académica, Puntualidad
   - **Gravedad**: Leve o Grave
   - **Puntos**: Puntos de reincidencia (1-10)
3. Haga clic en **"Guardar"**

#### Editar una Falta

1. En la lista, haga clic en **"Editar"**
2. Modifique los campos necesarios
3. Guarde los cambios

> ⚠️ **Nota**: Los cambios solo afectan a incidencias futuras, no a las históricas.

#### Desactivar una Falta

1. Haga clic en **"Desactivar"**
2. La falta no aparecerá en el dropdown de registro
3. Se conservará en incidencias históricas

### Configuración del Sistema

1. Vaya a **"Administración"** → **"Configuración"**

#### Configurar Algoritmo de Reincidencia

1. **Ventana de Días**: Seleccione 30, 60, 90 o 120 días
2. **Puntos por Falta Leve**: Establezca puntos (ej: 1)
3. **Puntos por Falta Grave**: Establezca puntos (ej: 3)
4. **Umbrales por Nivel**:
   - Nivel 1: X puntos
   - Nivel 2: X puntos
   - Nivel 3: X puntos
   - Nivel 4: X puntos
   - Nivel 5: X puntos
5. El sistema mostrará ejemplos de cálculo
6. Haga clic en **"Guardar Configuración"**

#### Datos Institucionales

1. Complete los datos:
   - Nombre de la institución
   - Dirección
   - Teléfonos
   - Email
   - Logo (opcional)
2. Estos datos aparecerán en reportes e impresiones

### Auditoría

1. Vaya a **"Administración"** → **"Auditoría"**

#### Ver Logs

- Ver todas las acciones realizadas en el sistema
- Filtros por:
  - Usuario
  - Tipo de acción
  - Tabla afectada
  - Rango de fechas

#### Exportar Logs

- Exporte los logs a CSV para análisis externo

---

## 💡 Consejos y Trucos

### Atajos de Teclado

- **Enter**: Confirmar acción en formularios
- **Esc**: Cerrar modales
- **Ctrl + F**: Buscar en la página actual

### Mejores Prácticas

1. **Registro de Incidencias**:
   - Siempre agregue observaciones detalladas
   - Suba evidencia fotográfica cuando sea posible
   - Revise el nivel de reincidencia antes de registrar

2. **Control de Asistencia**:
   - Registre las salidas al final del día
   - Revise las alertas de salidas no registradas regularmente

3. **Reportes**:
   - Use filtros específicos para obtener datos precisos
   - Exporte reportes importantes para archivo
   - Compare periodos para identificar tendencias

4. **Gestión de Estudiantes**:
   - Mantenga actualizados los datos de contacto
   - Suba fotos de perfil para facilitar identificación
   - Revise regularmente estudiantes inactivos

### Optimización de Búsquedas

- Use códigos de barras cuando sea posible (más rápido)
- En búsquedas manuales, escriba al menos 3 caracteres
- Use filtros para reducir resultados

### Trabajo con Evidencias

- Comprima imágenes grandes antes de subirlas
- Use formato JPG para fotografías (mejor compresión)
- Revise las imágenes antes de guardar

---

## 🔧 Solución de Problemas

### No Puedo Iniciar Sesión

**Problema**: Credenciales incorrectas

**Solución**:
1. Verifique que su nombre de usuario y contraseña sean correctos
2. Asegúrese de que no tenga activado el bloqueo de mayúsculas
3. Si olvidó su contraseña, contacte al administrador

**Problema**: Usuario bloqueado

**Solución**:
- Contacte al administrador para desbloquear su cuenta
- El bloqueo se levanta automáticamente después del tiempo indicado

### El Código de Barras No Funciona

**Problema**: El escáner no lee el código

**Solución**:
1. Verifique que el escáner esté conectado correctamente
2. Pruebe escanear en otro campo de texto (Notepad)
3. Ingrese el código manualmente
4. Verifique que el código de barras esté registrado en el sistema

### No Aparece un Estudiante en la Búsqueda

**Problema**: Estudiante no encontrado

**Solución**:
1. Verifique que el estudiante esté activo
2. Verifique la ortografía del nombre
3. Use el código de barras si está disponible
4. Verifique los filtros aplicados

### No Puedo Editar una Incidencia

**Problema**: Botón de editar deshabilitado

**Solución**:
- **Supervisor**: Solo puede editar sus propias incidencias dentro de 24 horas
- **Director/Admin**: Deben tener permisos activos
- Contacte al administrador si cree que hay un error

### Las Imágenes No Se Suben

**Problema**: Error al subir evidencia

**Solución**:
1. Verifique que el archivo sea JPG o PNG
2. Verifique que el tamaño sea menor a 5MB
3. Intente comprimir la imagen
4. Verifique su conexión a internet

### El Dashboard No Carga

**Problema**: Pantalla en blanco o error

**Solución**:
1. Recargue la página (F5)
2. Limpie la caché del navegador
3. Verifique su conexión a internet
4. Contacte al administrador si persiste

### No Ve Ciertas Opciones en el Menú

**Problema**: Falta de permisos

**Solución**:
- Cada rol tiene acceso a diferentes funcionalidades
- Contacte al administrador si necesita permisos adicionales
- Verifique que su sesión esté activa

### Los Reportes No Se Exportan

**Problema**: Error al exportar

**Solución**:
1. Verifique que tenga aplicados filtros válidos
2. Intente con un rango de fechas más pequeño
3. Verifique que tenga espacio en disco
4. Intente con otro formato (Excel en lugar de PDF)

---

## 📞 Soporte y Contacto

### Contactar al Administrador

Si necesita ayuda adicional:
1. Contacte al administrador del sistema
2. Proporcione detalles del problema
3. Incluya capturas de pantalla si es posible

### Información del Sistema

- **Versión**: 1.0
- **Última Actualización**: [Fecha]
- **Navegadores Compatibles**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## 📝 Glosario de Términos

- **Incidencia**: Registro de una falta disciplinaria de un estudiante
- **Reincidencia**: Repetición de faltas por parte de un estudiante
- **Nivel de Reincidencia**: Escala de 0 a 5 que indica la gravedad de la reincidencia
- **Evidencia**: Fotografías o documentos que respaldan una incidencia
- **Justificar**: Proceso de marcar una falta como justificada
- **Anular**: Proceso de invalidar una incidencia (solo Director/Admin)
- **Bimestre**: Periodo académico de dos meses
- **Año Escolar**: Periodo académico completo

---

## ✅ Checklist de Uso Diario

### Para Supervisores

- [ ] Revisar alertas de salidas no registradas
- [ ] Registrar incidencias del día
- [ ] Revisar incidencias pendientes
- [ ] Registrar salidas de estudiantes

### Para Directores

- [ ] Revisar dashboard ejecutivo
- [ ] Revisar reportes del día/semana
- [ ] Gestionar citas con padres
- [ ] Revisar estudiantes en riesgo

### Para Tutores

- [ ] Registrar llegadas de estudiantes
- [ ] Revisar alertas de reincidencia
- [ ] Agregar comentarios a incidencias

### Para Padres

- [ ] Revisar asistencia del estudiante
- [ ] Verificar alertas de salidas
- [ ] Revisar citas programadas
- [ ] Consultar incidencias

---

**¡Gracias por usar el Sistema de Control de Incidencias Escolares!**

*Este manual se actualiza periódicamente. Consulte la versión más reciente para obtener las últimas funcionalidades.*

---

*Manual de Usuario v1.0 - Sistema de Control de Incidencias Escolares*


