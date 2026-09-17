import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAdminAuth, errorResponse } from '@/lib/security';

export async function GET(req: NextRequest) {
  if (!verifyAdminAuth(req)) return errorResponse('Não autorizado.', 401);

  try {
    const db = createServiceClient();
    // Using Supabase joins: withdrawals with user details
    const { data, error } = await db
      .from('withdrawals')
      .select('*, users(name)')
      .order('created_at', { ascending: false });

    if (error) return errorResponse('Erro ao listar saques.', 500);

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse('Erro interno.', 500);
  }
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminAuth(req)) return errorResponse('Não autorizado.', 401);

  try {
    const body = await req.json();
    const id = body.id;
    const status = body.status; // 'approved' or 'rejected'

    if (!id || !['approved', 'rejected'].includes(status)) {
      return errorResponse('Dados inválidos.', 400);
    }

    const db = createServiceClient();

    // Get the withdrawal
    const { data: w } = await db.from('withdrawals').select('*').eq('id', id).single();
    if (!w) return errorResponse('Saque não encontrado.', 404);
    if (w.status !== 'pending') return errorResponse('Saque já processado.', 400);

    // Update status
    const { error: updateErr } = await db.from('withdrawals').update({ status }).eq('id', id);
    if (updateErr) return errorResponse('Erro ao atualizar status.', 500);

    // If rejected, refund the user
    if (status === 'rejected') {
      const { data: user } = await db.from('users').select('balance').eq('id', w.user_id).single();
      if (user) {
        const newBalance = parseFloat(user.balance) + parseFloat(w.amount);
        await db.from('users').update({ balance: newBalance }).eq('id', w.user_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse('Erro interno.', 500);
  }
}
