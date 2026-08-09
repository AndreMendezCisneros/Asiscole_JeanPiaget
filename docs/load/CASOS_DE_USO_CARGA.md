# Casos de uso — pruebas de carga SIE

Pruebas para validar si el sistema aguanta la carga operativa del colegio.
**Ejecutar en entorno de prueba/staging**, nunca en horario de clases en producción sin autorización.

---

## Requisitos previos

1. Copiar variables en `.env.local`:
   ```env
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # solo para cargar pool de estudiantes

   # 4 tutores de prueba (mínimo)
   LOAD_TUTOR_ACCOUNTS=Tutor1:clave,Tutor2:clave,Tutor3:clave,Tutor4:clave

   # WhatsApp (opcional)
   VITE_OPENWA_ENABLED=true
   VITE_OPENWA_API_URL=http://localhost:2785/api
   VITE_OPENWA_SESSION_ID=...
   VITE_OPENWA_API_KEY=...
   ```

2. Instalar dependencias: `npm ci`

---

## Comandos

| Comando | Qué prueba |
|---------|------------|
| `npm run test:load:padres` | 10 000 consultas DNI en 30 min (ritmo constante) |
| `npm run test:load:tutores` | 4 tutores escaneando 30 min sin parar |
| `npm run test:load:whatsapp` | Cola de mensajes OpenWA (conservador) |
| `npm run test:load:all` | Las tres pruebas en secuencia |
| `npm run test:load:padres -- --dry-run` | Solo 10 consultas (~5 s) |
| `npm run test:load:tutores -- --minutes 5` | Tutores 5 minutos |
| `npm run test:load:whatsapp -- --max 20 --dry-run` | Simula 20 envíos |

Los informes JSON se guardan en `scripts/load/reports/`.

---

## Casos de uso (checklist)

### CU-01 — Consulta padres bajo carga sostenida
| Campo | Valor |
|-------|-------|
| **Actor** | Padre/apoderado (público, sin login) |
| **Endpoint** | RPC `buscar_asistencia_por_dni` |
| **Volumen** | 10 000 peticiones |
| **Duración** | 30 minutos |
| **Ritmo** | ~5,5 req/s constante |
| **Criterio OK** | ≥ 99 % éxito, p95 < 2 500 ms |
| **Comando** | `npm run test:load:padres` |

**Qué valida:** portal `/portal-padres` → `/llegada/dni/:dni` no cae cuando muchos padres consultan a la vez (ej. después del recreo).

---

### CU-02 — Escaneo simultáneo de 4 tutores
| Campo | Valor |
|-------|-------|
| **Actores** | 4 tutores autenticados |
| **Flujo** | `sie_buscar_estudiante_carnet` + INSERT `registros_llegada` |
| **Duración** | 30 minutos continuos |
| **Criterio OK** | ≥ 98 % éxito, p95 < 4 000 ms |
| **Comando** | `npm run test:load:tutores` |

**Qué valida:** entrada matinal con varios tutores escaneando carnets al mismo tiempo; duplicados del mismo día cuentan como OK (`duplicate_today`).

---

### CU-03 — Pico de consultas padres (stress)
| Campo | Valor |
|-------|-------|
| **Volumen** | 1 000 peticiones en 5 min |
| **Comando** | `node scripts/load/parent-consultation-load.mjs --total 1000 --minutes 5` |

**Qué valida:** pico breve (todos los padres abren el enlace del WhatsApp a la vez).

---

### CU-04 — Escaneo tutor dry-run (smoke)
| Campo | Valor |
|-------|-------|
| **Duración** | 20 s, 4 tutores |
| **Comando** | `npm run test:load:tutores -- --dry-run` |

**Qué valida:** credenciales tutor y conectividad antes de la prueba larga.

---

### CU-05 — WhatsApp: capacidad del bot
| Campo | Valor |
|-------|-------|
| **Actor** | OpenWA / sesión WhatsApp del colegio |
| **Endpoint** | `POST /sessions/{id}/messages/send-text` |
| **Volumen default** | 50 mensajes |
| **Intervalo default** | 3 s (~20 msg/min) |
| **Criterio OK** | ≥ 95 % enviados sin error HTTP |
| **Comando** | `npm run test:load:whatsapp -- --max 50` |

**Qué valida:** si el bot puede notificar llegadas cuando muchos alumnos entran seguidos.

**Límites reales de WhatsApp:**
- Cuenta personal vinculada a OpenWA: **~20–40 mensajes/minuto** suele ser seguro; más puede provocar bloqueo temporal.
- Enviar a **toda la nómina de golpe** (500+) **no es recomendable** en una sola sesión personal.
- Para volumen alto: cola con retraso, horarios escalonados, o **WhatsApp Business API**.

---

### CU-06 — WhatsApp tras jornada completa simulada
| Campo | Valor |
|-------|-------|
| **Escenario** | Tras CU-02, ejecutar CU-05 con `--max` = llegadas nuevas registradas |
| **Comando** | Manual: revisar `metaCounts.registered` en informe tutor y ajustar `--max` |

**Qué valida:** cadena escáner → notificación WhatsApp bajo carga realista.

---

### CU-07 — Sesión expirada bajo carga
| Campo | Valor |
|-------|-------|
| **Precondición** | Token tutor > 15 min |
| **Esperado** | RPC devuelve error sesión; no registros huérfanos |
| **Comando** | Manual durante CU-02 largo |

---

### CU-08 — Duplicado mismo estudiante mismo día
| Campo | Valor |
|-------|-------|
| **Escenario** | Dos tutores escanean el mismo DNI el mismo día |
| **Esperado** | Un registro; el segundo `duplicate_today` o `race_duplicate` |
| **Comando** | Incluido en CU-02 |

---

### CU-09 — OWASP: no filtrar tokens en consola producción
| Campo | Valor |
|-------|-------|
| **Verificación** | Build producción + login; DevTools no debe mostrar `console.log` con respuesta login |
| **Comando** | `npm run build && npm run preview` + revisión manual |

---

### CU-10 — Métricas unitarias (CI)
| Campo | Valor |
|-------|-------|
| **Qué** | Cálculo intervalo 10k/30min, percentiles, umbrales |
| **Comando** | `npm test -- src/lib/loadTest/metrics.test.ts` |

---

## Interpretación de resultados

| Métrica | Bueno | Revisar |
|---------|-------|---------|
| Tasa éxito padres | ≥ 99 % | < 99 % → Supabase/RLS/índices |
| p95 padres | < 2,5 s | > 3 s → optimizar RPC o conexiones |
| Tasa éxito tutores | ≥ 98 % | Errores insert → RLS o locks |
| Escaneos/min (4 tutores) | > 200 total | < 100 → latencia RPC alta |
| WhatsApp éxito | ≥ 95 % | 429/503 → bajar `--interval-ms` |

---

## Orden recomendado de ejecución

1. `npm test` (unitarios métricas)
2. `npm run test:load:padres -- --dry-run`
3. `npm run test:load:tutores -- --dry-run`
4. `npm run test:load:whatsapp -- --dry-run --max 5`
5. Prueba corta: `--minutes 5` en padres y tutores
6. Prueba completa 30 min (fuera de horario escolar)
7. WhatsApp con `--max 20` real, luego escalar según resultados

---

## Advertencias

- Las pruebas de tutor **crean registros de llegada** reales en la BD de prueba.
- WhatsApp real puede **bloquear el número** del colegio si se abusa.
- Use **fecha de prueba** o limpie registros después con script SQL si es necesario.
- `SUPABASE_SERVICE_ROLE_KEY` bypass RLS: **no commitear** en el repositorio.
