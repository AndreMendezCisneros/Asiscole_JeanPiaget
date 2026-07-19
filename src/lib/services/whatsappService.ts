import type { ArrivalRecord, FaultType, Incident, Student } from '@/types';
import { toWhatsAppChatId, toWhatsAppPhone } from '@/lib/utils/phoneUtils';

/** Meta Cloud API — proxy en VPS (/meta-wa), token solo en servidor */
const META_WA_ENABLED = import.meta.env.VITE_META_WA_ENABLED === 'true';
const META_WA_API_URL = (import.meta.env.VITE_META_WA_API_URL || '/meta-wa').replace(/\/$/, '');
const META_WA_NOTIFY_KEY = import.meta.env.VITE_META_WA_NOTIFY_KEY || '';

/** WPPConnect Server — sesiones persistentes en VPS */
const WPPCONNECT_ENABLED =
  !META_WA_ENABLED && import.meta.env.VITE_WPPCONNECT_ENABLED === 'true';

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

/** Nombre del colegio en textos WhatsApp (JP: Colegio Jean Piaget). */
const SCHOOL_NAME =
  (import.meta.env.VITE_SCHOOL_NAME as string | undefined)?.trim() || 'I.E. San Ramón';

const GREETING_VARIANTS = [
  'Hola,',
  'Buen día,',
  'Buenos días,',
  'Estimado apoderado,',
  'Estimada familia,',
  'Saludos,',
  'Cordial saludo,',
] as const;

function closingVariants(): readonly string[] {
  return [
    '_Notificación automática del sistema de asistencia escolar._',
    `_Mensaje automático del SIE — ${SCHOOL_NAME}._`,
    `_Sistema de asistencia escolar — ${SCHOOL_NAME}._`,
  ];
}

/** OpenWA — legacy */
const OPENWA_ENABLED =
  !META_WA_ENABLED &&
  !WPPCONNECT_ENABLED &&
  (import.meta.env.VITE_OPENWA_ENABLED === 'true' ||
    import.meta.env.VITE_WHATSAPP_ENABLED === 'true' ||
    import.meta.env.VITE_WAHA_ENABLED === 'true');

const WHATSAPP_ENABLED = META_WA_ENABLED || WPPCONNECT_ENABLED || OPENWA_ENABLED;

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

function shouldSkipDuplicateNotify(
  studentId: number,
  date: string,
  kind: 'arrival' | 'departure' | 'incident' = 'arrival',
  incidentId?: number,
): boolean {
  const key =
    kind === 'incident' && incidentId != null
      ? `incident:${studentId}:${incidentId}`
      : `${kind}:${studentId}:${date.slice(0, 10)}`;
  const last = recentNotifyKeys.get(key);
  const now = Date.now();
  if (last != null && now - last < NOTIFY_DEDUP_MS) return true;
  recentNotifyKeys.set(key, now);
  return false;
}

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') || '';

/** Pausa corta entre el mensaje del número y el personalizado. */
const BETWEEN_MESSAGES_MS = 1_500;

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

