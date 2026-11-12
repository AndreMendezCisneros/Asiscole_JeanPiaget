# Arquitectura nueva de Asiscole — explicación detallada

**Versión:** 1.0  
**Fecha:** 29 de septiembre de 2026  
**Para quién es:** quien tenga que entender, explicar o construir el sistema, sin haber estado en el diseño.  
**De qué habla:** la arquitectura objetivo. No es el manual de lo que ya está en producción.  
**Documentos de apoyo:** el plano de obra (`2026-SIE-microservicios-aula-siagie.md`) y el dibujo `asiscole-objetivo.html`.

Este texto explica la casa completa: por qué se parte, qué ambiente existe, qué guarda cada uno, cómo viaja un dato, qué pasa si se corta una pieza y en qué orden se construye.

---

## 1. La idea en una página

Hoy cada colegio es un salón único. El navegador del personal habla directo con una base Supabase. El celular de la familia habla con otro programa (el canal Django). WhatsApp vive en otra máquina. Las reglas de negocio están repartidas entre la pantalla, funciones SQL y el canal.

La arquitectura nueva parte esa casa en **ocho ambientes**. Cada ambiente tiene una puerta (su API), un armario propio (su base) y un oficio. Un ambiente no abre el armario de otro. Si necesita un dato, lo pide por HTTP o espera un aviso.

Hay tres plantas, siempre en este orden:

1. **Fachada.** Lo que ve la gente: consola de Asiscole, panel y escáner del colegio, app de familias.
2. **Ambientes.** Los ocho servicios que guardan y deciden.
3. **Servicios del lote.** Lo que entra a la casa y no es negocio escolar: Cloudflare, Caddy, PostgreSQL, RabbitMQ, Redis, archivos y respaldos.

La regla de obra es esta: **lo que cambia un dato se guarda en el momento, en una sola transacción. Lo lento (WhatsApp, push, SIAGIE, un Excel pesado) sale después.** El escáner no espera a que el mensaje llegue al celular para decir “registrado”.

---

## 2. Qué duele hoy, y qué corrige la obra

### 2.1 Cómo está armado el sistema que ya opera

| Pieza | Dónde está | Qué hace hoy |
|---|---|---|
| Panel, escáner y portal web | React 18, Vite, TypeScript. Jean Piaget en `jeanpiaget.asiscole.com`, archivos en `/opt/sie-jp/dist` | El personal marca, registra faltas, mira reportes |
| Datos de cada colegio | Un proyecto Supabase (Postgres) por colegio | Alumnos, llegadas, incidencias, usuarios del personal |
| App de familias | Flutter. El servidor es Django (`/canal-api`, puerto 8000 en el dedicado) | El apoderado entra con teléfono + código del estudiante, ve avisos y recibe push |
| WhatsApp | Otra máquina (`178.104.115.2`): cola, chips WPPConnect y Meta | Entrega el aviso después de que el colegio ya marcó |
| Entrada pública | Cloudflare delante. Caddy en el servidor de origen | HTTPS, el dominio y el reparto de rutas |

Jean Piaget y el canal viven en el dedicado `138.201.203.50` (máquina A). San Ramón y WhatsApp viven en el VPS `178.104.115.2` (máquina B).

### 2.2 Los problemas que esa forma no aguanta

- **La pantalla escribe reglas.** El navegador arma conteos, baja filas y decide. Cuando la base se satura (por ejemplo el inicio del panel, que se bajaba todas las incidencias y Postgres cortaba la consulta), la pantalla se cae aunque el dato exista.
- **Tres sitios saben la misma regla.** React, funciones SQL y Django no siempre coinciden. Un cambio en uno no actualiza a los otros.
- **Un colegio es un proyecto aparte.** Colores, menú y a veces código se copian. Una plantilla nueva debería desarrollarse una vez y elegirse, no clonarse.
- **El aviso y el hecho van pegados.** Si WhatsApp está caído, la gente siente que “no se registró”, aunque la llegada sí se guardó.
- **La familia y el personal no comparten la misma puerta.** La web del personal usa sesión corta en el navegador. La app usa otra sesión, de varios días, una sola por celular. Son dos mundos que hoy se hablan por ingestas y tablas, no por un contrato claro.
- **Matrícula, pensiones, aula y SIAGIE no tienen ambiente.** Meterlos en la misma base del escáner mezcla obligaciones de dinero, notas y marcaciones.

