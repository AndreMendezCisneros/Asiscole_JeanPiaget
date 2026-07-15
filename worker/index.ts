export interface Env {
  ASSETS: Fetcher;
  /** URL base del API OpenWA en el VPS (usar HTTP para evitar cert autofirmado). */
  OPENWA_UPSTREAM?: string;
}

/** Proxy same-origin hacia OpenWA en el VPS. */
const OPENWA_PREFIX = '/sc-proxy';

const SOCIAL_CRAWLER_RE =
  /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest/i;

const WHATSAPP_PREVIEW_IMAGE = 'https://asiscole.com/whatsapp-preview.jpg?v=1';

function resolveUpstreamBase(raw?: string): string {
  const base = (raw || 'http://178.104.115.2/api').trim().replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

function buildUpstreamUrl(requestUrl: URL, upstreamBase: string): string {
  const suffix = requestUrl.pathname.slice(OPENWA_PREFIX.length);
  return `${upstreamBase}${suffix}${requestUrl.search}`;
}

async function proxyOpenwa(request: Request, requestUrl: URL, upstreamBase: string): Promise<Response> {
  const targetUrl = buildUpstreamUrl(requestUrl, upstreamBase);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    const upstream = await fetch(targetUrl, init);

    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (location?.startsWith('https://')) {
        return Response.json(
          {
            error:
              'OpenWA redirige a HTTPS con certificado no válido. Configure OPENWA_UPSTREAM con HTTP (puerto 80) en el Worker.',
          },
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return upstream;
  } catch {
    return Response.json(
      {
        error:
          'No se pudo conectar con OpenWA en el servidor. Revise que el API esté accesible por HTTP desde Cloudflare.',
      },
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function isSocialCrawler(userAgent: string | null): boolean {
  return SOCIAL_CRAWLER_RE.test(userAgent ?? '');
}

function isWhatsAppLinkPreviewPath(pathname: string): boolean {
  return (
    pathname.startsWith('/llegada/') ||
    pathname === '/portal-padres' ||
    pathname.startsWith('/portal-padres/')
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSocialPreviewHtml(pathname: string, origin: string): string {
  const pageUrl = `${origin}${pathname}`;
  const isArrival = pathname.startsWith('/llegada/');
  const title = isArrival
    ? 'Consulta de asistencia | Colegio Jean Piaget — Asiscole'
    : 'Portal de padres | Consulta de asistencia — Colegio Jean Piaget';
  const description = isArrival
    ? 'Registro de llegada del estudiante. Consulte la asistencia diaria en el Sistema de Incidencias Escolares del Colegio Jean Piaget.'
    : 'Consulte la asistencia diaria de su hijo o hija en el Colegio Jean Piaget ingresando el DNI del estudiante.';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:site_name" content="Asiscole" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="es_PE" />
  <meta property="og:image" content="${WHATSAPP_PREVIEW_IMAGE}" />
  <meta property="og:image:secure_url" content="${WHATSAPP_PREVIEW_IMAGE}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="SIE Asiscole — Sistema de Incidencias Escolares, Colegio Jean Piaget" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${WHATSAPP_PREVIEW_IMAGE}" />
  <link rel="canonical" href="${escapeHtml(pageUrl)}" />
</head>
<body><p>${escapeHtml(description)}</p></body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === OPENWA_PREFIX || url.pathname.startsWith(`${OPENWA_PREFIX}/`)) {
      return proxyOpenwa(request, url, resolveUpstreamBase(env.OPENWA_UPSTREAM));
    }

    const ua = request.headers.get('user-agent');
    if (
      request.method === 'GET' &&
      isSocialCrawler(ua) &&
      isWhatsAppLinkPreviewPath(url.pathname)
    ) {
      return new Response(buildSocialPreviewHtml(url.pathname, url.origin), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
