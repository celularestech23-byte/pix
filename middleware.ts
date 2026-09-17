import { NextRequest, NextResponse } from 'next/server';

/* ================================================================
   MIDDLEWARE DE SEGURANÇA — PIX DA SORTE
   Executa em TODAS as requests antes das rotas

   Proteções:
   1. Security Headers (CSP, HSTS, X-Frame, etc.)
   2. Rate Limiting por IP (em memória — use Upstash Redis em prod)
   3. CORS — apenas próprio domínio
   4. Bloqueia bots óbvios por User-Agent
   5. Tamanho máximo do body das API routes
================================================================ */

/* ── Rate Limiter em memória ── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/auth/register':    { max: 5,  windowMs: 60_000  },  // 5 cadastros/min por IP
  '/api/payment/create':  { max: 10, windowMs: 60_000  },  // 10 pagamentos/min
  '/api/game/spin':        { max: 30, windowMs: 60_000  },  // 30 giros/min
  '/api/admin':            { max: 20, windowMs: 60_000  },  // 20 req admin/min
  'default':               { max: 100, windowMs: 60_000 },  // geral
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string, path: string): boolean {
  // Detecta qual limite usar
  const limitKey = Object.keys(RATE_LIMITS).find(k => k !== 'default' && path.startsWith(k)) ?? 'default';
  const { max, windowMs } = RATE_LIMITS[limitKey];

  const key = `${ip}:${limitKey}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true; // permitido
  }

  if (entry.count >= max) return false; // bloqueado

  entry.count++;
  return true;
}

/* ── Limpeza periódica do mapa (evita memory leak) ── */
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

/* ── User-Agents suspeitos ── */
const BLOCKED_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
  /python-requests\/[01]\./i, /curl\/[56]\./i,
  /go-http-client\/1\./i, /wget\/1\.[01]/i,
];

/* ── CSP Header ── */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://api.qrserver.com https://*.supabase.co",
  "connect-src 'self' ws://localhost:* https://phmjrhgwhnddfsffirvo.supabase.co https://api.mercadopago.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';
  const origin = req.headers.get('origin') || '';

  /* 1️⃣  Bloqueia User-Agents maliciosos */
  if (BLOCKED_UA_PATTERNS.some(p => p.test(ua))) {
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /* 2️⃣  Rate Limiting para /api/* */
  if (pathname.startsWith('/api/')) {
    // Webhook do MP não tem rate limit (vem de servidores deles)
    if (!pathname.startsWith('/api/payment/webhook')) {
      const allowed = checkRateLimit(ip, pathname);
      if (!allowed) {
        return new NextResponse(JSON.stringify({ error: 'Too Many Requests', retryAfter: 60 }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        });
      }
    }

    /* 3️⃣  CORS — apenas próprio domínio + localhost dev */
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Bloqueia origins externos em produção
    if (process.env.NODE_ENV === 'production' && origin) {
      const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || '';
      if (allowedOrigin && !origin.startsWith(allowedOrigin)) {
        return new NextResponse(JSON.stringify({ error: 'CORS policy violation' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  /* 4️⃣  Monta response com Security Headers */
  const res = NextResponse.next();

  // Content Security Policy
  res.headers.set('Content-Security-Policy', CSP);
  // Impede clickjacking
  res.headers.set('X-Frame-Options', 'DENY');
  // Impede MIME sniffing
  res.headers.set('X-Content-Type-Options', 'nosniff');
  // Referrer Policy
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions Policy — desativa recursos desnecessários
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // HSTS — força HTTPS por 1 ano em produção
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  // Remove header que revela tecnologia
  res.headers.delete('X-Powered-By');
  // XSS Protection legado
  res.headers.set('X-XSS-Protection', '1; mode=block');

  return res;
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas EXCETO:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
