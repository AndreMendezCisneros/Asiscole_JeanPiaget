import { supabase } from '@/lib/supabaseClient';

const PROFILE_BUCKET = 'fotos-perfil';

/** Tamaño objetivo para avatares en listados (WebP). */
export const PROFILE_AVATAR_SIZE = 400;

/** Caché en memoria de URLs firmadas (evita peticiones repetidas por foto). */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;

function getCachedSignedUrl(path: string): string | null {
  const entry = signedUrlCache.get(path);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    signedUrlCache.delete(path);
    return null;
  }
  return entry.url;
}

function setCachedSignedUrl(path: string, url: string): void {
  signedUrlCache.set(path, { url, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
}

function extractStoragePath(value: string): string | null {
  const trimmed = value.trim().replace(/^\/+/, '');
  if (trimmed.startsWith(`${PROFILE_BUCKET}/`)) {
    return trimmed.slice(PROFILE_BUCKET.length + 1);
  }
  const publicMatch = trimmed.match(
    /\/storage\/v1\/object\/(?:public|sign)\/fotos-perfil\/(.+?)(?:\?|$)/
  );
  if (publicMatch?.[1]) {
    return decodeURIComponent(publicMatch[1]);
  }
  if (!trimmed.includes('://') && !trimmed.startsWith('data:')) {
    return trimmed;
  }
  return null;
}

/**
 * Convierte el valor guardado en BD (URL completa, data URL o ruta en Storage)
 * en una URL lista para usar en <img>.
 */
export function resolveStudentProfilePhotoUrl(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const path = extractStoragePath(trimmed);
  if (!path) return null;

  const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

/** Obtiene URL firmada si la pública falla (bucket privado o políticas restrictivas). */
export async function getSignedProfilePhotoUrl(
  raw: string | null | undefined
): Promise<string | null> {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const path = extractStoragePath(trimmed);
  if (!path) return resolveStudentProfilePhotoUrl(trimmed);

  const cached = getCachedSignedUrl(path);
  if (cached) return cached;

  const { data, error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return resolveStudentProfilePhotoUrl(trimmed);
  }

  setCachedSignedUrl(path, data.signedUrl);
  return data.signedUrl;
}

/** Indica si el valor es una ruta en Storage (no URL absoluta). */
export function isProfileStoragePath(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const trimmed = raw.trim();
  return (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('data:') &&
    !trimmed.startsWith('blob:')
  );
}

/**
 * Resuelve la mejor URL en una sola pasada (firmada para rutas de Storage).
 * Evita el doble intento público → error → firmada en <img>.
 */
export async function resolveStudentProfilePhotoUrlAsync(
  raw: string | null | undefined,
): Promise<string | null> {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  return getSignedProfilePhotoUrl(trimmed);
}

/** Precarga URLs firmadas en lote (listados con varias fotos). */
export async function prefetchSignedProfilePhotos(
  raws: Array<string | null | undefined>,
): Promise<void> {
  const paths = [
    ...new Set(
      raws
        .map((raw) => (raw ? extractStoragePath(raw.trim()) : null))
        .filter((p): p is string => Boolean(p)),
    ),
  ];

  const missing = paths.filter((path) => !getCachedSignedUrl(path));
  if (missing.length === 0) return;

  const { data, error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .createSignedUrls(missing, 3600);

  if (error || !data?.length) return;

  for (const item of data) {
    if (item.signedUrl && item.path) {
      setCachedSignedUrl(item.path, item.signedUrl);
    }
  }
}
