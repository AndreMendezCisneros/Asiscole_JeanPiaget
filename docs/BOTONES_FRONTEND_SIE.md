# Botones y acciones del frontend SIE (Jean Piaget)

Documento de referencia: **qué hace cada botón / acción** y **cómo está pensado usarlo** en el día a día del colegio.

**Base de código:** `Asiscole_JeanPiaget_actual`  
**Roles:** Público · Tutor · Padre · Supervisor · Director · Admin  
**Zona horaria:** Lima (America/Lima)

---

## Cómo está pensado el sistema (visión general)

| Quién | Entra por | Trabajo típico |
|-------|-----------|----------------|
| **Tutor** | `/tutor-scanner` | Escanea carnets en la puerta (llegada/salida). La **foto solo aparece cuando la llegada ya se guardó**. Puede registrar faltas rápidas. |
| **Supervisor** | `/dashboard` | Opera asistencia, incidencias, estudiantes, citas y reportes de asistencia/integral. |
| **Director** | Igual que Supervisor + | Catálogo de faltas, reportes de incidencias, pensiones (si está activo). |
| **Admin** | Todo lo anterior + | Auditoría y configuración del sistema. |
| **Padre** | `/parent-portal` o `/portal-padres` | Consulta asistencia, incidencias y citas (sobre todo **lectura**). |
| **Público** | Login / portal DNI | Entrar con usuario o consultar por número de carnet. |

**Sesión (inactividad local):** Tutor/Docente 5 h · Admin/Supervisor 30 min · Padre 15 min.  
(El token en Supabase puede seguir en 45 min hasta aplicar el SQL de 5 h.)

---

## Mapa rol → pantallas

```
Público ........ /login · /portal-padres · /llegada/*
Tutor .......... /tutor-scanner (+ /cambiar-password)
Padre .......... /parent-portal
Supervisor ..... dashboard + asistencia + incidencias + estudiantes + citas + reportes asistencia/integral
Director ....... lo de Supervisor + catálogo faltas + reportes incidencias + pensiones
Admin .......... lo de Director + auditoría + configuración
```

---

## 0. Público / sin sesión

### Login — `/login`

| Botón / control | Para qué sirve | Cómo usarlo |
|-----------------|----------------|-------------|
| **Continuar** | Inicia sesión y manda al home del rol | Usuario + clave del colegio |
| **Mostrar/Ocultar contraseña** | Ver lo que se escribe | Usabilidad |
| **Recordarme** | Prefiere mantener datos de login en el equipo | Equipos fijos del colegio |
| **¿Olvidó clave?** | Avisa que contacte al administrador | No hay auto-recuperación |
| **Soy padre / apoderado** | Va a consulta por carnet (`/portal-padres`) | Padres sin cuenta staff |

### Cambiar contraseña — `/cambiar-password`

| Botón | Para qué sirve | Cómo usarlo |
|-------|----------------|-------------|
| **Mostrar/Ocultar** | Ver clave nueva / confirmación | Primer acceso o reset forzado |
| **Cambiar contraseña** | Guarda y entra al home del rol | Obligatorio si el sistema lo pide |

### Portal público por carnet — `/portal-padres`

| Botón | Para qué sirve | Cómo usarlo |
|-------|----------------|-------------|
| **Ver asistencia** | Abre `/llegada/dni/:carnet` | Digitar número del carnet del hijo |
| **Volver al login** | Regresa a `/login` | Si quería entrar con usuario |

### Vista de llegada — `/llegada/dni/:dni` · `/llegada/:id`

| Botón | Para qué sirve | Cómo usarlo |
|-------|----------------|-------------|
| **Mes anterior / siguiente** | Cambia el calendario | Ver historial |
| **Día del calendario** | Detalle de ese día | Tocar el día |
| **Intentar con otro número** | Vuelve al portal DNI | Carnet mal escrito |
| **Ir al login** / **Ingresar** | Entrar con cuenta | Ver incidencias/citas completas |

---

## 1. Tutor — `/tutor-scanner`

Pantalla a pantalla completa (sin menú staff). Pensada para **fila rápida** con lector de códigos.