function formatApoderadoPhoneDisplay(phone: string): string {
  const digits = toWhatsAppPhone(phone);
  if (!digits) return phone.trim();
  if (digits.startsWith('51') && digits.length === 11) {
    const local = digits.slice(2);
    return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return `+${digits}`;
}

/** Primer mensaje: el número del apoderado (para que te llegue a tu WhatsApp). */
function buildApoderadoPhoneMessage(apoderadoPhone: string, student: Student): string {
  return [
    '*Teléfono del apoderado*',
    formatApoderadoPhoneDisplay(apoderadoPhone),
    '',
    `Estudiante: ${student.fullName}`,
  ].join('\n');
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
  const closings = closingVariants();
  const closing = closings[randomBetween(0, closings.length - 1)];
  const attendanceLink = getStudentAttendanceLink(student, record);
  const portalLink = getParentPortalLink();

  return [
    greeting,
    '',
    `🏫 *Registro de llegada — ${SCHOOL_NAME}*`,
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

function buildNotifyMessages(student: Student, record: ArrivalRecord, apoderadoPhone: string): string[] {
  return [buildApoderadoPhoneMessage(apoderadoPhone, student), buildArrivalMessage(student, record)];
}

function buildDepartureMessage(student: Student, record: ArrivalRecord): string {
  const datePart = record.date?.slice(0, 10) || '';
  let fecha = datePart;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [y, m, d] = datePart.split('-');
    fecha = `${d}/${m}/${y}`;
  }
  const hora = formatHoraWithSeconds(record.departureTime || undefined);
  const greeting = GREETING_VARIANTS[randomBetween(0, GREETING_VARIANTS.length - 1)];
  const closings = closingVariants();
  const closing = closings[randomBetween(0, closings.length - 1)];
  const attendanceLink = getStudentAttendanceLink(student, record);
  const portalLink = getParentPortalLink();
  const tipo = record.departureType || 'Normal';

  return [
    greeting,
    '',
    `🚪 *Registro de salida — ${SCHOOL_NAME}*`,
    '',
    `*Estudiante:* ${student.fullName}`,
    ...formatStudentAcademicLines(student),
    `*Fecha:* ${fecha}`,
    `*Hora de salida:* ${hora}`,
    `*Tipo:* ${tipo}`,
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

function buildDepartureNotifyMessages(
  student: Student,
  record: ArrivalRecord,
  apoderadoPhone: string,
): string[] {
  return [buildApoderadoPhoneMessage(apoderadoPhone, student), buildDepartureMessage(student, record)];
}

/** Respaldo si la falta no tiene recomendacion ni descripcion. */
function fallbackFaultRecommendation(fault: FaultType): string {
  const grave = fault.severity === 'Grave';
  const category = fault.category as string;
  const byCategory: Record<string, { leve: string; grave: string }> = {
    Conducta: {
      leve: 'Conversar en casa sobre el respeto a las normas escolares y acompañar una reflexión breve.',
      grave:
        'Agendar reunión con tutoría o dirección para acordar compromisos de conducta y seguimiento.',
    },
    'Convivencia Escolar': {
      leve: 'Conversar en casa sobre el respeto hacia docentes y compañeros y reforzar acuerdos de convivencia.',
      grave: 'Agendar reunión con tutoría o dirección para compromisos de convivencia y seguimiento.',
    },
    Uniforme: {
      leve: 'Revisar juntos el reglamento de presentación personal y asegurar el uniforme completo al día siguiente.',
      grave: 'Corregir de inmediato la presentación y coordinar con el colegio si hace falta reposición del uniforme.',
    },
    Académica: {
      leve: 'Apoyar en casa la organización de tareas y revisar avances con el docente de la materia.',
      grave: 'Solicitar entrevista con el área académica para plan de refuerzo y compromisos de estudio.',
    },
    Puntualidad: {
      leve: 'Ajustar horarios de salida de casa para llegar con anticipación al colegio.',
      grave: 'Establecer rutina diaria de puntualidad y comunicar a tutoría cualquier dificultad de traslado.',
    },
    Asistencia: {
      leve: 'Ajustar horarios de salida de casa para llegar con anticipación al colegio.',
      grave: 'Establecer rutina diaria de puntualidad y comunicar a tutoría cualquier dificultad de traslado.',
    },
  };
  const pack = byCategory[category] || byCategory.Conducta;
  return grave ? pack.grave : pack.leve;
}

function resolveFaultRecommendation(fault: FaultType): string {
  const fromCatalog = fault.recommendation?.trim() || fault.description?.trim();
  if (fromCatalog) return fromCatalog;
  return fallbackFaultRecommendation(fault);
}

function formatIncidentDateTime(iso: string | undefined): { fecha: string; hora: string } {
  const raw = (iso || '').trim();
  const d = raw ? new Date(raw) : new Date();
  if (Number.isNaN(d.getTime())) {
    return { fecha: raw.slice(0, 10) || '—', hora: '—' };
  }
  const fecha = d.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return { fecha, hora };
}

function buildIncidentMessage(student: Student, incident: Incident, fault: FaultType): string {
  const greeting = GREETING_VARIANTS[randomBetween(0, GREETING_VARIANTS.length - 1)];
  const closings = closingVariants();
  const closing = closings[randomBetween(0, closings.length - 1)];
  const { fecha, hora } = formatIncidentDateTime(incident.registeredAt);
  const portalLink = getParentPortalLink();
  const recommendation = resolveFaultRecommendation(fault);
  const obs = incident.observations?.trim();

  return [
    greeting,
    '',
    `⚠️ *Registro de incidencia — ${SCHOOL_NAME}*`,
    '',
    `*Estudiante:* ${student.fullName}`,
    ...formatStudentAcademicLines(student),
    `*Fecha:* ${fecha}`,
    `*Hora:* ${hora}`,
    `*Falta:* ${fault.name}`,
    `*Categoría:* ${fault.category}`,
    `*Gravedad:* ${fault.severity}`,
    `*Nivel de reincidencia:* ${incident.reincidenceLevel ?? 0}`,
    obs ? `*Observaciones:* ${obs}` : '',
    '',
    `*Recomendación:*\n${recommendation}`,
    '',
    portalLink ? `👨‍👩‍👧 *Portal de padres:*\n${portalLink}` : '',
    '',
    closing,
  ]
    .filter((l) => l !== null && l !== undefined && l !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildIncidentNotifyMessages(
  student: Student,
  incident: Incident,
  fault: FaultType,
  apoderadoPhone: string,
): string[] {
  return [
    buildApoderadoPhoneMessage(apoderadoPhone, student),
    buildIncidentMessage(student, incident, fault),
  ];
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

async function sendViaMetaWa(
  phone: string,
  student: Student,
  record: ArrivalRecord,
  text: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (META_WA_NOTIFY_KEY) headers['X-SIE-Notify-Key'] = META_WA_NOTIFY_KEY;

    const response = await fetch(`${META_WA_API_URL}/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        text,
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
      }),
    });

    const raw = await response.text().catch(() => response.statusText);
    if (!response.ok) {
      let detail = raw;
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        if (parsed.error) detail = parsed.error;
      } catch {
        /* ignore */
      }
      return { ok: false, error: friendlyWaError(detail, response.status, 'Meta WhatsApp') };
    }
    return { ok: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo conectar con Meta WhatsApp';
    return { ok: false, error: friendlyWaError(message, undefined, 'Meta WhatsApp') };
  }
}

async function sendViaNotifyQueue(
  phone: string,
  student: Student,
  record: Partial<ArrivalRecord> | null,
  messages: string[],
  kind: 'arrival' | 'departure' | 'incident' = 'arrival',
): Promise<{ ok: boolean; error: string | null; session?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (WPPCONNECT_NOTIFY_KEY) headers['X-SIE-Notify-Key'] = WPPCONNECT_NOTIFY_KEY;

    const response = await fetch(`${WPPCONNECT_NOTIFY_URL}/enqueue`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        messages,
        kind,
        student: {
          id: student.id,
          fullName: student.fullName,
          level: student.level,
          grade: student.grade,
          section: student.section,
          barcode: student.barcode,
        },
        record: {
          date: record?.date,
          arrivalTime: record?.arrivalTime,
          departureTime: record?.departureTime,
          departureType: record?.departureType,
          status: record?.status,
          id: record?.id,
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

async function sendTextsViaWppConnect(
  phone: string,
  texts: string[],
): Promise<{ ok: boolean; error: string | null }> {
  for (let i = 0; i < texts.length; i++) {
    const sent = await sendViaWppConnect(phone, texts[i]);
    if (!sent.ok) return sent;
    if (i < texts.length - 1) await sleep(BETWEEN_MESSAGES_MS);
  }
  return { ok: true, error: null };
}

async function sendTextsViaOpenwa(
  chatId: string,
  texts: string[],
): Promise<{ ok: boolean; error: string | null }> {
  for (let i = 0; i < texts.length; i++) {
    const sent = await sendViaOpenwa(chatId, texts[i]);
    if (!sent.ok) return sent;
    if (i < texts.length - 1) await sleep(BETWEEN_MESSAGES_MS);
  }
  return { ok: true, error: null };
}

async function sendTextsViaMetaWa(
  phone: string,
  student: Student,
  record: ArrivalRecord,
  texts: string[],
): Promise<{ ok: boolean; error: string | null }> {
  for (let i = 0; i < texts.length; i++) {
    const sent = await sendViaMetaWa(phone, student, record, texts[i]);
    if (!sent.ok) return sent;
    if (i < texts.length - 1) await sleep(BETWEEN_MESSAGES_MS);
  }
  return { ok: true, error: null };
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
 * Tras registrar llegada: el chip se autoenvía (a su propio WhatsApp)
 * 1) el número del apoderado (BD),
 * 2) el mensaje personalizado de llegada.
 * Con cola WPPConnect, el mapa de 6 números/chip elige qué sesión; el destino es el SIM del chip.
 * No lanza excepción: el escaneo no debe fallar si el proveedor no responde.
 */
export async function notifyParentArrival(
  student: Student,
  record: ArrivalRecord,
): Promise<{ ok: boolean; error: string | null; chatId?: string; skipped?: boolean }> {
  return notifyParentEvent(student, record, 'arrival');
}

/**
 * Tras registrar salida: mismo flujo que llegada (autoenvío del chip).
 * 1) número del apoderado, 2) mensaje personalizado de salida.
 */
export async function notifyParentDeparture(
  student: Student,
  record: ArrivalRecord,
): Promise<{ ok: boolean; error: string | null; chatId?: string; skipped?: boolean }> {
  return notifyParentEvent(student, record, 'departure');
}

/**
 * Tras registrar incidencia: el chip se autoenvía
 * 1) número del apoderado, 2) mensaje personalizado con falta + recomendación.
 */
export async function notifyParentIncident(
  student: Student,
  incident: Incident,
  fault: FaultType,
): Promise<{ ok: boolean; error: string | null; chatId?: string; skipped?: boolean }> {
  if (!WHATSAPP_ENABLED) {
    return { ok: false, error: 'WhatsApp desactivado' };
  }

  const apoderadoPhone = student.contactPhone?.trim() || student.emergencyPhone?.trim() || '';
  if (!apoderadoPhone) {
    return { ok: false, error: 'El estudiante no tiene teléfono de contacto' };
  }

  if (
    shouldSkipDuplicateNotify(
      student.id,
      incident.registeredAt || '',
      'incident',
      incident.id,
    )
  ) {
    return {
      ok: true,
      error: null,
      skipped: true,
      chatId: toWhatsAppChatId(apoderadoPhone) || undefined,
    };
  }

  const chatId = toWhatsAppChatId(apoderadoPhone);
  const wppPhone = toWhatsAppPhone(apoderadoPhone);
  if (!chatId || !wppPhone) {
    return { ok: false, error: 'Teléfono de contacto no válido para WhatsApp' };
  }

  const messages = buildIncidentNotifyMessages(student, incident, fault, apoderadoPhone);
  const stubRecord: Partial<ArrivalRecord> = {
    id: incident.id,
    date: (incident.registeredAt || '').slice(0, 10),
    status: fault.name,
  };

  const result = META_WA_ENABLED
    ? await sendTextsViaMetaWa(wppPhone, student, stubRecord as ArrivalRecord, messages)
    : WPPCONNECT_ENABLED && WPPCONNECT_ROTATION
      ? await sendViaNotifyQueue(wppPhone, student, stubRecord, messages, 'incident')
      : WPPCONNECT_ENABLED
        ? await sendTextsViaWppConnect(wppPhone, messages)
        : await sendTextsViaOpenwa(chatId, messages);

  return { ...result, chatId };
}

async function notifyParentEvent(
  student: Student,
  record: ArrivalRecord,
  kind: 'arrival' | 'departure',
): Promise<{ ok: boolean; error: string | null; chatId?: string; skipped?: boolean }> {
  if (!WHATSAPP_ENABLED) {
    return { ok: false, error: 'WhatsApp desactivado' };
  }

  const apoderadoPhone = student.contactPhone?.trim() || student.emergencyPhone?.trim() || '';
  if (!apoderadoPhone) {
    return { ok: false, error: 'El estudiante no tiene teléfono de contacto' };
  }

  if (shouldSkipDuplicateNotify(student.id, record.date || '', kind)) {
    return {
      ok: true,
      error: null,
      skipped: true,
      chatId: toWhatsAppChatId(apoderadoPhone) || undefined,
    };
  }

  const chatId = toWhatsAppChatId(apoderadoPhone);
  const wppPhone = toWhatsAppPhone(apoderadoPhone);
  if (!chatId || !wppPhone) {
    return { ok: false, error: 'Teléfono de contacto no válido para WhatsApp' };
  }

  const messages =
    kind === 'departure'
      ? buildDepartureNotifyMessages(student, record, apoderadoPhone)
      : buildNotifyMessages(student, record, apoderadoPhone);

  const result = META_WA_ENABLED
    ? await sendTextsViaMetaWa(wppPhone, student, record, messages)
    : WPPCONNECT_ENABLED && WPPCONNECT_ROTATION
      ? await sendViaNotifyQueue(wppPhone, student, record, messages, kind)
      : WPPCONNECT_ENABLED
        ? await sendTextsViaWppConnect(wppPhone, messages)
        : await sendTextsViaOpenwa(chatId, messages);

  return { ...result, chatId };
}

export const whatsappService = {
  isEnabled: () => WHATSAPP_ENABLED,
  provider: () =>
    META_WA_ENABLED
      ? 'meta'
      : WPPCONNECT_ENABLED && WPPCONNECT_ROTATION
        ? 'wppconnect-queue'
        : WPPCONNECT_ENABLED
          ? 'wppconnect'
          : OPENWA_ENABLED
            ? 'openwa'
            : 'none',
  notifyParentArrival,
  notifyParentDeparture,
  notifyParentIncident,
};
