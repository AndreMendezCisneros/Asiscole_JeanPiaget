# Plano de obra Asiscole

**Versión:** 0.4  
**Fecha:** 2026-09-26  
**Estado:** plano para construir. No es una prueba de carga del servidor.  
**Para leerlo con formato:** abrir [`plano-de-obra.html`](plano-de-obra.html) en el navegador. Este archivo `.md` es el texto fuente.  
**Vista general:** [`asiscole-objetivo.html`](asiscole-objetivo.html)

Este documento es el plano de la casa. Dice qué ambiente existe, qué se guarda en cada uno, quién puede entrar, por dónde pasa el agua y la luz, y en qué orden se levanta. La vista general es el dibujo de la fachada. El detalle de cada pieza está aquí.

---

## Cómo se lee

Hay tres capas, siempre en este orden:

| Capa | En la casa | En Asiscole |
|---|---|---|
| Fachada | Puerta, ventanas, letrero | Consola, panel, escáner, app de familias |
| Ambientes | Habitaciones con su propio armario | Ocho microservicios, cada uno con su base |
| Servicios del lote | Acometida, medidor, desagüe | Cloudflare, Caddy, RabbitMQ, PostgreSQL, Redis, R2, respaldos |

Regla de obra: un ambiente no abre el armario de otro. Pide el dato por la puerta (HTTP) o recibe un aviso (evento).

---

## 1. El terreno que ya existe

Hoy la casa no está partida en ocho ambientes. Hay un solo salón por colegio (React + una base Supabase), un canal Django y WhatsApp en el otro servidor.

### 1.1 Acometida pública: DNS

La zona `asiscole.com` está en Cloudflare, con el proxy naranja activo. Cloudflare recibe el HTTPS del navegador. El servidor de origen no se publica directo a internet.

| Dominio | Apunta a | Máquina | Qué abre hoy |
|---|---|---|---|
| `asiscole.com`, `www` | `138.201.203.50` | Dedicado `asiscole-ded1` | Sitio comercial y entrada general |
| `jeanpiaget.asiscole.com` | `138.201.203.50` | El mismo dedicado | Panel, escáner y portal de Jean Piaget |
| `sanramon.asiscole.com` | `178.104.115.2` | VPS Hetzner | El mismo tipo de sistema, para San Ramón |

Jean Piaget no lo sirve un Worker de Cloudflare. Lo sirve Caddy, con archivos estáticos en `/opt/sie-jp/dist`.

### 1.2 Las dos máquinas

| | Máquina A | Máquina B |
|---|---|---|
| Dirección | `138.201.203.50` | `178.104.115.2` |
| Equipo | Físico Fujitsu, i7-7700 (4 núcleos / 8 hilos), ~62 GB RAM, dos NVMe en RAID1 | KVM, 4 vCPU, ~7,6 GB RAM, disco cerca del 68 % |
| Sistema | Ubuntu 24.04 | Ubuntu en el VPS |
| Hoy | Caddy 80/443. Frontend Jean Piaget. Canal Django en el puerto 8000, ruta `/canal-api` | Frontend San Ramón. Cola de avisos `:3102`. WPPConnect `:21465`. Meta `:3101` |

El dedicado reenvía estas rutas al Hetzner, por HTTP, a esos puertos:

| Ruta en Jean Piaget | Destino |
|---|---|
| `/canal-api` | Django local, `127.0.0.1:8000` |
| `/wpp-notify` | `178.104.115.2:3102` |
| `/wpp-api` y `/api` | `178.104.115.2:21465` |
| `/meta-wa` | `178.104.115.2:3101` |

Ese puente es el que hay que conservar en cada despliegue. Si Caddy vuelve a mandar WhatsApp a `localhost` del dedicado, los avisos se cortan.

### 1.3 Qué hay dentro del salón único de hoy

El colegio usa React 18, Vite y TypeScript. Los datos viven en Supabase: Postgres, login, archivos y reglas de acceso en la misma base. Django existe solo para el canal móvil.

| Lo que el personal ya usa | A qué ambiente va en la obra nueva |
|---|---|
| Login, roles, sesión, bloqueo por intentos | `platform-control` |
| Estudiantes, apoderados, grados, secciones, docentes, catálogos | `school-core` |
| Escáner, llegadas, salidas, tardanzas, justificar asistencia, talleres, alarma de 5 tardanzas | `attendance` |
| Incidencias, fotos de falta, reincidencia, catálogo de faltas, citas con padres, anular | `discipline` |
| Portal de padres en la web | Misma fachada React, datos de varios ambientes |
| App de familias, bandeja, push, notas | `family-channel` (el Django actual se conserva al principio) |
| Avisos de WhatsApp | `integrations`, ejecutados hoy en la máquina B |
| Reportes, dashboard, Excel, PDF | El servicio dueño del dato; la pantalla los junta |
| Auditoría de cambios | Cada ambiente audita lo suyo; la consola los lista |
| Pensiones completas, aula virtual, subida a SIAGIE | Todavía no existen. Van a `billing`, `classroom` e `integrations` |

