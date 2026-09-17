import { NextRequest, NextResponse } from 'next/server';

/* ================================================================
   UTILITÁRIOS DE SEGURANÇA — Compartilhados entre API Routes
================================================================ */

/* ── Validação de CPF ── */
export function validateCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0, rem: number;
  for (let i = 1; i <= 9; i++) sum += parseInt(c[i - 1]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(c[i - 1]) * (12 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(c[10]);
}

/* ── Validação de Telefone ── */
export function validatePhone(phone: string): boolean {
  const c = phone.replace(/\D/g, '');
  return c.length === 11 && parseInt(c.substring(0, 2)) >= 11;
}

/* ── Sanitização básica de strings (remove HTML/SQL injection attempts) ── */
export function sanitizeString(str: string, maxLen = 200): string {
  return str
    .replace(/<[^>]*>/g, '')           // Remove HTML tags
    .replace(/['"`;\\]/g, '')          // Remove chars perigosos SQL
    .replace(/--/g, '')               // Remove comentários SQL
    .replace(/\/\*/g, '')             // Remove início bloco SQL
    .trim()
    .substring(0, maxLen);
}

/* ── Sanitização de CPF ── */
export function sanitizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '').substring(0, 11);
}

/* ── Sanitização de telefone ── */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '').substring(0, 11);
}

/* ── Verifica autenticação do Admin via header ── */
export function verifyAdminAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.substring(7);
  const expectedToken = Buffer.from(
    `${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`
  ).toString('base64');

  // Comparação de tempo constante (evita timing attacks)
  return timingSafeEqual(token, expectedToken);
}

/* ── Comparação de strings em tempo constante ── */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ── Lê e valida o body JSON com limite de tamanho ── */
export async function parseJsonBody(req: NextRequest, maxBytes = 10_000): Promise<Record<string, unknown> | null> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxBytes) return null;

  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ── Resposta de erro padronizada ── */
export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/* ── Valida assinatura do webhook Mercado Pago ── */
export function verifyMPWebhookSignature(
  req: NextRequest,
  body: string,
  secretOverride?: string
): boolean {
  const secret = secretOverride || process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // Se não configurado, passa (dev mode)

  const signature = req.headers.get('x-signature') || '';
  const requestId = req.headers.get('x-request-id') || '';
  const dataId = new URL(req.url).searchParams.get('data.id') || '';

  // Formato: ts=...,v1=...
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) return false;

  // Manifesto: id:data.id;request-id:x-request-id;ts:ts;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(manifest);
  const expectedSig = hmac.digest('hex');

  return timingSafeEqual(v1, expectedSig);
}

/* ── Log de eventos de segurança (poderia ir para Supabase tb) ── */
export function securityLog(event: string, ip: string, details?: object) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SECURITY] ${new Date().toISOString()} | ${event} | IP: ${ip}`, details ?? '');
  }
}
