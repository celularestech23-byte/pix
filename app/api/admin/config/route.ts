import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAdminAuth, parseJsonBody, sanitizeString, errorResponse, securityLog } from '@/lib/security';

/* ================================================================
   /api/admin/config
   GET  — Lê configurações (público para o frontend)
   POST — Salva configurações (apenas admin autenticado)

   Segurança:
   - POST exige header Authorization: Bearer <base64(user:pass)>
   - Sanitiza todos os inputs de texto
   - Limita tamanho do array de participantes
================================================================ */

export async function GET(req: NextRequest) {
  const db = createServiceClient();
  const { data, error } = await db
    .from('configs')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    // Retorna config padrão se ainda não configurado
    return NextResponse.json({
      title: 'PIX DA SORTE',
      prize: 'Pix de R$ 50',
      participants: ['Guilherme', 'Action Cam 4K', 'Headset Gamer', 'Pix R$ 100', 'Tente Novamente', 'Pix R$ 50', 'Pedro', 'Felipe'],
      forcedWinner: '',
      card1_title: 'ACTION CAM 4K', card1_img: '',
      card2_title: 'HEADSET GAMER', card2_img: '',
      card3_title: 'PIX R$ 100',   card3_img: '',
    });
  }

  if (!verifyAdminAuth(req)) {
    delete data.mp_access_token;
    delete data.mp_webhook_secret;
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  /* 1. Verifica autenticação admin */
  if (!verifyAdminAuth(req)) {
    securityLog('ADMIN_CONFIG_UNAUTHORIZED', ip);
    return errorResponse('Unauthorized.', 401);
  }

  /* 2. Lê body */
  const body = await parseJsonBody(req, 200_000); // 200KB (comporta imagens base64)
  if (!body) return errorResponse('Dados inválidos.', 400);

  /* 3. Sanitiza e valida campos */
  const title        = sanitizeString(String(body.title        ?? ''), 100) || 'PIX DA SORTE';
  const prize        = sanitizeString(String(body.prize        ?? ''), 100) || 'Pix de R$ 50';
  const forcedWinner = sanitizeString(String(body.forcedWinner ?? ''), 100);
  const card1_title  = sanitizeString(String(body.card1_title  ?? ''), 80);
  const card2_title  = sanitizeString(String(body.card2_title  ?? ''), 80);
  const card3_title  = sanitizeString(String(body.card3_title  ?? ''), 80);
  const mp_access_token = String(body.mp_access_token ?? '');
  const mp_webhook_secret = String(body.mp_webhook_secret ?? '');

  // Imagens base64 — valida que é realmente base64 ou URL data:
  const validateImg = (v: unknown) => {
    const s = String(v ?? '');
    if (s.startsWith('data:image/') || s.startsWith('http') || s === '') return s.substring(0, 500_000);
    return '';
  };
  const card1_img = validateImg(body.card1_img);
  const card2_img = validateImg(body.card2_img);
  const card3_img = validateImg(body.card3_img);

  // Array de participantes
  const rawParticipants = Array.isArray(body.participants) ? body.participants : [];
  const participants = rawParticipants
    .map((p: unknown) => sanitizeString(String(p), 80))
    .filter(Boolean)
    .slice(0, 50); // máximo 50 itens

  if (participants.length < 2) {
    return errorResponse('Mínimo 2 participantes.', 422);
  }

  const db = createServiceClient();
  const { error } = await db
    .from('configs')
    .upsert({
      id: 1,
      title, prize, participants, forced_winner: forcedWinner,
      card1_title, card1_img,
      card2_title, card2_img,
      card3_title, card3_img,
      mp_access_token, mp_webhook_secret,
    });

  if (error) {
    console.error('[admin/config] Supabase error:', error.message);
    return errorResponse('Erro ao salvar configurações.', 500);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() { return errorResponse('Method not allowed.', 405); }
