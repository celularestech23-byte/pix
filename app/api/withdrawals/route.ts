import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse, parseJsonBody, sanitizeString, sanitizeCPF } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req, 2000);
    if (!body) return errorResponse('Dados inválidos.', 400);

    const userId = String(body.userId ?? '');
    const amountStr = String(body.amount ?? '0');
    const pixKey = sanitizeString(String(body.pixKey ?? ''), 100);
    const cpfRaw = String(body.cpf ?? '');
    const cpf = sanitizeCPF(cpfRaw);

    const amount = parseFloat(amountStr);

    if (!userId || !pixKey || !cpf) {
      return errorResponse('Preencha todos os campos.', 400);
    }
    if (isNaN(amount) || amount <= 0) {
      return errorResponse('Valor inválido.', 400);
    }

    const db = createServiceClient();

    // Verifies user and balance
    const { data: user } = await db
      .from('users')
      .select('id, balance, cpf')
      .eq('id', userId)
      .single();

    if (!user) return errorResponse('Usuário não encontrado.', 404);
    if (user.cpf !== cpf) return errorResponse('CPF não confere.', 400);
    if (parseFloat(user.balance) < amount) return errorResponse('Saldo insuficiente.', 400);

    // Deducts balance and inserts withdrawal request in a transaction (RPC or two steps for now)
    const newBalance = parseFloat(user.balance) - amount;
    const { error: updateErr } = await db.from('users').update({ balance: newBalance }).eq('id', userId);
    if (updateErr) return errorResponse('Erro ao descontar saldo.', 500);

    const { error: insertErr } = await db.from('withdrawals').insert({
      user_id: userId,
      amount: amount,
      pix_key: pixKey,
      cpf: cpf,
      status: 'pending'
    });

    if (insertErr) {
      // Revert balance (naive approach, ideally use Postgres Functions for transaction)
      await db.from('users').update({ balance: user.balance }).eq('id', userId);
      return errorResponse('Erro ao solicitar saque.', 500);
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (err) {
    console.error('[withdrawals]', err);
    return errorResponse('Erro interno.', 500);
  }
}