La alarma de 5 tardanzas es una regla de asistencia. No es cobranza.

---

## 2. Servicios del lote (lo que entra a la casa)

Cada pieza tiene un solo oficio.

| Pieza | Dónde se instala | Oficio | Qué no hace |
|---|---|---|---|
| **Cloudflare** | Delante de A y de B | DNS, proxy, certificado público, WAF, caché de estáticos | No guarda alumnos ni marcaciones |
| **Caddy** | En cada máquina de origen, puertos 80 y 443 | Entrega la fachada y manda cada ruta al ambiente dueño | No decide permisos de negocio |
| **React + TypeScript** | Archivos estáticos detrás de Caddy | Consola Asiscole y panel del colegio, un solo código, plantillas elegibles | No escribe reglas críticas directo a una tabla |
| **App de familias** | Móvil | Bandeja y avisos del apoderado | Durante la transición sigue hablando con el canal Django actual |
| **Django + Django Ninja** | Un proceso por ambiente | Valida la entrada, identifica al usuario y responde | Los permisos por colegio y por registro son reglas propias de Asiscole |
| **PostgreSQL** | Primero en la máquina A | Ocho bases lógicas, una credencial por ambiente | Un ambiente no hace `JOIN` con la base de otro |
| **RabbitMQ** | En A, junto a los productores | Lleva avisos después de guardar | No es la respuesta inmediata de una pantalla |
| **Redis** | En A | Caché de la configuración publicada | No es el armario de alumnos ni de deudas |
| **R2** | Borde Cloudflare | Fotos, evidencias y materiales | La base guarda la referencia, no el archivo |
| **Respaldos** | Fuera de A y de B | Copia restaurable | El RAID1 del dedicado no cuenta como respaldo |
| **Logs y métricas** | Proceso aparte de la web | Latencia, errores, colas, CPU | No se vacían dentro de `platform_db` |

Al inicio las ocho bases pueden compartir una sola instalación de PostgreSQL en A. Eso separa dueños y claves. Si A se apaga, se apagan las ocho juntas. Separarlas de máquina es un paso posterior, cuando la carga lo pida.

---

## 3. Las tres plantas

```text
Fachada
  Consola Asiscole          Panel y escáner          App de familias
        \                        |                         /
         \                       |                        /
                     Cloudflare (DNS, WAF, TLS)
                               |
                            Caddy
         /          /          |          \            \
        /          /           |           \            \
platform-   school-   attendance  discipline  family-   billing
control     core                              channel
                         classroom    integrations
                               |
                    PostgreSQL (8 bases)   RabbitMQ   R2
                               |
                         Proveedores
                    SIAGIE · WhatsApp · pasarela
```

Caddy llama al ambiente dueño. `platform-control` administra la casa. No se pone en medio de una marcación ni de una incidencia.

Un componedor de pantallas (BFF) es opcional para armar una vista que junta dos o tres ambientes. No es un noveno ambiente y no tiene base de negocio.

---

## 4. Reglas que valen en toda la casa

1. Toda fila de un colegio lleva `institution_id`. Los índices y las restricciones respetan ese colegio.
2. El identificador de colegio que manda el navegador no autoriza solo.
3. Para operar hace falta, junto: cuenta habilitada, pertenencia activa a ese colegio, módulo habilitado, permiso y acceso a ese registro.
4. Cada ambiente hace esa comprobación. No se delega en “el de al lado ya miró”.
5. Una cuenta y un estudiante son cosas distintas. Un alumno puede estar matriculado y no tener usuario para entrar.
6. Hay roles de plataforma (equipo Asiscole) y roles del colegio. Un rol de colegio no concede administración global.
7. Los tokens los firma un componente mantenido. No se inventa criptografía propia. Cada ambiente comprueba emisor, destinatario y vencimiento en local.
8. Permisos y suspensiones se reparten por eventos. Hay que fijar tres números antes de programar: cuánto vale una autorización guardada, cuándo se vuelve a preguntar, y qué acciones se rechazan si no se puede comprobar.
9. Una suspensión inmediata y seguir operando sin límite sin el control central no caben a la vez. Lo sensible exige autorización vigente. Lo ordinario admite un plazo corto.
10. Cambiar el menú o los colores no cambia los permisos.
11. No hay un proyecto de código por colegio. Una plantilla nueva se desarrolla una vez y después se elige en la consola.
12. Lo que modifica datos va en una transacción síncrona. Lo lento (avisos, SIAGIE, reportes pesados) sale después, por outbox.

