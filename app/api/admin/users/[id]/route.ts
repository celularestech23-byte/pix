import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAdminAuth, errorResponse } from '@/lib/security';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminAuth(req)) return errorResponse('Não autorizado.', 401);

  const { id } = params;
  try {
    const body = await req.json();
    const db = createServiceClient();
    
    // Admins can update name, phone, coins, balance
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.coins !== undefined) updateData.coins = parseInt(body.coins);
    if (body.balance !== undefined) updateData.balance = parseFloat(body.balance);

    const { error } = await db.from('users').update(updateData).eq('id', id);
    if (error) return errorResponse('Erro ao atualizar usuário.', 500);

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse('Erro interno.', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifyAdminAuth(req)) return errorResponse('Não autorizado.', 401);

  const { id } = params;
  try {
    const db = createServiceClient();
    const { error } = await db.from('users').delete().eq('id', id);
    if (error) return errorResponse('Erro ao deletar usuário.', 500);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse('Erro interno.', 500);
  }
}
