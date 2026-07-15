import type { ArrivalRecord, Student } from '@/types';
import { toWhatsAppChatId, toWhatsAppPhone } from '@/lib/utils/phoneUtils';

/** WPPConnect Server — sesiones persistentes en VPS */
const WPPCONNECT_ENABLED = import.meta.env.VITE_WPPCONNECT_ENABLED === 'true';

const WPPCONNECT_API_URL = (
  import.meta.env.VITE_WPPCONNECT_API_URL || '/wpp-api'
).replace(/\/$/, '');

const WPPCONNECT_SESSION = import.meta.env.VITE_WPPCONNECT_SESSION || 'sie-chip-01';
const WPPCONNECT_TOKEN = import.meta.env.VITE_WPPCONNECT_TOKEN || '';
const WPPCONNECT_ROTATION = import.meta.env.VITE_WPPCONNECT_ROTATION === 'true';
const WPPCONNECT_NOTIFY_URL = (
  import.meta.env.VITE_WPPCONNECT_NOTIFY_URL || '/wpp-notify'
).replace(/\/$/, '');
const WPPCONNECT_NOTIFY_KEY = import.meta.env.VITE_WPPCONNECT_NOTIFY_KEY || '';

const GREETING_VARIANTS = [
  'Hola,',
  'Buen día,',
  'Buenos días,',
  'Estimado apoderado,',
  'Estimada familia,',
  'Saludos,',
  'Cordial saludo,',
] as const;

const CLOSING_VARIANTS = [
  '_Notificación automática del sistema de asistencia escolar._',
  '_Mensaje automático del SIE — Colegio Jean Piaget._',
  '_Sistema de asistencia escolar — Colegio Jean Piaget._',
] as const;

/** OpenWA — legacy */
const OPENWA_ENABLED =
  !WPPCONNECT_ENABLED &&
  (import.meta.env.VITE_OPENWA_ENABLED === 'true' ||
    import.meta.env.VITE_WHATSAPP_ENABLED === 'true' ||
    import.meta.env.VITE_WAHA_ENABLED === 'true');

const WHATSAPP_ENABLED = WPPCONNECT_ENABLED || OPENWA_ENABLED;

const OPENWA_API_URL = (
  import.meta.env.VITE_OPENWA_API_URL ||
  import.meta.env.VITE_OPENWA_BASE_URL ||
  '/sc-proxy'
).replace(/\/$/, '');

const OPENWA_SESSION_ID = import.meta.env.VITE_OPENWA_SESSION_ID || '';
const OPENWA_API_KEY = import.meta.env.VITE_OPENWA_API_KEY || '';

/** Evita reenvíos duplicados del mismo aviso en escaneos repetidos. */
const recentNotifyKeys = new Map<string, number>();
const NOTIFY_DEDUP_MS = 2 * 60 * 1000;

/** Simular escritura humana (~10 s) antes de enviar (anti-baneo). */
const WPPCONNECT_TYPING_MIN_MS = 10_000;
const WPPCONNECT_TYPING_MAX_MS = 12_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldSkipDuplicateNotify(studentId: number, date: string): boolean {
  const key = `${studentId}:${date.slice(0, 10)}`;
  const last = recentNotifyKeys.get(key);
  const now = Date.now();
  if (last != null && now - last < NOTIFY_DEDUP_MS) return true;
  recentNotifyKeys.set(key, now);
  return false;
}

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') || '';

