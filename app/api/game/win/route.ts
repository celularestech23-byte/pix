import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse, parseJsonBody } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, 1000);
    if (!body || !body.userId || !body.result) {
      return errorResponse('Dados inválidos.', 400);
    }

    const { userId, result } = body as { userId: string, result: string };
    const db = createServiceClient();

    // 1. Get User
    const { data: user } = await db.from('users').select('id, coins, balance').eq('id', userId).single();
    if (!user) return errorResponse('Usuário não encontrado.', 404);

    // 2. Check Coins (Allow if 0 only if they just bought, but here we assume >= 1 is required)
    // Actually, if it's 0, they shouldn't have spun. The client prevents it.
    if (user.coins <= 0) {
      return errorResponse('Sem moedas.', 403);
    }

    let newCoins = user.coins - 1;
    let newBalance = parseFloat(user.balance);

    // 3. Calculate Win Amount
    // Se não for "tente novamente", tentamos extrair um valor numérico.
    if (!result.toLowerCase().includes('tente novamente')) {
       // Match numbers that might include dots and commas (e.g., "1.50", "1,50", "1.000,50")
       const match = result.match(/R\$\s*([\d\.,]+)/i) || result.match(/([\d\.,]+)\s*reais/i);
       if (match) {
         // Replace comma with dot to parse correctly, ignoring dots used as thousand separators
         let valStr = match[1].replace(/\./g, '').replace(',', '.');
         newBalance += parseFloat(valStr) || 0;
       } else {
         // Fallback se tiver apenas números e pontuações
         let clean = result.replace(/[^\d\.,]/g, '');
         if (clean) {
           let valStr = clean.replace(/\./g, '').replace(',', '.');
           newBalance += parseFloat(valStr) || 0;
         }
       }
    }

    // 4. Update User
    const { error: updateErr } = await db.from('users').update({
      coins: newCoins,
      balance: newBalance
    }).eq('id', userId);

    if (updateErr) return errorResponse('Erro ao atualizar.', 500);

    // 5. Log Spin
    await db.from('spins').insert({ user_id: userId, result });

    return NextResponse.json({ success: true, newCoins, newBalance });
  } catch (err) {
    console.error('[game/win]', err);
    return errorResponse('Erro interno.', 500);
  }
}