| Botón / control | Para qué sirve | Cómo usarlo |
|-----------------|----------------|-------------|
| **Salir** | Cierra sesión | Fin del turno |
| **Clase** / **Talleres** | Cambia el tipo de registro (si talleres está activo) | Mañana = Clase; taller = extracurricular |
| **Llegada** / **Salida** | Fase del registro | Entrada al llegar; salida al retiro |
| Campo código + **Registrar** (Enter) | Busca alumno y **guarda** llegada/salida | Flujo principal con pistola/lector |
| **Limpiar** (Esc) | Borra el código | Lectura mala o cambiar de alumno |
| **Búsqueda por nombre/DNI** (resultado) | Elige alumno sin carnet legible | Tocar el nombre → registra igual |
| **Cerrar perfil** / **Siguiente estudiante** | Cierra la foto y reenfoca el lector | Pasar al siguiente de la fila |
| **Reporte rápido** (nombre de falta) | Registra incidencia al toque | Solo modo Clase |
| **Otra incidencia…** | Abre catálogo completo + observaciones | Falta que no está en atajos |
| **Cancelar** / **Guardar incidencia** | Cierra o guarda la falta | Documentar y avisar a padres |
| **Últimos escaneos** | Historial de la sesión | Revisar conteo del turno |

### Flujo pensado (llegada)

1. Tutor elige **Clase → Llegada**.  
2. Escanea carnet.  
3. El sistema **guarda en la base**.  
4. **Solo entonces** muestra la foto (confirmación de que sí se registró).  
5. WhatsApp/aviso a padres va en segundo plano (no frena el escaneo).  
6. Si falla la red: **no muestra foto** y puede encolar para reintentar.

---

## 2. Padre — `/parent-portal`

Shell propio (`ParentLayout` + barra inferior). Staff también puede abrir esta ruta.

| Botón | Para qué sirve | Cómo usarlo |
|-------|----------------|-------------|
| **Cerrar sesión** | Sale del portal | En el celular/PC familiar |
| **Chip / nombre del hijo** | Cambia de alumno | Familias con varios hijos |
| **Inicio** | Resumen del día | Ver si llegó / salió hoy |
| **Asist.** / **Asistencia** | Historial por fechas | Consultar mes |
| **Faltas** / **Incidencias** | Lee incidencias del colegio | Solo lectura |
| **Citas** | Ve reuniones programadas | Solo lectura |
| **Ver todas** / **Ver hoy** | Atajos entre pestañas | Desde el resumen |

> Las citas se **gestionan en staff** (`/parent-meetings`). El padre solo las consulta.

---

## 3. Staff — menú lateral (Sidebar)

Roles: Supervisor, Director, Admin (según ítem).

| Ítem de menú | Quién lo ve | Para qué |
|--------------|-------------|----------|
| **Inicio** | Supervisor+ | Dashboard del día |
| **Asistencia → Control de Llegadas** | Supervisor+ | Ver/corregir llegadas |
| **Asistencia → Registro de Salidas** | Supervisor+ | Retiros por aula |
| **Asistencia → Justificar asistencia** | Supervisor+ | Justificar tardanza/falta de asistencia |
| **Asistencia → Compromisos de alarma** | Supervisor+ | Actas por reincidencia (tardanzas, etc.) |
| **Incidencias → Lista** | Supervisor+ | Revisar cola de faltas |
| **Incidencias → Registrar** | Supervisor+ | Alta formal en oficina |
| **Incidencias → Justificar Faltas** | Supervisor+ | Cerrar casos justificados |
| **Estudiantes** | Supervisor+ | Padrón / fichas |
| **Citas con Padres** | Supervisor+ | Agenda y control de reuniones |
| **Catálogos → Catálogo de Faltas** | Director, Admin | Tipología de faltas |
| **Reportes → Incidencias** | Director, Admin (ruta) | Estadísticas de faltas |
| **Reportes → Asistencias** | Supervisor+ | Planillas |
| **Reportes → Integral** | Supervisor+ | Ficha consolidada del alumno |
| **Pensiones** | Director, Admin (si feature on) | Mora / importación |
| **Administración → Auditoría** | Admin | Logs de cambios |
| **Administración → Configuración** | Admin | Horarios, reincidencia, pensiones |
| **Cerrar Sesión** | Staff | Fin de jornada |