Capas iguales dentro de cada ambiente:

| Capa | Oficio |
|---|---|
| API Django Ninja | Validar entrada, autenticar, responder |
| Casos de uso | Coordinar “matricular”, “marcar”, “anular” |
| Reglas | Decidir si esa acción es válida |
| Persistencia | Modelos, restricciones, consultas, transacción |
| Eventos | Outbox, consumidores, trabajos de fondo |

---

## 5. Plano de cada ambiente

### 5.1 platform-control — la administración del edificio

Backend de la consola del equipo Asiscole. Base `platform_db`.

| Zona interna | Qué se construye |
|---|---|
| Instituciones | Alta, estado, identificación, dominios autorizados |
| Identidad | Cuentas, inicio de sesión, MFA del equipo, sesiones, recuperación |
| Pertenencias | Vínculo de una cuenta con un colegio: activo o suspendido |
| Roles | Permisos de plataforma y permisos de colegio, por separado |
| Asignaciones | Qué rol tiene una cuenta y sobre qué alcance |
| Módulos | Qué ambientes están contratados o encendidos en ese colegio |
| Experiencia | Logo, colores, tipografía aprobada, plantilla, menú, versión, estado (borrador, publicada, retirada) e historial |
| Operación | Solicitudes de aprovisionamiento y seguimiento de cambios |
| Consulta | Acceso autorizado a métricas, logs y auditoría de los otros ambientes |

Guarda la cuenta, el colegio, el vínculo y la configuración publicada. No guarda la deuda, la marcación ni el mensaje. La consola los pide al ambiente dueño y los muestra juntos.

Eventos que publica: `institution.created`, `membership.changed`, `experience.published`.

### 5.2 school-core — la estructura académica

Base `school_db`.

| Guarda | No guarda |
|---|---|
| Estudiante, ficha, apoderado, vínculo familiar | La contraseña ni la sesión |
| Año académico, grado, sección, matrícula | La marcación del día |
| Catálogos del colegio, horarios y carga docente | La falta disciplinaria ni la pensión |

Cuando cambia una matrícula publica `enrollment.changed`. Cuando cambia el vínculo con el apoderado publica `guardian_link.changed`. Asistencia, aula y canal familiar actualizan su copia mínima con esos avisos. No leen `school_db`.

### 5.3 attendance — la puerta

Base `attendance_db`.

| Guarda | No guarda |
|---|---|
| Llegada, salida, tardanza, justificación | El texto del WhatsApp |
| Dispositivo del escáner | La cuenta del tutor |
| Copia local mínima de matrícula para validar el código | La ficha completa del alumno |
| Compromiso de alarma (umbral de tardanzas) | El cobro de una pensión |
| Lote mensual listo para SIAGIE | El envío a SIAGIE (eso es `integrations`) |

Recibe `enrollment.changed` y reconcilia esa copia por periodo. Publica `attendance.recorded`. El canal familiar arma el mensaje. El lote mensual avisa a `integrations` para SIAGIE.

Recorrido de una marcación:

1. El escáner envía el código con un identificador único.
2. Caddy entrega la llamada a `attendance`.
3. `attendance` comprueba la copia de matrícula y el permiso.
4. En la misma transacción guarda la marcación y la fila del outbox.
5. Responde confirmado al escáner.
6. Un publicador manda el evento.
7. `family-channel` guarda el mensaje una sola vez y programa el aviso.
8. `integrations` entrega el WhatsApp. Si falla, reintenta. El mensaje ya está en la bandeja.

Si el colegio se queda sin red, el escáner puede guardar en local. Esa marca se ve como pendiente hasta que el servidor confirme. Pendiente y confirmada no se muestran igual.

### 5.4 discipline — la convivencia

Base `discipline_db`.

| Guarda | No guarda |
|---|---|
| Incidencia, tipo de falta, gravedad, estado | El archivo binario de la foto (va a R2; aquí queda la referencia) |
| Reincidencia, seguimiento, acuerdos, citas | El envío del aviso |
| Anulación con motivo | La matrícula |

Publica `incident.created` solo cuando la regla dice que la familia debe verlo. El canal decide el mensaje. La evidencia vive en R2.

### 5.5 family-channel — el buzón

