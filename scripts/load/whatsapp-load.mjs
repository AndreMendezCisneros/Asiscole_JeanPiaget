#!/usr/bin/env node
/**
 * Prueba de carga: envío WhatsApp vía OpenWA (notificaciones de llegada).
 *
 * ⚠️  WhatsApp puede bloquear la cuenta si se envían demasiados mensajes seguidos.
 * Por defecto usa intervalo conservador (3 s ≈ 20 msg/min).
 *
 * Uso:
 *   node scripts/load/whatsapp-load.mjs --dry-run
 *   node scripts/load/whatsapp-load.mjs --max 100 --interval-ms 3000
 */
import {
  loadEnvLocal,
  fetchActiveStudentBarcodes,
  runConstantRate,
  summarize,
  printSummary,
  saveReport,
  parseArgs,
  sleep,
} from './lib/loadTestLib.mjs';

loadEnvLocal();
const args = parseArgs(process.argv);

const INTERVAL_MS = Number(args['interval-ms'] ?? process.env.LOAD_WA_INTERVAL_MS ?? 3000);
const MAX_MESSAGES = Number(args.max ?? process.env.LOAD_WA_MAX ?? 50);
const DRY_RUN = Boolean(args['dry-run'] ?? !process.env.VITE_OPENWA_ENABLED);

const OPENWA_API_URL = (
  process.env.VITE_OPENWA_API_URL ||
  process.env.LOAD_OPENWA_API_URL ||
  'http://localhost:2785/api'
).replace(/\/$/, '');

const SESSION_ID = process.env.VITE_OPENWA_SESSION_ID || process.env.LOAD_OPENWA_SESSION_ID || '';
const API_KEY = process.env.VITE_OPENWA_API_KEY || process.env.LOAD_OPENWA_API_KEY || '';

function toWhatsAppChatId(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}@c.us`;
  if (digits.length === 11 && digits.startsWith('51')) return `${digits}@c.us`;
  if (digits.length >= 10) return `${digits}@c.us`;
  return null;
}

async function sendText(chatId, text) {
  const url = `${OPENWA_API_URL}/sessions/${encodeURIComponent(SESSION_ID)}/messages/send-text`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    },
    body: JSON.stringify({ chatId, text }),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText);
    return { ok: false, error: `${res.status}: ${raw.slice(0, 120)}` };
  }
  return { ok: true };
}

async function main() {
  console.log('=== Carga: WhatsApp (OpenWA) ===');
  console.log(`Máximo mensajes: ${MAX_MESSAGES} | Intervalo: ${INTERVAL_MS} ms`);
  if (DRY_RUN) {
    console.log('Modo DRY-RUN: no se envían mensajes reales.');
  } else if (!SESSION_ID || !API_KEY) {
    console.error('Configure VITE_OPENWA_SESSION_ID y VITE_OPENWA_API_KEY');
    process.exit(1);
  }

  const students = await fetchActiveStudentBarcodes(2000);
  const withPhone = students
    .map((s) => ({ ...s, chatId: toWhatsAppChatId(s.phone) }))
    .filter((s) => s.chatId);

  console.log(`Estudiantes con teléfono válido: ${withPhone.length}`);
  if (!withPhone.length) {
    console.error('No hay teléfonos en la nómina para probar WhatsApp.');
    process.exit(1);
  }

  const target = Math.min(MAX_MESSAGES, withPhone.length);
  const durationMs = target * INTERVAL_MS;

  const { samples, durationMs: elapsed } = await runConstantRate({
    totalRequests: target,
    durationMs,
    onProgress: (done, total) => {
      process.stdout.write(`\rWhatsApp: ${done}/${total}`);
    },
    fn: async (i) => {
      const st = withPhone[i % withPhone.length];
      const text = `[PRUEBA CARGA SIE] Notificación simulada para ${st.barcode}. No es un mensaje real de asistencia.`;
      if (DRY_RUN) {
        await sleep(10);
        return { ok: true };
      }
      return sendText(st.chatId, text);
    },
  });

  process.stdout.write('\n');
  const summary = summarize(samples, elapsed);
  const pass = summary.successRate >= 95;
  printSummary('WhatsApp OpenWA — send-text', summary, {
    pass,
    reasons: pass ? [] : ['Tasa de envío < 95% — posible rate limit de WhatsApp'],
  });

  console.log('\nNotas WhatsApp:');
  console.log('- Cuenta personal: ~20-40 msg/min suele ser seguro; más puede generar bloqueo.');
  console.log('- Para toda la nómina (~500+) use cola con retraso o WhatsApp Business API.');
  console.log('- Ejecute primero con --dry-run y luego con --max 20 en horario de prueba.');

  saveReport(`whatsapp-${Date.now()}.json`, {
    scenario: 'whatsapp',
    dryRun: DRY_RUN,
    max: target,
    intervalMs: INTERVAL_MS,
    summary,
    pass,
  });

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