La obra no tira lo que ya funciona el primer día. El canal Django se conserva al principio. El navegador deja de escribir directo a las tablas **módulo por módulo**, empezando por la puerta (la marcación).

---

## 3. Las tres plantas

```text
Fachada
  Consola Asiscole          Panel y escáner          App de familias
        \                        |                         /
                     Cloudflare (DNS, WAF, TLS)
                               |
                            Caddy
         /          /          |          \            \
platform-   school-   attendance  discipline  family-   billing
control     core                              channel
                         classroom    integrations
                               |
                    PostgreSQL (8 bases)   RabbitMQ   R2
                               |
                         Proveedores
                    SIAGIE · WhatsApp · pasarela de pago
```

### 3.1 Fachada

Hay **un solo código** de panel web (React + TypeScript). No hay un repositorio por colegio. Lo que cambia de un colegio a otro es una configuración publicada: logo, colores, tipografía, menú y módulos encendidos.

| Fachada | Quién entra | Qué no hace |
|---|---|---|
| Consola Asiscole | Equipo de administración y soporte | No marca llegadas ni guarda deudas |
| Panel y escáner | Personal de ese colegio | No llama a los puertos de WhatsApp. Llama a Caddy |
| App de familias | Apoderados | Durante la transición sigue hablando con el canal actual |

Cambiar el menú o los colores **no cambia los permisos**. Apagar el módulo “aula” esconde el aula y niega el permiso. Mover un ítem del menú no otorga el permiso.

### 3.2 Servicios del lote

Cada pieza tiene un solo oficio.

| Pieza | Oficio | Qué no hace |
|---|---|---|
| **Cloudflare** | DNS, proxy naranja, certificado público, WAF, caché de estáticos | No guarda alumnos ni marcaciones |
| **Caddy** | Entrega la fachada y manda cada ruta al ambiente dueño | No decide si una falta se publica |
| **PostgreSQL** | Ocho bases lógicas. Una credencial por ambiente | Un ambiente no hace `JOIN` con la base de otro |
| **RabbitMQ** | Lleva el aviso **después** de guardar | No es la respuesta de la pantalla |
| **Redis** | Caché de la configuración publicada (tema, módulos) | No es el armario de alumnos ni de deudas |
| **R2** | Fotos, evidencias y materiales | La base guarda la referencia, no el archivo |
| **Respaldos** | Copia restaurable, fuera de las dos máquinas | El RAID del dedicado no cuenta como respaldo |
| **Logs y métricas** | Latencia, errores, colas, CPU | No se guardan dentro de la base de cuentas |

Al inicio las ocho bases pueden vivir en **una** instalación de PostgreSQL en la máquina A. Eso ya separa dueños y claves. Si A se apaga, se apagan las ocho juntas. Separarlas de máquina es un paso posterior, cuando una medición lo pida.

### 3.3 Los ocho ambientes

| Ambiente | Base | Oficio en una frase |
|---|---|---|
| `platform-control` | `platform_db` | Quién es el colegio, quién puede entrar y cómo se ve la casa |
| `school-core` | `school_db` | La estructura: alumno, apoderado, año, grado, sección, matrícula |
| `attendance` | `attendance_db` | La puerta: llegada, salida, tardanza, justificación, talleres |
| `discipline` | `discipline_db` | La convivencia: falta, reincidencia, citas, anulación |
| `family-channel` | `family_db` | El buzón: mensaje, lectura, push, confirmación |
| `billing` | `billing_db` | La obligación: concepto, deuda, pago, conciliación |
| `classroom` | `classroom_db` | El aula: cursos, materiales, tareas, evaluaciones |
| `integrations` | `integrations_db` | La calle: WhatsApp, SIAGIE, pasarela, webhooks |

En el dibujo de la fachada, cinco de estos (school-core, attendance, discipline, billing y classroom) aparecen juntos como “servicios escolares” para que quepan en una hoja. En la obra son cinco puertas y cinco bases.

Un componedor de pantallas (BFF) es opcional: junta dos o tres respuestas para una vista. **No es un noveno ambiente y no tiene base de negocio.**

---

## 4. Reglas que valen en toda la casa

