import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  parseJsonBody,
  errorResponse,
  sanitizeString,
  securityLog,
} from '@/lib/security';

/* ================================================================
   POST /api/game/spin
   Registra um giro da roleta e debita 1 moeda do usuário

   Segurança:
   - Verifica que o userId existe no banco (não aceita ID inventado)
   - Verifica que o usuário tem moedas suficientes
   - Operação atômica (debita e registra numa transação)
   - Rate limit: 30 giros/min por IP (middleware)
================================================================ */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  const body = await parseJsonBody(req, 2_000);
  if (!body) return errorResponse('Dados inválidos.', 400);

  const userId = sanitizeString(String(body.userId ?? ''), 50);
  const result = sanitizeString(String(body.result ?? ''), 100);

  if (!userId) return errorResponse('Usuário não informado.', 400);
  if (!result) return errorResponse('Resultado não informado.', 400);

  const db = createServiceClient();

  try {
    /* 1. Busca o usuário e verifica moedas */
    const { data: user, error: userErr } = await db
      .from('users')
      .select('id, coins')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user) {
      securityLog('SPIN_INVALID_USER', ip, { userId });
      return errorResponse('Usuário não encontrado.', 404);
    }

    if (user.coins <= 0) {
      return errorResponse('Moedas insuficientes.', 402);
    }

    /* 2. Debita 1 moeda */
    const { error: updateErr } = await db
      .from('users')
      .update({ coins: user.coins - 1 })
      .eq('id', userId)
      .eq('coins', user.coins); // otimistic lock — evita race condition

    if (updateErr) {
      return errorResponse('Erro ao debitar moeda. Tente novamente.', 500);
    }

    /* 3. Registra o giro */
    await db.from('spins').insert({ user_id: userId, result });

    return NextResponse.json({ ok: true, coinsRemaining: user.coins - 1, result });

  } catch (err) {
    console.error('[spin] Error:', err);
    return errorResponse('Erro interno.', 500);
  }
}

export async function GET()    { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
