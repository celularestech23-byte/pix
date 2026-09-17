import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAdminAuth, errorResponse, securityLog } from '@/lib/security';

/* ================================================================
   GET /api/admin/users
   Lista usuários para o painel admin

   Segurança:
   - Exige autenticação Bearer admin
   - Nunca retorna CPF completo (mascarado)
   - Paginação obrigatória (limite de 50 por vez)
================================================================ */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  if (!verifyAdminAuth(req)) {
    securityLog('ADMIN_USERS_UNAUTHORIZED', ip);
    return errorResponse('Unauthorized.', 401);
  }

  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') ?? '0'));
  const limit = 50;
  const from = page * limit;
  const to = from + limit - 1;

  const db = createServiceClient();
  const { data, error, count } = await db
    .from('users')
    .select('id, name, cpf, phone, coins, balance, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return errorResponse('Erro ao buscar usuários.', 500);

  // Mascara CPF parcialmente (preserva apenas 3 primeiros + 2 últimos dígitos)
  const masked = (data ?? []).map(u => ({
    ...u,
    cpf: u.cpf.replace(/^(\d{3})\d{5}(\d{3})$/, '$1*****$2'),
    phone: u.phone.replace(/^(\d{2})\d{5}(\d{4})$/, '($1) *****-$2'),
  }));

  return NextResponse.json({ users: masked, total: count ?? 0, page });
}

export async function POST()   { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