1. Toda fila de un colegio lleva `institution_id`. Los índices y las restricciones respetan ese colegio.
2. El identificador de colegio que manda el navegador **no autoriza solo**. Decir “soy Jean Piaget” en el cuerpo de la petición no abre los datos de Jean Piaget.
3. Para operar hacen falta, juntos: cuenta habilitada, pertenencia activa a ese colegio, módulo habilitado, permiso de la acción y acceso a ese registro.
4. Cada ambiente comprueba eso. No se delega en “el de al lado ya miró”.
5. Una **cuenta** y un **estudiante** son cosas distintas. Un alumno puede estar matriculado y no tener usuario para entrar.
6. Hay roles de plataforma (equipo Asiscole) y roles del colegio. Un rol de colegio no concede administración global.
7. Los tokens los firma un componente mantenido. No se inventa criptografía propia. Cada ambiente comprueba emisor, destinatario y vencimiento en local.
8. Permisos y suspensiones se reparten por eventos. Hay que fijar tres números antes de programar: cuánto vale una autorización ya guardada, cuándo se vuelve a preguntar, y qué acciones se rechazan si no se puede comprobar.
9. Una suspensión inmediata y, a la vez, seguir operando sin límite sin el control central, no caben juntas. Lo sensible exige autorización vigente. Lo ordinario admite un plazo corto.
10. Lo que modifica datos va en una transacción síncrona. Lo lento sale después, por outbox.
11. No hay un proyecto de código por colegio.

Dentro de cada ambiente las capas son las mismas:

| Capa | Oficio |
|---|---|
| API (Django Ninja) | Validar la entrada, autenticar, responder |
| Casos de uso | Coordinar “matricular”, “marcar”, “anular” |
| Reglas | Decidir si esa acción es válida |
| Persistencia | Modelos, restricciones, consultas, transacción |
| Eventos | Outbox, consumidores, trabajos de fondo |

El lenguaje del servidor es **Python**. El canal ya es Django. Los ambientes nuevos usan Django con Django Ninja (contratos claros, sin un segundo lenguaje de backend). El frente sigue en React y TypeScript. No se reescribe el panel en otro framework en esta fase.

---

## 5. Cada ambiente, con detalle

### 5.1 platform-control — la administración del edificio

Es el backend de la consola del equipo Asiscole.

**Guarda**

- Instituciones: alta, estado, identificación, dominios autorizados.
- Identidad: cuentas, inicio de sesión, segundo factor del equipo, sesiones, recuperación.
- Pertenencias: el vínculo de una cuenta con un colegio (activa o suspendida).
- Roles de plataforma y roles de colegio, por separado.
- Asignaciones: qué rol tiene una cuenta y sobre qué alcance.
- Módulos: qué ambientes están contratados o encendidos en ese colegio.
- Experiencia: logo, colores, tipografía, plantilla, menú, versión, estado (borrador, publicada, retirada) e historial.
- Solicitudes de aprovisionamiento y seguimiento de cambios.

**No guarda** la deuda, la marcación ni el mensaje. La consola los pide al ambiente dueño y los muestra juntos.

**Publica:** `institution.created`, `membership.changed`, `experience.published`.

**Cómo se usa el tema.** El flujo es editar, previsualizar, validar, publicar, distribuir y poder volver atrás. La configuración publicada puede quedar un tiempo en el navegador y en Redis. No se pregunta a platform-control en cada botón ni en cada marcación.

### 5.2 school-core — la estructura académica

Es la ficha del colegio, no el día a día de la puerta.

**Guarda:** estudiante, ficha, apoderado, vínculo familiar, año académico, grado, sección, matrícula, catálogos del colegio, horarios y carga docente.

**No guarda:** la contraseña, la sesión, la marcación del día, la falta disciplinaria ni la pensión.

**Publica**

- `enrollment.changed` cuando cambia una matrícula. Lo oyen attendance y classroom, que actualizan una **copia mínima** para poder validar un código sin leer `school_db`.
- `guardian_link.changed` cuando cambia el vínculo con el apoderado. Lo oye family-channel.

Esa copia mínima no es una segunda ficha editable. Si la matrícula cambia, el aviso reconcilia la copia. Quien necesita la ficha completa se la pide a school-core por HTTP.

### 5.3 attendance — la puerta