Base `family_db`. En la obra vive en la máquina B, con sus trabajadores de aviso. Hoy el Django del canal está en A y WhatsApp en B. El traslado se planifica con esa carga: B ya tiene San Ramón y los chips, y le queda poca RAM y disco.

| Guarda | No guarda |
|---|---|
| Mensaje, destinatario, lectura, preferencia, dispositivo | La marcación original |
| Confirmación de que el apoderado vio el aviso | La incidencia completa |

El push y el WhatsApp son el timbre. La copia que manda es el mensaje guardado. Si el canal está caído, la asistencia sigue y los eventos esperan en el outbox del productor.

Al empezar, este ambiente puede conservar la API del canal Django. No hace falta reescribirlo para que el resto de la casa exista.

### 5.6 billing — las obligaciones

Base `billing_db`.

| Guarda | No guarda |
|---|---|
| Concepto, deuda, pago, conciliación, movimiento | El mensaje al apoderado |
| Estado de la obligación | El webhook crudo del banco (lo recibe `integrations` y confirma aquí) |

Publica `payment.confirmed`. El canal avisa. Los reportes leen el dato de billing, no una copia editable en otro lado.

### 5.7 classroom — el aula

Base `classroom_db`. Un solo ambiente, con módulos internos: cursos, materiales, tareas, entregas, evaluaciones y, cuando toque, la clase en vivo. El video no se separa el primer día. Si más adelante el directo exige otra máquina, se saca solo el motor de video.

La presencia de una clase puede avisar a `attendance` para el consolidado. La nota del curso no es la matrícula: la matrícula sigue en `school-core`.

### 5.8 integrations — la puerta a la calle

Base `integrations_db`. Vive en A, junto al resto, porque guarda credenciales e intentos. Los trabajadores de WhatsApp pueden seguir en B mientras el contrato sea el mismo.

| Guarda | No guarda |
|---|---|
| Webhook recibido, correspondencia externa, intento, resultado | El alumno ni la marcación de origen |
| Credencial cifrada de SIAGIE, WhatsApp y pasarela | La regla de “esta falta se publica” |

Habla con SIAGIE solo por API oficial o de socio. No automatiza la web de SIAGIE. Hoy esa API masiva no está documentada para el público: el enchufe se deja listo y el envío real espera credenciales.

WhatsApp de hoy (cola, WPPConnect, Meta) entra por aquí. El navegador no llama a los puertos del Hetzner. Llama a Caddy, y Caddy llama al destino acordado.

---

## 6. Tuberías

### 6.1 Cuándo es una llamada y cuándo es un aviso

| Tubería | Se usa cuando | Ejemplo |
|---|---|---|
| HTTP con contrato OpenAPI | La pantalla necesita la respuesta ya | “¿Este código está matriculado ahora?” |
| Evento RabbitMQ | Otro ambiente debe reaccionar después | Matrícula cambiada, asistencia registrada, tema publicado |

### 6.2 Catálogo de avisos

| Evento | Quién lo emite | Quién lo suele oír |
|---|---|---|
| `institution.created` | platform-control | Ambientes que preparan configuración vacía del colegio |
| `membership.changed` | platform-control | Ambientes que guardan permisos locales |
| `experience.published` | platform-control | Cachés y fachadas que bajan el tema |
| `enrollment.changed` | school-core | attendance, classroom |
| `guardian_link.changed` | school-core | family-channel |
| `attendance.recorded` | attendance | family-channel, resúmenes |
| `incident.created` | discipline | family-channel, si la regla publica |
| `payment.confirmed` | billing | family-channel, reportes |

Cada aviso lleva identificador único, colegio, versión del esquema, fecha y referencia del registro. Viaja solo el dato necesario para reaccionar.

### 6.3 Outbox, para no perder ni duplicar

1. El ambiente guarda el registro de negocio.
2. En la misma transacción guarda el aviso pendiente.
3. Confirma.
4. Un publicador lo envía a RabbitMQ, con confirmación de publicación.
5. El consumidor lo procesa y anota que ese identificador ya se atendió.
6. Si llega otra vez, no crea otro mensaje ni otro pago.

Reintentos limitados, con espera cada vez mayor. Lo que no sale va a una cola de revisión visible en la consola. RabbitMQ pide confirmación al publicar y al consumir. Tener una cola no basta para procesar una sola vez.

### 6.4 Archivos y reportes

Fotos, evidencias y materiales van a R2. La base del ambiente dueño guarda el identificador del objeto. Un reporte pesado se encola. No bloquea el escáner. Particionar o archivar se decide cuando el volumen de esa tabla lo justifique. Una réplica de solo lectura para reportes se agrega cuando una medición lo pida, no antes.

