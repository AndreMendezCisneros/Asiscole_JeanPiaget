import { loadEnv, type Plugin } from 'vite';

function resolveHttpOrigin(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const { hostname, origin } = new URL(trimmed);
    // En producción el navegador debe usar /sc-proxy (proxy Worker), no la IP del VPS.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      console.warn(
        '[sie-csp] VITE_OPENWA_API_URL apunta a una IP. Use /sc-proxy en Cloudflare para evitar ERR_CERT_AUTHORITY_INVALID.'
      );
      return null;
    }
    return origin;
  } catch {
    return null;
  }
}

/**
 * Añade orígenes extra a connect-src en desarrollo (cabecera del servidor Vite).
 * En producción la CSP va en Caddy / public/_headers, no en meta tags.
 */
export function cspConnectSrcPlugin(): Plugin {
  let env: Record<string, string> = {};

  return {
    name: 'sie-csp-connect-src',
    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), '');
    },
    configureServer(server) {
      const origins = new Set<string>();
      const openwaOrigin = resolveHttpOrigin(env.VITE_OPENWA_API_URL);
      if (openwaOrigin) origins.add(openwaOrigin);
      const supabaseOrigin = resolveHttpOrigin(env.VITE_SUPABASE_URL);
      if (supabaseOrigin) {
        origins.add(supabaseOrigin);
        origins.add(supabaseOrigin.replace(/^https:/, 'wss:'));
      }

      const connectExtra = origins.size > 0 ? ` ${[...origins].join(' ')}` : '';
      const devCsp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "media-src 'self' blob: data:",
        `connect-src 'self' https://spdugaykkcgpcfslcpac.supabase.co wss://spdugaykkcgpcfslcpac.supabase.co${connectExtra}`,
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ');

      server.middlewares.use((_req, res, next) => {
        res.setHeader('Content-Security-Policy', devCsp);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('X-Frame-Options', 'DENY');
        next();
      });
    },
  };
}