**Paginación** en tablas staff: Anterior / Siguiente / Ir a página / Filas por página.

---

## 4. Staff — por pantalla

### Inicio — `/dashboard`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Nueva incidencia** | Atajo a registrar | Caso urgente |
| **Lista de incidencias** | Ver cola | Revisión diaria |
| **Control de asistencia** | Ir a llegadas | Operación mañana |
| **Reportes** | Ir a reportes | Dirección (ACL: Director/Admin en `/reports`) |
| **Reintentar** | Recarga si falló la red | — |
| **Ver control** / **Ver todas** / fila incidencia | Navega al detalle | Desde gráficos o feed |
| **Ir** (alerta salida) | Va a salidas | Alumno sin salida |

### Control de llegadas — `/arrival-control`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| Filtros (fecha, nivel, grado, sección, estado) | Acotar listado | Oficina |
| **Actualizar** | Recargar tras el escáner | Sync |
| **Registrar** (sin llegada) | Llegada manual | Olvidó el carnet |
| **Editar entrada** → **Sí, editar…** → **Confirmar cambio** | Corregir hora | Error de registro |
| **Volver** / **Cancelar** | Abortar edición | — |

### Registro de salidas — `/departure-control`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| Tipo **Normal** / **Autorizada** | Tipo de salida masiva | Retiro normal vs permiso |
| **Limpiar filtros** | Reset de aula | Cambiar de grado |
| **Ver en detalle** | Listado individual filtrado | De aula → alumnos |
| **Registrar salida seleccionada / del aula / todas pendientes** | Salida masiva | Fin de jornada por salones |
| **Confirmar** / **Cancelar** (diálogo) | Evitar errores masivos | — |
| **Registrar uno** / **Registrar Salida** | Salida por carnet | Caso suelto |
| **Registrar** (fila) | Un alumno del listado | Caso a caso |
| **Actualizar** | Recargar | Sync |

### Justificar asistencia — `/justify-attendance`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Limpiar filtros** / **Borrar búsqueda** | Nueva consulta | — |
| **Justificar** → **Confirmar** | Guarda justificación | Apoderado trajo documento |
| **Cancelar** | No guarda | — |

### Compromisos de alarma — `/compromisos-alarma`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Abrir** / **Cerrar** | Selecciona alumno en alarma | Entrevista con apoderado |
| Tipo de compromiso | Motivo del acta | Tardanzas, inasistencias, etc. |
| **Imprimir acta** | PDF para firmar | Papel en reunión |
| **Registrar firmado** → **Confirmar** | Marca firmado y reinicia aviso | Cierre formal |

### Lista de incidencias — `/incidents`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Exportar Excel** | Descarga filtrada | Consejo / archivo |
| **Limpiar filtros** | Reset | — |
| **Ver** | Detalle + fotos | Revisar evidencia |
| **Justificar** | Cierra caso activa | Pedido de padres |
| **PDF** / **Imprimir PDF** | Expediente | Entrevista |
| **Cancelar** / **Justificar** (diálogo) | Abortar o guardar | — |

### Registrar incidencia — `/register`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Buscar** estudiante | Localiza alumno | Oficina |
| **Cerrar** (alerta reincidencia) | Sigue tras aviso | — |
| Quitar foto evidencia | Corrige adjunto | Foto equivocada |
| **Guardar Incidencia** | Persiste falta | Registro formal |
| **Limpiar** | Resetea formulario | Empezar de nuevo |

### Justificar faltas — `/justify-faults`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Justificar** → **Confirmar Justificación** | Cierra incidencia | Cola administrativa |
| **Cancelar** | No guarda | — |

### Estudiantes — `/students`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Exportar Excel** | Padrón filtrado | Nómina |
| **Nuevo Estudiante** → **Guardar** | Alta | Matrícula / actualización |
| **Actualizar** | Recarga listado | Tras cambios |
| **Ver detalles** | Ficha rápida | Consulta |
| **Editar** → **Guardar Cambios** | Actualiza datos/foto | Corrección |
| Subir foto | Foto de perfil | Carnet visual |