Es el ambiente más sensible a la hora de ingreso.

**Guarda:** llegada, salida, tardanza, justificación, el dispositivo del escáner, una copia local mínima de la matrícula (solo para validar el código), el compromiso de alarma por umbral de tardanzas (hoy, cinco) y el lote mensual listo para SIAGIE.

**No guarda:** el texto del WhatsApp, la cuenta del tutor, la ficha completa, el cobro de una pensión ni el envío a SIAGIE.

La alarma de tardanzas es una regla de asistencia. No es cobranza. Una deuda no bloquea la marcación.

**Publica** `attendance.recorded`. El canal arma el mensaje. El lote mensual avisa a integrations para SIAGIE; attendance no habla con el Ministerio.

**Recorrido de una marcación**

1. El escáner envía el código con un identificador único de ese intento.
2. Caddy entrega la llamada a attendance.
3. Attendance comprueba la copia de matrícula y el permiso.
4. En la **misma transacción** guarda la marcación y la fila del outbox.
5. Responde confirmado al escáner. Aquí termina lo que ve el tutor.
6. Un publicador manda el evento a RabbitMQ.
7. family-channel guarda el mensaje **una sola vez** y programa el aviso.
8. integrations entrega el WhatsApp. Si falla, reintenta. El mensaje ya está en la bandeja de la app.

Si se repite el mismo identificador de escaneo, no se crean dos llegadas.

Si el colegio se queda sin red, el escáner puede guardar en local. Esa marca se ve como **pendiente** hasta que el servidor confirme. Pendiente y confirmada no se muestran igual. “Sin registrar” y “pendiente de subir” son estados distintos.

### 5.4 discipline — la convivencia

**Guarda:** incidencia, tipo de falta, gravedad, estado, reincidencia, seguimiento, acuerdos, citas y la anulación con motivo.

**No guarda:** el archivo de la foto (va a R2; aquí queda la referencia), el envío del aviso ni la matrícula.

**Publica** `incident.created` **solo** cuando la regla dice que la familia debe ver esa falta. No toda falta genera aviso. El canal decide el texto. La evidencia no viaja dentro del evento: viaja la referencia al objeto en R2.

### 5.5 family-channel — el buzón

Es el mundo del apoderado. Hoy ya existe, con otro nombre: el canal Django.

**Guarda:** mensaje, destinatario, lectura, preferencia, dispositivo de push y la confirmación de que el apoderado vio el aviso.

**No guarda:** la marcación original ni la incidencia completa. Guarda el mensaje que se armó a partir del aviso.

El push y el WhatsApp son el timbre. La copia que manda es el mensaje ya guardado. Si el canal está caído, la asistencia sigue. Los eventos esperan en el outbox de quien los produjo.

**Sesión de la app, como está hoy y como se conserva.** El apoderado no tiene contraseña en el canal. Entra con teléfono y código del estudiante. Hay **una sola sesión activa** por cuenta. Un segundo celular no reemplaza al primero: se le niega el ingreso y debe pedir traslado. La sesión dura del orden de diez días. Eso no es la sesión del personal en la web (minutos de inactividad, guardada en la pestaña). Son dos puertas distintas a propósito.

Al empezar, este ambiente **puede conservar la API del canal actual**. No hace falta reescribirlo para que el resto de la casa exista. El traslado de su base y de sus trabajadores de aviso a la máquina B se planifica aparte: esa máquina ya tiene San Ramón y los chips, y le queda poca memoria y disco.

### 5.6 billing — las obligaciones

Todavía no existe como ambiente. El aviso de pensión de hoy no es este módulo.

**Guarda:** concepto, deuda, pago, conciliación, movimiento y el estado de la obligación.

**No guarda:** el mensaje al apoderado ni el webhook crudo del banco. El webhook lo recibe integrations y, cuando cuadra, confirma aquí.

**Publica** `payment.confirmed`. El canal avisa. Los reportes leen el dato de billing, no una copia editable en otro lado.

Una pensión impaga no borra ni bloquea una llegada. Son ambientes distintos.

### 5.7 classroom — el aula

Todavía no existe como ambiente. Las notas semanales parciales de hoy no son este módulo.

Un solo ambiente, con módulos internos: cursos, materiales, tareas, entregas, evaluaciones y, cuando toque, la clase en vivo. El video no se separa el primer día. Si más adelante el directo exige otra máquina, se saca solo el motor de video.