function getAppBaseUrl(): string {
  return APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

function getParentPortalLink(): string {
  const base = getAppBaseUrl();
  return base ? `${base}/portal-padres` : '/portal-padres';
}

function getStudentAttendanceLink(student: Student, record: ArrivalRecord): string | null {
  const base = getAppBaseUrl();
  if (!base) return null;
  const dni = student.barcode?.trim();
  if (dni) return `${base}/llegada/dni/${encodeURIComponent(dni)}`;
  if (record.id) return `${base}/llegada/${record.id}`;
  return null;
}

function formatStudentAcademicLines(student: Student): string[] {
  const lines: string[] = [];
  if (student.level) lines.push(`*Nivel:* ${student.level}`);
  if (student.grade) lines.push(`*Grado:* ${student.grade}`);
  if (student.section) lines.push(`*Sección:* ${student.section}`);
  return lines;
}

function formatHoraWithSeconds(arrivalTime: string | undefined): string {
  const t = (arrivalTime || '').trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t.slice(0, 8);
  if (/^\d{2}:\d{2}$/.test(t)) {
    const sec = String(new Date().getSeconds()).padStart(2, '0');
    return `${t}:${sec}`;
  }
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function buildArrivalMessage(student: Student, record: ArrivalRecord): string {
  const datePart = record.date?.slice(0, 10) || '';
  let fecha = datePart;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-');
    fecha = `${d}/${m}/${y}`;
  }
  const hora = formatHoraWithSeconds(record.arrivalTime);
  const greeting = GREETING_VARIANTS[randomBetween(0, GREETING_VARIANTS.length - 1)];
  const closing = CLOSING_VARIANTS[randomBetween(0, CLOSING_VARIANTS.length - 1)];
  const attendanceLink = getStudentAttendanceLink(student, record);
  const portalLink = getParentPortalLink();

  return [
    greeting,
    '',
    '🏫 *Registro de llegada — Colegio Jean Piaget*',
    '',
    `*Estudiante:* ${student.fullName}`,
    ...formatStudentAcademicLines(student),
    `*Fecha:* ${fecha}`,
    `*Hora:* ${hora}`,
    `*Estado:* ${record.status || 'Registrado'}`,
    '',
    attendanceLink ? `📋 *Ver asistencia de hoy:*\n${attendanceLink}` : '',
    portalLink ? `👨‍👩‍👧 *Portal de padres:*\n${portalLink}` : '',
    '',
    closing,
  ]
    .filter((l) => l !== null && l !== undefined && l !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeHtmlResponse(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<title>sie asiscole');
}

function friendlyWaError(detail: string, status?: number, provider = 'WhatsApp'): string {
  const lower = detail.toLowerCase();
  if (looksLikeHtmlResponse(detail)) {
    return `${provider} no responde en la ruta configurada. Revise el proxy en Caddy (/wpp-api o /api).`;
  }
  if (status === 401 || status === 403 || lower.includes('unauthorized')) {
    return `Token de ${provider} inválido. Regenere el token en el VPS.`;
  }
  if (
    lower.includes('session not found') ||
    lower.includes('disconnected') ||
    lower.includes('not connected') ||
    lower.includes('not logged in')
  ) {
    return 'WhatsApp desconectado. Escanee el QR de nuevo (scripts/wppconnect-mostrar-qr.sh en el VPS).';
  }
  if (lower.includes('failed to fetch') || status === 502 || status === 503) {
    return `${provider} no está activo en el servidor.`;
  }
  if (detail.length > 220) return `Error de ${provider} al enviar el mensaje`;
  return detail || `Error de ${provider} al enviar el mensaje`;
}

function wppconnectHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${WPPCONNECT_TOKEN}`,
  };
}

async function wppconnectPost(
  route: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  const url = `${WPPCONNECT_API_URL}/${encodeURIComponent(WPPCONNECT_SESSION)}${route}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: wppconnectHeaders(),
      body: JSON.stringify(body),
    });
    const raw = await response.text().catch(() => response.statusText);
    if (!response.ok) {
      return { ok: false, error: friendlyWaError(raw, response.status, 'WPPConnect') };
    }
    if (looksLikeHtmlResponse(raw)) {
      return { ok: false, error: friendlyWaError(raw, response.status, 'WPPConnect') };
    }
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo conectar con WPPConnect';
    return { ok: false, error: friendlyWaError(message, undefined, 'WPPConnect') };
  }
}

async function sendViaNotifyQueue(
  phone: string,
  student: Student,
  record: ArrivalRecord,
): Promise<{ ok: boolean; error: string | null; session?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (WPPCONNECT_NOTIFY_KEY) headers['X-SIE-Notify-Key'] = WPPCONNECT_NOTIFY_KEY;

    const response = await fetch(`${WPPCONNECT_NOTIFY_URL}/enqueue`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        student: {
          id: student.id,
          fullName: student.fullName,
          level: student.level,
          grade: student.grade,
          section: student.section,
          barcode: student.barcode,
        },
        record: {
          date: record.date,
          arrivalTime: record.arrivalTime,
          status: record.status,
          id: record.id,
        },
        appUrl: getAppBaseUrl(),
      }),
    });

    const raw = await response.text().catch(() => response.statusText);
    if (response.status === 503) {
      return { ok: false, error: 'Ningún chip WhatsApp disponible. Revise conexión en el VPS.' };
    }
    if (!response.ok && response.status !== 202) {
      return { ok: false, error: friendlyWaError(raw, response.status, 'Cola WhatsApp') };
    }
    if (looksLikeHtmlResponse(raw)) {
      return { ok: false, error: friendlyWaError(raw, response.status, 'Cola WhatsApp') };
    }

    let session: string | undefined;
    try {
      const json = JSON.parse(raw) as { session?: string };
      session = json.session;
    } catch {
      /* ignore */
    }

    return { ok: true, error: null, session };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo encolar el mensaje';
    return { ok: false, error: friendlyWaError(message, undefined, 'Cola WhatsApp') };
  }
}

