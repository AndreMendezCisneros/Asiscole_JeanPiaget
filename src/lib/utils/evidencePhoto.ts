import { supabase } from '@/lib/supabaseClient';

const EVIDENCE_BUCKET = 'evidencias';

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;

function getCached(path: string): string | null {
  const entry = signedUrlCache.get(path);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    signedUrlCache.delete(path);
    return null;
  }
  return entry.url;
}

function setCached(path: string, url: string): void {
  signedUrlCache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
}

function extractPath(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\/+/, '');
  if (trimmed.startsWith(`${EVIDENCE_BUCKET}/`)) {
    return trimmed.slice(EVIDENCE_BUCKET.length + 1);
  }
  const match = trimmed.match(
    /\/storage\/v1\/object\/(?:public|sign)\/evidencias\/(.+?)(?:\?|$)/,
  );
  if (match?.[1]) return decodeURIComponent(match[1]);
  if (!trimmed.includes('://') && !trimmed.startsWith('data:')) return trimmed;
  return null;
}

/** URL pública o firmada (caché) para una evidencia en Storage. */
export async function resolveEvidencePhotoUrl(ruta: string): Promise<string> {
  const path = extractPath(ruta);
  if (!path) {
    const { data } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(ruta);
    return data.publicUrl;
  }

  const cached = getCached(path);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, 3600);

  if (!error && data?.signedUrl) {
    setCached(path, data.signedUrl);
    return data.signedUrl;
  }

  const { data: pub } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/** Precarga firmas para varias evidencias de una incidencia. */
export async function prefetchEvidencePhotoUrls(rutas: string[]): Promise<void> {
  const paths = [...new Set(rutas.map(extractPath).filter((p): p is string => Boolean(p)))];
  const missing = paths.filter((path) => !getCached(path));
  if (missing.length === 0) return;

  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrls(missing, 3600);

  if (error || !data?.length) return;

  for (const item of data) {
    if (item.signedUrl && item.path) {
      setCached(item.path, item.signedUrl);
    }
  }
}
