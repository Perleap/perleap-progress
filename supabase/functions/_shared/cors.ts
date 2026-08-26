/**
 * Shared CORS helpers for edge functions.
 * Origins are allowlisted via ALLOWED_ORIGINS env (comma-separated) or defaults.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://perleap.ai',
  'https://staging.perleap.ai',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function getAllowedOrigins(): string[] {
  const env = Deno.env.get('ALLOWED_ORIGINS');
  if (env?.trim()) {
    return env.split(',').map((value) => value.trim()).filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (getAllowedOrigins().includes(origin)) return true;

  // Vite may use another port when the configured one is taken (e.g. 8080 → 8880).
  try {
    const url = new URL(origin);
    const isLocalHost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return isLocalHost && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

export function getCorsHeaders(
  req: Request,
  extra: Record<string, string> = {},
): Record<string, string> {
  const origin = req.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    ...extra,
  };

  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

export function handleCorsPreflight(
  req: Request,
  extra: Record<string, string> = {},
): Response {
  const origin = req.headers.get('Origin');
  if (!origin || !isOriginAllowed(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req, extra),
  });
}
