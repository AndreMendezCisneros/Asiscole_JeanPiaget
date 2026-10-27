# Docente tutor de aula (rol `DocenteTutor`)

El docente encargado de un salón entra con su propio usuario y ve, **solo de su salón y sin poder
modificar nada**:

- la llegada del día,
- la salida del día,
- las incidencias, con sus evidencias pero sin datos de los apoderados,
- el reporte de asistencia por mes o bimestre.

No confundir con el rol `Tutor`, que es el escáner de puerta (`/tutor-scanner`).

## Cómo lo asigna RR.HH.

1. Ir a **Personal → Gestión de Personal**.
2. En la fila del empleado, pulsar el botón del birrete (**Tutor de aula**).
3. Completar:
   - **Salón**: sale de la lista real de los alumnos activos. Los salones que ya tienen tutor aparecen deshabilitados.
   - **Usuario**: se propone el DNI.
   - **Contraseña**: mínimo 6 caracteres. Al editar, si se deja vacía no se cambia.
4. **Acceso activo**: si se apaga, el docente no puede entrar y su sesión se cierra al momento.
5. **Quitar tutor** borra la tutoría y el usuario.

Al desactivar al empleado, el sistema también desactiva su usuario de tutor y cierra su sesión
(trigger `sie_trg_personal_baja_tutor`).

## Seguridad

- `DocenteTutor` **no** es staff (`_sie_es_staff`) y no tiene políticas RLS: no puede leer ni escribir
  ninguna tabla de forma directa.
- Todo lo que ve viene de las RPC `sie_tutor_*`. Estas validan el token y filtran por su salón en el servidor.
- Un salón tiene un solo tutor activo; lo impone el índice único `personal_tutoria_salon_activo_uq`.
- Sesión: 30 minutos de inactividad, el valor por defecto de `sie_iniciar_sesion`. No se modificó el login.

## Instalación (en este orden)

1. `scripts/jeanpiaget/PATCH_DOCENTE_TUTOR_ROL.sql`: agrega el valor nuevo del enum. Va en su propia ejecución.
2. `scripts/jeanpiaget/PATCH_DOCENTE_TUTOR.sql`: tabla, índices, RPC y trigger. Solo agrega objetos.
3. `scripts/jeanpiaget/TEST_DOCENTE_TUTOR.sql`: verificación. Termina en `ROLLBACK` y no deja datos.
   Debe terminar con `== TODO OK ==`.
4. Desplegar el frontend.
5. Crear un tutor de prueba, entrar con él y revisar las 4 pestañas. Luego cargar al resto.

Si no se ejecuta el SQL, Gestión de Personal funciona igual, pero no muestra el botón de tutor.
