/**
 * Cliente WPPConnect interno (localhost:21465).
 */
import { readFileSync, existsSync } from 'node:fs';

const tokenCache = new Map();

/** Timeout corto en chequeos: sin esto, chips colgados → Cloudflare 524. */
const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.WPPCONNECT_FETCH_TIMEOUT_MS || 8_000);

export function loadEnvFileSync(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function createWppClient(options = {}) {
  const apiBase = (options.apiBase || process.env.WPPCONNECT_INTERNAL_API || 'http://127.0.0.1:21465/api').replace(
    /\/$/,
    '',
  );
  const secretKey = options.secretKey || process.env.WPPCONNECT_SECRET_KEY || '';
  const fetchTimeoutMs = Number(options.fetchTimeoutMs || DEFAULT_FETCH_TIMEOUT_MS);

  async function getToken(session) {
    const cached = tokenCache.get(session);
    if (cached && cached.expires > Date.now()) return cached.token;
    const res = await fetchWithTimeout(
      `${apiBase}/${session}/${secretKey}/generate-token`,
      { method: 'POST' },
      fetchTimeoutMs,
    );
    const json = await res.json().catch(() => ({}));
    const token = json.token || '';
    if (!token) throw new Error(`No token for ${session}`);
    tokenCache.set(session, { token, expires: Date.now() + 50 * 60 * 1000 });
    return token;
  }

  async function apiPost(session, route, body) {
    const token = await getToken(session);
    const res = await fetchWithTimeout(
      `${apiBase}/${session}${route}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      Math.max(fetchTimeoutMs, 60_000),
    );
    const raw = await res.text().catch(() => res.statusText);
    if (!res.ok) {
      const err = new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  async function apiGet(session, route) {
    const token = await getToken(session);
    const res = await fetchWithTimeout(
      `${apiBase}/${session}${route}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      },
      fetchTimeoutMs,
    );
    const raw = await res.text().catch(() => res.statusText);
    if (!res.ok) {
      const err = new Error(raw.slice(0, 200) || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  async function isConnected(session) {
    // check-connection-session a veces cuelga o falla aunque la sesión envíe bien.
    // Fallback: status-session === CONNECTED.
    try {
      const json = await apiGet(session, '/check-connection-session');
      if (json.status === true || json.message === 'Connected' || json.connected === true) {
        return true;
      }
    } catch {
      // ignore; intentar status-session
    }
    try {
      const st = await apiGet(session, '/status-session');
      const status = String(st.status || st.message || '').toUpperCase();
      return status === 'CONNECTED' || status === 'INCHAT' || status === 'MAIN';
    } catch {
      return false;
    }
  }

  async function getPhoneNumber(session) {
    const json = await apiGet(session, '/get-phone-number');
    const raw = String(json.response ?? json.phone ?? json.number ?? json.raw ?? '').replace(/\D/g, '');
    return raw || null;
  }

  function typingDelayMs() {
    const min = Number(process.env.WPPCONNECT_TYPING_MIN_MS || options.typingMinMs || 10_000);
    const max = Number(process.env.WPPCONNECT_TYPING_MAX_MS || options.typingMaxMs || 12_000);
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  async function sendMessage(session, phone, message, sendOptions = {}) {
    const typingMs = sendOptions.typingMs ?? typingDelayMs();
    const digits = String(phone || '').replace(/\D/g, '');
    const phoneArg = digits || phone;
    await apiPost(session, '/typing', { phone: phoneArg, isGroup: false, value: true }).catch(() => {});
    await new Promise((r) => setTimeout(r, typingMs));
    const result = await apiPost(session, '/send-message', {
      phone: phoneArg,
      message,
      isGroup: false,
    });
    await apiPost(session, '/typing', { phone: phoneArg, isGroup: false, value: false }).catch(() => {});
    if (result && (result.status === 'Error' || result.status === 'error')) {
      const err = new Error(
        typeof result === 'object' ? JSON.stringify(result).slice(0, 300) : String(result),
      );
      err.status = 500;
      throw err;
    }
    return result;
  }

  return { getToken, apiGet, apiPost, isConnected, getPhoneNumber, sendMessage, typingDelayMs };
}