La presencia de una clase puede avisar a attendance para un consolidado. La nota del curso **no es** la matrícula: la matrícula sigue en school-core.

### 5.8 integrations — la puerta a la calle

**Guarda:** webhook recibido, correspondencia con el sistema externo, intento, resultado y la credencial cifrada de SIAGIE, WhatsApp y la pasarela.

**No guarda:** el alumno, la marcación de origen ni la regla de “esta falta se publica”. Esa regla vive en discipline o en attendance.

Habla con SIAGIE **solo** por API oficial o de socio. No se automatiza la página web del Ministerio. Hoy esa API masiva no está documentada para el público: el enchufe se deja listo y el envío real espera credenciales. Hasta entonces el lote mensual puede existir en attendance sin salir a la calle.

WhatsApp de hoy (cola, WPPConnect, Meta) entra por aquí. El navegador no llama a los puertos del otro servidor. Llama a Caddy, y Caddy llama al destino acordado. Ese puente hay que conservarlo en cada despliegue: si Caddy vuelve a mandar WhatsApp a `localhost` del dedicado, los avisos se cortan.

---

## 6. Cómo viaja un dato

Hay dos tuberías. No se elige por gusto: se elige por si la pantalla necesita la respuesta ya.

| Tubería | Se usa cuando | Ejemplo |
|---|---|---|
| HTTP, con contrato | La pantalla necesita la respuesta en ese momento | “¿Este código está matriculado ahora?” |
| Evento en RabbitMQ | Otro ambiente debe reaccionar después | Matrícula cambiada, asistencia registrada, pago confirmado |

### 6.1 Catálogo de avisos

| Evento | Quién lo emite | Quién lo suele oír |
|---|---|---|
| `institution.created` | platform-control | Ambientes que preparan la configuración vacía del colegio |
| `membership.changed` | platform-control | Ambientes que guardan permisos locales |
| `experience.published` | platform-control | Cachés y fachadas que bajan el tema |
| `enrollment.changed` | school-core | attendance, classroom |
| `guardian_link.changed` | school-core | family-channel |
| `attendance.recorded` | attendance | family-channel y resúmenes |
| `incident.created` | discipline | family-channel, si la regla publica |
| `payment.confirmed` | billing | family-channel y reportes |

Cada aviso lleva identificador único, colegio, versión del esquema, fecha y referencia del registro. Viaja **solo** el dato necesario para reaccionar. No viaja la ficha completa, ni la foto, ni el teléfono en claro si el receptor no lo necesita para esa reacción.

### 6.2 Outbox: no perder y no duplicar

Este es el mecanismo que evita dos fallos clásicos: “se marcó en pantalla y el aviso nunca salió” y “el aviso salió dos veces”.

1. El ambiente guarda el registro de negocio.
2. En la **misma transacción** guarda el aviso pendiente (la fila de outbox).
3. Confirma. Si el servidor se cae aquí, o están los dos o no está ninguno.
4. Un publicador envía el aviso a RabbitMQ y espera confirmación de que la cola lo aceptó.
5. El consumidor lo procesa y anota que ese identificador ya se atendió.
6. Si el mismo aviso llega otra vez, no crea otro mensaje ni otro pago.

Los reintentos son limitados y cada vez esperan más. Lo que no sale va a una cola de revisión visible en la consola. Tener una cola no basta: hay que confirmar al publicar y al consumir, y hay que recordar el identificador ya atendido.

### 6.3 Archivos y reportes

Fotos, evidencias y materiales van a R2. La base del ambiente dueño guarda el identificador del objeto.

Un reporte pesado se encola. No bloquea el escáner. Una réplica de solo lectura para reportes se agrega cuando una medición lo pida, no antes. Particionar una tabla se decide cuando el volumen de **esa** tabla lo justifique.

---

## 7. Historias completas

### 7.1 El tutor escanea una llegada

El tutor no espera a WhatsApp. La pantalla pide a attendance. Attendance guarda la llegada y el aviso pendiente, y responde. Recién después family-channel crea el mensaje e integrations intenta el WhatsApp. Si el chip está cerrado, la llegada sigue confirmada y el aviso queda en reintento. La familia lo ve en la bandeja en cuanto el canal procesa el evento, aunque el WhatsApp tarde.