async function sendViaWppConnect(phone: string, text: string): Promise<{ ok: boolean; error: string | null }> {
  if (!WPPCONNECT_TOKEN.trim()) {
    return { ok: false, error: 'Falta VITE_WPPCONNECT_TOKEN (genérelo en el VPS)' };
  }

  // Simular escritura humana antes del mensaje (~10 s)
  await wppconnectPost('/typing', { phone, isGroup: false, value: true });
  await sleep(randomBetween(WPPCONNECT_TYPING_MIN_MS, WPPCONNECT_TYPING_MAX_MS));

  const sent = await wppconnectPost('/send-message', { phone, message: text, isGroup: false });

  await wppconnectPost('/typing', { phone, isGroup: false, value: false }).catch(() => {});

  return sent;
}

function openwaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (OPENWA_API_KEY) headers['X-API-Key'] = OPENWA_API_KEY;
  return headers;
}

async function sendViaOpenwa(chatId: string, text: string): Promise<{ ok: boolean; error: string | null }> {
  if (!OPENWA_SESSION_ID.trim()) {
    return { ok: false, error: 'Falta VITE_OPENWA_SESSION_ID' };
  }
  if (!OPENWA_API_KEY.trim()) {
    return { ok: false, error: 'Falta VITE_OPENWA_API_KEY' };
  }

  try {
    const url = `${OPENWA_API_URL}/sessions/${encodeURIComponent(OPENWA_SESSION_ID)}/messages/send-text`;
    const response = await fetch(url, {
      method: 'POST',
      headers: openwaHeaders(),
      body: JSON.stringify({ chatId, text }),
    });
    const raw = await response.text().catch(() => response.statusText);
    if (!response.ok) {
      return { ok: false, error: friendlyWaError(raw, response.status, 'OpenWA') };
    }
    if (looksLikeHtmlResponse(raw)) {
      return { ok: false, error: friendlyWaError(raw, response.status, 'OpenWA') };
    }
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo conectar con OpenWA';
    return { ok: false, error: friendlyWaError(message, undefined, 'OpenWA') };
  }
}

/**
 * Envía WhatsApp al apoderado tras registrar llegada.
 * No lanza excepción: el escaneo no debe fallar si el proveedor no responde.
 */
export async function notifyParentArrival(
  student: Student,
  record: ArrivalRecord,
): Promise<{ ok: boolean; error: string | null; chatId?: string; skipped?: boolean }> {
  if (!WHATSAPP_ENABLED) {
    return { ok: false, error: 'WhatsApp desactivado' };
  }

  const phone = student.contactPhone?.trim() || student.emergencyPhone?.trim() || '';
  if (!phone) {
    return { ok: false, error: 'El estudiante no tiene teléfono de contacto' };
  }

  if (shouldSkipDuplicateNotify(student.id, record.date || '')) {
    return {
      ok: true,
      error: null,
      skipped: true,
      chatId: toWhatsAppChatId(phone) || undefined,
    };
  }

  const chatId = toWhatsAppChatId(phone);
  const wppPhone = toWhatsAppPhone(phone);
  if (!chatId || !wppPhone) {
    return { ok: false, error: 'Teléfono de contacto no válido para WhatsApp' };
  }

  const result =
    WPPCONNECT_ENABLED && WPPCONNECT_ROTATION
      ? await sendViaNotifyQueue(wppPhone, student, record)
      : WPPCONNECT_ENABLED
        ? await sendViaWppConnect(wppPhone, buildArrivalMessage(student, record))
        : await sendViaOpenwa(chatId, buildArrivalMessage(student, record));

  return { ...result, chatId };
}

export const whatsappService = {
  isEnabled: () => WHATSAPP_ENABLED,
  provider: () =>
    WPPCONNECT_ENABLED && WPPCONNECT_ROTATION
      ? 'wppconnect-queue'
      : WPPCONNECT_ENABLED
        ? 'wppconnect'
        : OPENWA_ENABLED
          ? 'openwa'
          : 'none',
  notifyParentArrival,
};
