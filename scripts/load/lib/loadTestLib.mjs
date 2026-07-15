/**
 * Utilidades compartidas para pruebas de carga del SIE.
 * Ejecutar contra STAGING o entorno dedicado — NO en producción en horario escolar.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export function loadEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      const val = t.slice(i + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

export function getSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL || 'https://spdugaykkcgpcfslcpac.supabase.co';
}

export function getAnonKey() {
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28'
  );
}

export function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export function createAnonClient(apiToken) {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (apiToken) headers.set('x-sie-token', apiToken);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export function createServiceClient() {
  const key = getServiceKey();
  if (!key) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para cargar nómina de prueba.');
  }
  return createClient(getSupabaseUrl(), key);
}

export async function login(username, password) {
  const supabase = createAnonClient(null);
  const { data, error } = await supabase.rpc('sie_iniciar_sesion', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error(`Login RPC: ${error.message}`);
  const result = data;
  if (!result?.ok || !result.token) {
    throw new Error(result?.error || `Login fallido para ${username}`);
  }
  return { token: result.token, user: result.user };
}

export async function fetchActiveStudentBarcodes(limit = 500) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('estudiantes')
    .select('id_estudiante, codigo_barras, telefono_contacto, telefono_emergencia')
    .eq('activo', true)
    .limit(limit);

  if (error) throw new Error(`No se pudo cargar estudiantes: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id_estudiante,
    barcode: String(row.codigo_barras ?? '').trim(),
    phone: String(row.telefono_contacto || row.telefono_emergencia || '').trim(),
  })).filter((s) => s.barcode);
}

export function parseTutorAccounts(raw) {
  const source = raw || process.env.LOAD_TUTOR_ACCOUNTS || '';
  return source
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [username, password] = pair.split(':');
      if (!username || !password) {
        throw new Error(`Formato inválido en LOAD_TUTOR_ACCOUNTS: "${pair}" (use user:pass,user2:pass2)`);
      }
      return { username: username.trim(), password: password.trim() };
    });
}

export function getLimaNow() {
  const now = new Date();
  const date = now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return { date, time: time.slice(0, 8) };
}

/** Ejecuta fn cada intervalMs durante durationMs (ritmo constante). */
export async function runConstantRate({
  totalRequests,
  durationMs,
  fn,
  onProgress,
}) {
  const intervalMs = totalRequests > 0 ? durationMs / totalRequests : durationMs;
  const samples = [];
  const startedAt = Date.now();
  let completed = 0;

  for (let i = 0; i < totalRequests; i++) {
    const scheduledAt = startedAt + i * intervalMs;
    const waitMs = Math.max(0, scheduledAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);

    const t0 = performance.now();
    try {
      const result = await fn(i);
      samples.push({
        ok: result.ok,
        latencyMs: performance.now() - t0,
        error: result.error,
        status: result.status,
      });
    } catch (err) {
      samples.push({
        ok: false,
        latencyMs: performance.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    completed++;
    if (onProgress && (completed % 100 === 0 || completed === totalRequests)) {
      onProgress(completed, totalRequests);
    }
  }

  return { samples, durationMs: Date.now() - startedAt };
}

/** Workers en paralelo durante durationMs (escaneo continuo). */
export async function runParallelWorkers({
  workerCount,
  durationMs,
  workerFn,
  onProgress,
}) {
  const startedAt = Date.now();
  const samples = [];
  let completed = 0;

  const worker = async (workerId) => {
    while (Date.now() - startedAt < durationMs) {
      const t0 = performance.now();
      try {
        const result = await workerFn(workerId);
        samples.push({
          ok: result.ok,
          latencyMs: performance.now() - t0,
          error: result.error,
          meta: result.meta,
        });
      } catch (err) {
        samples.push({
          ok: false,
          latencyMs: performance.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      completed++;
      if (onProgress && completed % 50 === 0) {
        onProgress(completed, Date.now() - startedAt, durationMs);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, (_, i) => worker(i + 1)));
  return { samples, durationMs: Date.now() - startedAt };
}

export function summarize(samples, durationMs) {
  const total = samples.length;
  const ok = samples.filter((s) => s.ok).length;
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((a, n) => a + n, 0);

  const pct = (p) => {
    if (!latencies.length) return 0;
    const idx = Math.ceil((p / 100) * latencies.length) - 1;
    return latencies[Math.max(0, idx)] ?? 0;
  };

  const errorsByType = {};
  for (const s of samples) {
    if (s.ok) continue;
    const key = s.error || 'unknown';
    errorsByType[key] = (errorsByType[key] ?? 0) + 1;
  }

  return {
    total,
    ok,
    failed: total - ok,
    successRate: total ? (ok / total) * 100 : 0,
    durationMs,
    rps: durationMs ? total / (durationMs / 1000) : 0,
    latencyMs: {
      min: latencies[0] ?? 0,
      max: latencies[latencies.length - 1] ?? 0,
      avg: total ? sum / total : 0,
      p50: pct(50),
      p95: pct(95),
      p99: pct(99),
    },
    errorsByType,
  };
}

export function evaluate(summary, { minSuccessRate = 99, maxP95Ms = 3000 } = {}) {
  const reasons = [];
  if (summary.successRate < minSuccessRate) {
    reasons.push(`Éxito ${summary.successRate.toFixed(2)}% < ${minSuccessRate}%`);
  }
  if (summary.latencyMs.p95 > maxP95Ms) {
    reasons.push(`p95 ${summary.latencyMs.p95.toFixed(0)} ms > ${maxP95Ms} ms`);
  }
  return { pass: reasons.length === 0, reasons };
}

export function printSummary(title, summary, verdict) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
  console.log(`Peticiones:     ${summary.total}`);
  console.log(`OK / Fallidas:  ${summary.ok} / ${summary.failed}`);
  console.log(`Tasa éxito:     ${summary.successRate.toFixed(2)}%`);
  console.log(`Duración:       ${(summary.durationMs / 1000).toFixed(1)} s`);
  console.log(`RPS promedio:   ${summary.rps.toFixed(2)}`);
  console.log(`Latencia avg:   ${summary.latencyMs.avg.toFixed(0)} ms`);
  console.log(`Latencia p50:   ${summary.latencyMs.p50.toFixed(0)} ms`);
  console.log(`Latencia p95:   ${summary.latencyMs.p95.toFixed(0)} ms`);
  console.log(`Latencia p99:   ${summary.latencyMs.p99.toFixed(0)} ms`);
  if (Object.keys(summary.errorsByType).length) {
    console.log('Errores:');
    for (const [k, v] of Object.entries(summary.errorsByType)) {
      console.log(`  - ${k}: ${v}`);
    }
  }
  console.log(verdict.pass ? '\n✅ APROBADO' : `\n❌ NO APROBADO: ${verdict.reasons.join('; ')}`);
}

export function saveReport(filename, payload) {
  const dir = resolve(process.cwd(), 'scripts/load/reports');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, filename);
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nInforme guardado: ${path}`);
  return path;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}