### Citas con padres — `/parent-meetings`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Exportar Excel** | Listado de citas | Seguimiento |
| **Citas masivas** | Crear por grado/sección | Reunión grupal |
| **Calendario** / **Lista** | Cambiar vista | Planificar vs gestionar |
| **Nueva cita** | Cita 1:1 | Entrevista |
| Click en calendario | Prellena fecha/hora | Agendar rápido |
| **Ver** | Detalle | Consulta |
| **Confirmar** / **Cancelar** | Estado de la cita | Llamada al apoderado |
| **A tiempo** / **Tarde** / **No Asistió** | Asistencia del apoderado | Control de reunión |
| **Reprogramar** | Nueva fecha | Inasistencia |
| **Crear Cita** / **Crear Citas Masivas** | Guarda (opcional aviso app) | Programación |
| **Notificar por la aplicación** | Marca aviso in-app | Portal padres |

---

## 5. Director / Admin

### Catálogo de faltas — `/faults`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Nueva Falta** → **Guardar** | Alta de tipología | Inicio de año / ajustes |
| Filtros por categoría | Acota catálogo | Conducta, uniforme, etc. |
| **Editar** → **Guardar cambios** | Actualiza puntos/recomendación WhatsApp | Política disciplinaria |

### Reportes de incidencias — `/reports`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Actualizar** | Recarga stats | — |
| **PDF** / **Excel** | Exporta | Informe a dirección |
| Filtros período / alumno / gravedad | Acota análisis | — |

### Pensiones — `/pensiones` *(si `VITE_PENSIONES_ENABLED`)*

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Actualizar** | Recarga mora | Tras import |
| **Elegir Excel** → **Confirmar importación** | Carga archivo del banco | Mensual |
| **Cancelar** | Descarta archivo | Error |
| **Marcar pagado** | Regulariza a mano | Caso especial |
| **Notificar** | Aviso a moroso | Cobranza |

---

## 6. Solo Admin

### Auditoría — `/audit`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Exportar Excel** | Descarga logs | Compliance |
| **Limpiar Filtros** | Nueva pesquisa | — |
| **Ver Detalles** | Modal del evento | Investigar |

### Configuración — `/system-config`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Guardar horarios** | Límites puntualidad Primaria/Secundaria | Reglamento |
| **Guardar reincidencia** | Umbrales de niveles | Política |
| **Guardar pensiones** | Mora + aviso sonoro en escáner | Cobranza |
| **Reintentar** | Recarga tarjeta | Error de red |

---

## 7. Reportes de asistencia / integral (Supervisor+)

### Reporte de asistencias — `/attendance-report`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Mensual** / **Bimestral** | Tipo de planilla | Pedido de dirección |
| **Consultar** / **Actualizar** | Genera datos | — |
| **Imprimir** / **PDF** / **Excel** | Entrega oficial | Archivo físico o digital |

### Reporte integral — `/integral-report`

| Botón | Para qué | Flujo |
|-------|----------|-------|
| **Individual** / **General** | Un alumno vs consolidado | Entrevista vs aula |
| **Mensual** / **Bimestral** | Período | — |
| **Consultar** / **Actualizar** | Arma bloques (asistencia, incidencias, etc.) | Visión 360 |
| **PDF** / **Excel** | Descarga | Entrega a padres/dirección |

---

## Notas importantes

1. **Escáner tutor:** la foto es la **confirmación de guardado**, no un preview previo.  
2. **Menú Reportes vs ACL:** el ítem puede mostrarse a Supervisor, pero `/reports` (incidencias) exige Director/Admin. Supervisor usa Asistencias e Integral.  
3. **Citas:** gestión = staff; consulta = portal padre.  
4. **Features:** Talleres y Pensiones dependen de variables `VITE_*_ENABLED`.  
5. Páginas como TalleresAdmin / NotasAdmin pueden existir en el repo pero **no están enrutadas** en este `App.tsx` de JP.

---

*Documento generado para capacitación y referencia operativa. Actualizar si se agregan pantallas o cambian roles.*