### 7.2 Se registra una falta

El personal crea la incidencia en discipline. La foto sube a R2; discipline guarda la referencia. Si la regla de esa falta dice que la familia debe enterarse, se publica `incident.created`. Si la regla dice que no, no hay evento y la app no muestra nada. Anular una falta es un cambio en discipline, con motivo, no un borrado silencioso.

### 7.3 El apoderado abre el celular

La app no consulta la base de llegadas. Consulta su buzón. Si no hay sesión válida, entra de nuevo con teléfono y código. Si el servidor todavía tiene una sesión viva de **otro** identificador de aparato, niega el ingreso y ofrece traslado. No reemplaza la sesión anterior sola. Cerrar la app en el celular no siempre cierra la sesión del servidor: por eso a veces “se cerró en el teléfono” y al volver a entrar el servidor dice que ya hay una sesión.

### 7.4 Cambia la matrícula

school-core guarda la matrícula y publica `enrollment.changed`. attendance actualiza la copia con la que valida códigos. classroom actualiza a quién ve en el curso. Nadie lee `school_db` para eso. Si el aviso se retrasa, el escáner sigue validando con la copia anterior hasta que el aviso llegue. Por eso el plazo de esa copia tiene que estar definido: no puede quedar eterna ni puede exigir una llamada a school-core en cada pitido.

### 7.5 Se paga una pensión

La pasarela llama a integrations. Integrations guarda el webhook y, cuando la firma cuadra, le dice a billing que confirme el pago. billing publica `payment.confirmed`. family-channel avisa. El webhook crudo no se edita desde el panel de deudas.

### 7.6 El inicio del panel

Hoy el panel se caía porque el navegador pedía todas las incidencias activas y Postgres cortaba la consulta. En la obra, el panel pide agregados al ambiente dueño (o a un reporte ya calculado). No se baja la tabla para contar. El arreglo actual del dashboard de Jean Piaget (una sola agregación en la base) es un paso en esa dirección, todavía dentro de Supabase, no todavía el ambiente `discipline` separado.

---

## 8. Dónde se instala

| Máquina | Qué se instala en la obra | Qué ya ocupa el sitio |
|---|---|---|
| **A** `138.201.203.50` | platform-control, school-core, attendance, discipline, billing, classroom, integrations, las bases al inicio, RabbitMQ, Redis, Caddy | Frontend de Jean Piaget y, hasta el traslado, el Django del canal en el puerto 8000 |
| **B** `178.104.115.2` | family-channel, su base y los trabajadores de aviso | San Ramón y WhatsApp (cola, chips y Meta) |
| **C**, cuando exista | Réplica y recuperación de A | No cubre B salvo que el plan copie también su base, sus archivos y sus procesos |

En A los contenedores llevan límite de memoria, de procesos y de conexiones, sumados para toda la máquina. No se levanta un ejército de workers por ambiente el primer día.

Cloudflare sigue delante. Caddy sigue siendo el origen. El mapa de rutas de WhatsApp se mantiene hasta que integrations absorba ese tráfico **con el mismo contrato**.

### Qué sigue y qué se detiene si se corta algo

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

## 9. Seguridad, colegios y permisos

### Un colegio no lee a otro

El aislamiento no es “el menú no muestra el otro colegio”. Es una restricción de datos: `institution_id` en cada fila, credencial de base distinta por ambiente, y la API que rechaza un colegio al que la cuenta no pertenece. La prueba de la etapa 0 es concreta: un colegio no lee datos de otro, ni por API ni por base.

### Quién puede hacer qué

| Tipo | Ejemplos | Límite |
|---|---|---|
| Rol de plataforma | Soporte Asiscole, operación de la consola | No es un director de un colegio |
| Rol de colegio | Admin, Director, Supervisor, Tutor, Docente | No administra la plataforma ni otro colegio |
| Familia | Apoderado | Ve el buzón y lo que la regla publicó de sus vinculados. No registra faltas ni marca la puerta del personal |

La pertenencia puede suspenderse sin borrar la cuenta ni al estudiante. Suspender el vínculo corta el acceso. No borra el historial del alumno.

### Dos sesiones, a propósito

