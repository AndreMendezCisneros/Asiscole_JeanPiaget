#!/usr/bin/env node
/**
 * Calentamiento chip ↔ chip: mensajes variados + indicador "escribiendo" ≥10 s.
 * Uso manual o vía systemd timer (sie-wpp-warmup.timer).
 */
import { createWppClient, loadEnvFileSync } from './lib/wppClient.mjs';
import { maxSendsForSession, parseChipLimits, parseSessionList } from './lib/chipLimits.mjs';
import { pickWarmupMessage, getBankStats } from './lib/messageVariety.mjs';

const ENV_FILE = process.env.WPPCONNECT_ENV_FILE || '/opt/sie/.env.wppconnect';
loadEnvFileSync(ENV_FILE);

const SESSIONS = parseSessionList(
  process.env.WPPCONNECT_WARMUP_CHIPS || process.env.WPPCONNECT_SESSIONS,
  'sie-chip-01,sie-chip-02,sie-chip-03,sie-chip-05,sie-chip-06,sie-chip-07,sie-chip-04',
);
const WARMUP_SEND_LIMITS = parseChipLimits(
  process.env.WPPCONNECT_WARMUP_SEND_LIMITS || process.env.WPPCONNECT_CHIP_HOURLY_LIMITS || 'sie-chip-04=2',
);
const WARMUP_DEFAULT_SEND_CAP = Number(process.env.WPPCONNECT_WARMUP_MAX_SENDS_PER_CHIP || 999);
const WARMUP_EXCLUDE_SENDERS = parseSessionList(
  process.env.WPPCONNECT_WARMUP_EXCLUDE_SENDERS,
  '',
);

const ROUNDS = Number(process.env.WPPCONNECT_WARMUP_ROUNDS || 3);
const PAUSE_MIN = Number(process.env.WPPCONNECT_WARMUP_PAUSE_MIN_MS || 15_000);
const PAUSE_MAX = Number(process.env.WPPCONNECT_WARMUP_PAUSE_MAX_MS || 35_000);
const TYPING_MIN = Number(process.env.WPPCONNECT_TYPING_MIN_MS || 10_000);
const TYPING_MAX = Number(process.env.WPPCONNECT_TYPING_MAX_MS || 12_000);

const wpp = createWppClient({ typingMinMs: TYPING_MIN, typingMaxMs: TYPING_MAX });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

async function resolveActiveChips() {
  const active = [];
  for (const session of SESSIONS) {
    const connected = await wpp.isConnected(session);
    if (!connected) {
      log(`SKIP ${session} — no conectado`);
      continue;
    }
    try {
      const phone = await wpp.getPhoneNumber(session);
      if (!phone) {
        log(`SKIP ${session} — sin número`);
        continue;
      }
      active.push({ session, phone });
      log(`${session} → ${phone}`);
    } catch (err) {
      log(`SKIP ${session} — ${err.message}`);
    }
  }
  return active;
}

async function main() {
  log('=== Inicio calentamiento diario ===');
  log(
    `Config: ${ROUNDS} ronda(s), typing ${TYPING_MIN / 1000}-${TYPING_MAX / 1000}s, pausa ${PAUSE_MIN / 1000}-${PAUSE_MAX / 1000}s`,
  );

  const stats = getBankStats();
  log(`Banco: ${stats.warmupCount} frases casuales`);

  const chips = await resolveActiveChips();
  if (chips.length < 2) {
    log(`ABORT — se necesitan ≥2 chips conectados (activos: ${chips.length})`);
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;
  const sendsByChip = new Map();

  function warmupSendCap(session) {
    return maxSendsForSession(session, WARMUP_SEND_LIMITS, WARMUP_DEFAULT_SEND_CAP);
  }

  function canWarmupSend(session) {
    if (WARMUP_EXCLUDE_SENDERS.includes(session)) return false;
    const cap = warmupSendCap(session);
    return (sendsByChip.get(session) || 0) < cap;
  }

  function recordWarmupSend(session) {
    sendsByChip.set(session, (sendsByChip.get(session) || 0) + 1);
  }

  /** Si el chip asignado llegó al tope (ej. chip-04 = 2), usa otro chip con cupo. */
  function pickWarmupSender(preferredSession, chipList) {
    if (canWarmupSend(preferredSession)) return preferredSession;

    const candidates = chipList
      .map((chip) => chip.session)
      .filter((session) => session !== preferredSession && canWarmupSend(session))
      .sort((a, b) => {
        const remA = warmupSendCap(a) - (sendsByChip.get(a) || 0);
        const remB = warmupSendCap(b) - (sendsByChip.get(b) || 0);
        return remB - remA || a.localeCompare(b, 'es');
      });

    return candidates[0] || null;
  }

  async function sendWarmupStep(preferredFrom, toPhone, toSession) {
    const sender = pickWarmupSender(preferredFrom, chips);
    if (!sender) {
      log(
        `SKIP paso ${preferredFrom} → ${toSession} — ningún chip con cupo de envío`,
      );
      return false;
    }

    if (sender !== preferredFrom) {
      log(
        `REDIR ${preferredFrom} → ${sender} (tope ${sendsByChip.get(preferredFrom) || 0}/${warmupSendCap(preferredFrom)})`,
      );
    }

    const message = pickWarmupMessage();
    const typingMs = wpp.typingDelayMs();

    try {
      log(`${sender} → ${toPhone} (escribiendo ${(typingMs / 1000).toFixed(1)}s)`);
      await wpp.sendMessage(sender, toPhone, message, { typingMs });
      recordWarmupSend(sender);
      log(`  OK: ${message.slice(0, 72)}${message.length > 72 ? '…' : ''}`);
      sent++;
      return true;
    } catch (err) {
      log(`  ERROR: ${err.message}`);
      failed++;
      return false;
    }
  }

  for (let round = 1; round <= ROUNDS; round++) {
    log(`--- Ronda ${round}/${ROUNDS} ---`);
    for (let i = 0; i < chips.length; i++) {
      const from = chips[i];
      const to = chips[(i + 1) % chips.length];

      await sendWarmupStep(from.session, to.phone, to.session);

      if (round < ROUNDS || i < chips.length - 1) {
        const pause = randomBetween(PAUSE_MIN, PAUSE_MAX);
        log(`  Pausa ${(pause / 1000).toFixed(0)}s`);
        await sleep(pause);
      }
    }
  }

  const sendSummary = [...sendsByChip.entries()]
    .map(([session, count]) => `${session}=${count}`)
    .join(', ');
  log(`=== Fin: ${sent} enviados, ${failed} fallos, ${chips.length} chips activos ===`);
  if (sendSummary) log(`Envíos por chip: ${sendSummary}`);
  process.exit(failed > 0 && sent === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`[warmup] FATAL: ${err.message}`);
  process.exit(1);
});
