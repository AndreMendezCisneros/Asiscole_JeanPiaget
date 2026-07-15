/**
 * Motor de variación de mensajes — lee message-bank.es.json (cientos de combinaciones).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spin } from './spintax.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_PATH = join(__dirname, '../data/message-bank.es.json');

let bankCache = null;

function loadBank() {
  if (bankCache) return bankCache;
  if (!existsSync(BANK_PATH)) {
    throw new Error(
      `Falta ${BANK_PATH}. Ejecute: node scripts/generar-banco-frases.mjs`,
    );
  }
  bankCache = JSON.parse(readFileSync(BANK_PATH, 'utf8'));
  return bankCache;
}

export function pick(poolName) {
  const bank = loadBank();
  const arr = bank.pools?.[poolName];
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getBankStats() {
  const bank = loadBank();
  const counts = {};
  for (const [k, v] of Object.entries(bank.pools || {})) {
    counts[k] = Array.isArray(v) ? v.length : 0;
  }
  return {
    version: bank.version,
    combinationEstimate: bank.combinationEstimate,
    warmupCount: bank.warmupCount,
    pools: counts,
  };
}

export function pickWarmupMessage() {
  const bank = loadBank();
  const arr = bank.pools?.warmupCasual || [];
  if (!arr.length) return spin('{Hola|Buenas}, ¿todo bien?');
  const base = arr[Math.floor(Math.random() * arr.length)];
  return spin(base);
}

/** Hora con segundos para variar hash sin cambiar el sentido. */
export function formatHoraWithSeconds(arrivalTime) {
  const t = String(arrivalTime || '').trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t.slice(0, 8);
  if (/^\d{2}:\d{2}$/.test(t)) {
    const sec = String(new Date().getSeconds()).padStart(2, '0');
    return `${t}:${sec}`;
  }
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatFecha(dateStr) {
  const datePart = String(dateStr || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
  }
  return datePart || '—';
}

function attendanceLink(student, record, appUrl) {
  const base = String(appUrl || '').replace(/\/$/, '');
  if (!base) return null;
  const dni = student.barcode?.trim();
  if (dni) return `${base}/llegada/dni/${encodeURIComponent(dni)}`;
  if (record?.id) return `${base}/llegada/${record.id}`;
  return null;
}

function statusText(record) {
  const st = String(record?.status || '').toLowerCase();
  if (st.includes('tarde')) return pick('statusLate') || record.status;
  if (st.includes('tiempo') || st.includes('puntual')) return pick('statusOnTime') || record.status;
  return record?.status || pick('statusOnTime') || 'Registrado';
}

/**
 * Mensaje de llegada con variación alta (miles de combinaciones posibles).
 */
export function buildVariedArrivalMessage(student, record, appUrl) {
  const fecha = formatFecha(record?.date);
  const hora = formatHoraWithSeconds(record?.arrivalTime);
  const attLink = attendanceLink(student, record, appUrl);
  const portalLink = appUrl ? `${String(appUrl).replace(/\/$/, '')}/portal-padres` : null;

  const lines = [
    pick('greetings'),
    '',
    `🏫 *${pick('headers')}*`,
    '',
    `${pick('studentLabels')} ${student.fullName}`,
  ];

  if (student.level) lines.push(`${pick('levelLabels')} ${student.level}`);
  if (student.grade) lines.push(`${pick('gradeLabels')} ${student.grade}`);
  if (student.section) lines.push(`${pick('sectionLabels')} ${student.section}`);

  lines.push(
    `${pick('dateLabels')} ${fecha}`,
    `${pick('timeLabels')} ${hora}`,
    `${pick('statusLabels')} ${statusText(record)}`,
    '',
  );

  if (Math.random() < 0.35) {
    lines.push(pick('midLines'), '');
  }

  if (attLink) lines.push(`${pick('attendanceCTA')}\n${attLink}`);
  if (portalLink) lines.push(`${pick('portalCTA')}\n${portalLink}`);

  lines.push('', pick('closings'));

  return lines
    .filter((l) => l !== null && l !== undefined && l !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