---

## 7. Fachadas

| Fachada | Quién entra | De dónde sale la configuración |
|---|---|---|
| Consola Asiscole | Equipo de administración y soporte | `platform-control` |
| Panel institucional y escáner | Personal autorizado de ese colegio | Misma aplicación React, tema y módulos de ese colegio |
| App de familias | Apoderados | Canal familiar |

Flujo del diseño: editar, previsualizar, validar, publicar, distribuir, poder volver atrás. La configuración publicada puede quedar un tiempo en el navegador. No se pregunta a `platform-control` en cada botón ni en cada marcación.

Los módulos habilitados van en un registro distinto del tema. Apagar “aula” esconde el aula y niega el permiso. Mover un ítem del menú no otorga el permiso.

---

## 8. Dónde se clava cada cosa

| Máquina | Qué se instala | Qué ya ocupa el sitio |
|---|---|---|
| **A** `138.201.203.50` | platform-control, school-core, attendance, discipline, billing, classroom, integrations, las ocho bases al inicio, RabbitMQ, Redis, Caddy | Frontend Jean Piaget y, hasta el traslado, el Django del canal en `:8000` |
| **B** `178.104.115.2` | family-channel, su base y los trabajadores de aviso | San Ramón completo y WhatsApp en `:3102`, `:21465`, `:3101` |
| **C** cuando exista | Réplica y recuperación de A | No cubre B salvo que el plan copie también su base, sus archivos y sus procesos |

En A los contenedores llevan límite de memoria, procesos y conexiones, sumados para toda la máquina. No se levanta un ejército de workers por ambiente el primer día.

Cloudflare sigue delante de los dominios. Caddy sigue siendo el origen. El mapa de rutas de la sección 1.2 se mantiene hasta que `integrations` absorba WhatsApp con el mismo contrato.

| Si se corta | Qué sigue | Qué se detiene |
|---|---|---|
| La consola | Los colegios operan | El equipo Asiscole no administra |
| platform-control | Solicitudes con credencial todavía válida, según el plazo fijado | Altas, suspensiones nuevas y renovación de acceso |
| family-channel | La puerta y las incidencias | La bandeja nueva; los avisos esperan en el outbox |
| RabbitMQ | Se sigue guardando, con el aviso en el outbox | La reacción de los otros ambientes, hasta que vuelva |
| Un reporte pesado | El escáner | Solo ese informe |
| La base de attendance | El escáner puede dejar pendientes locales | No hay confirmación de servidor |
| La máquina A | Recuperación en C, un solo escritor | Jean Piaget y la consola, hasta promover C |
| La máquina B | El panel en A | San Ramón, WhatsApp y, cuando se mude, el canal |

No se promete que todo siga ante cualquier corte. El plano dice qué continúa, qué espera y cómo se recupera.

---

## 9. Orden de obra

Se respetan los ocho límites desde el dibujo. Se construye en este orden. Cada etapa termina cuando se puede demostrar lo de la columna derecha.

| Etapa | Se levanta | Se acepta cuando |
|---|---|---|
| 0 | Contratos, `institution_id`, auditoría, errores, Caddy detrás de Cloudflare | Un colegio no lee datos de otro, ni por API ni por base |
| 1 | platform-control: instituciones, cuentas, pertenencias, roles, tema versionado | La consola publica un tema y otro colegio no lo hereda |
| 2 | school-core: estructura y matrícula | Un estudiante existe sin cuenta de acceso |
| 3 | attendance: marcación, identificador único, outbox | Repetir el mismo escaneo no crea dos llegadas |
| 4 | Canal actual, enchufado por eventos | Si el canal está apagado, la marcación igual queda confirmada |
| 5 | discipline | Una incidencia publica aviso solo si la regla lo dice |
| 6 | billing, classroom, integrations según haya función | SIAGIE tiene enchufe y no envía hasta tener credencial |

Antes de sumar muchos colegios se prueba: aislamiento, revocación de un permiso, duplicados, recuperación del outbox y una carga simultánea en la puerta. El plano no afirma cuántos colegios aguanta el dedicado.

---

## 10. La vista general

Abrir [`asiscole-objetivo.html`](asiscole-objetivo.html).

El recuadro «Servicios escolares» del dibujo son cinco ambientes distintos: school-core, attendance, discipline, billing y classroom. En el plano cada uno tiene su puerta y su base. En el dibujo van juntos para que la fachada quepa en una hoja.

**Export** descarga PNG, JPEG, WebP o SVG. Para el PDF: **Imprimir → Guardar como PDF**. Los rótulos del dibujo están en español. Los botones del visor quedan en inglés.