| | Personal en la web | Apoderado en la app |
|---|---|---|
| Credencial | Usuario y contraseña | Teléfono y código del estudiante |
| Dónde vive | Pestaña del navegador | Servidor del canal, atada al aparato |
| Duración | Minutos de inactividad | Días, con una sola sesión activa |
| Si se abre en otro lado | Puede haber otra sesión de personal | El segundo aparato se niega hasta un traslado |

### Auditoría

Cada ambiente audita lo suyo. La consola los lista cuando tiene permiso de consulta. No hay una sola tabla mágica con todos los cambios de todas las bases: eso volvería a juntar los armarios.

---

## 10. Orden de obra

Se respetan los ocho límites desde el dibujo. No se construye todo el mismo día. Cada etapa termina cuando se puede demostrar lo de la columna derecha.

| Etapa | Se levanta | Se acepta cuando |
|---|---|---|
| 0 | Contratos, `institution_id`, auditoría, errores, Caddy detrás de Cloudflare | Un colegio no lee datos de otro, ni por API ni por base |
| 1 | platform-control: instituciones, cuentas, pertenencias, roles, tema versionado | La consola publica un tema y otro colegio no lo hereda |
| 2 | school-core: estructura y matrícula | Un estudiante existe sin cuenta de acceso |
| 3 | attendance: marcación, identificador único, outbox | Repetir el mismo escaneo no crea dos llegadas |
| 4 | Canal actual, enchufado por eventos | Si el canal está apagado, la marcación igual queda confirmada |
| 5 | discipline | Una incidencia publica aviso solo si la regla lo dice |
| 6 | billing, classroom, integrations según haya función | SIAGIE tiene enchufe y no envía hasta tener credencial |

Antes de sumar muchos colegios se prueba: aislamiento, revocación de un permiso, duplicados, recuperación del outbox y una carga simultánea en la puerta. Este plano **no** afirma cuántos colegios aguanta el dedicado. Eso se mide.

---

## 11. Qué ya existe y qué es solo el plano

| Ya opera | Es la obra, todavía no está partido así |
|---|---|
| Panel React por colegio, sobre Supabase | Ocho APIs con ocho bases |
| Canal Django: teléfono + código, sesión única, push | family-channel como consumidor de eventos de attendance y discipline |
| WhatsApp en la máquina B, puenteado por Caddy | integrations como única puerta a la calle |
| Agregados del inicio en una función de la base (Jean Piaget) | El panel pidiendo el agregado a discipline, sin bajarse la tabla |
| Aviso de pensión y notas parciales | billing y classroom |
| Colegios de prueba con su propio Supabase y su subdominio | Una sola aplicación y una configuración publicada por colegio |

Hasta que una etapa se acepte, el camino de producción sigue siendo el de hoy: el navegador habla con Supabase del colegio y la app habla con el canal. La obra no se “enciende” por subir un diagrama.

---

## 12. Glosario corto

| Palabra | Significado aquí |
|---|---|
| Ambiente | Un servicio con su API y su base. No comparte tablas con los demás |
| Fachada | La pantalla. No es dueña del dato |
| Copia mínima | El poco dato que otro ambiente guarda para validar sin leer la base dueña |
| Outbox | La fila del aviso, guardada en la misma transacción que el hecho |
| Evento | El aviso que viaja por la cola después de guardar |
| Tenant / colegio | La institución. Toda fila lleva su identificador |
| Máquina A | Dedicado `138.201.203.50`. Jean Piaget, canal de transición y, en la obra, la mayoría de ambientes |
| Máquina B | VPS `178.104.115.2`. San Ramón y WhatsApp; en la obra, el canal familiar |
| BFF | Un armador de pantallas. Opcional. Sin base de negocio |

---

## 13. Cómo explicar esto en cinco minutos

Asiscole deja de ser “una web que escribe en la base del colegio”. Pasa a ser una casa de ocho ambientes. El personal marca en la puerta y esa marca se confirma sola. El aviso a la familia sale después, y si WhatsApp falla la marca no se deshace. Cada colegio usa el mismo programa; lo que cambia es la configuración que publica la consola. El dinero, la falta, la matrícula y el mensaje no viven en la misma gaveta. Y no se construye todo junto: primero el aislamiento y las cuentas, después la ficha, después la puerta, y recién entonces el buzón enchufado por avisos.
