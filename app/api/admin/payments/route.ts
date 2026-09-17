import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyAdminAuth, errorResponse, securityLog } from '@/lib/security';

/* ================================================================
   GET /api/admin/payments
   Lista pagamentos para o painel admin

   Segurança:
   - Exige autenticação Bearer admin
   - Paginação obrigatória
================================================================ */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  if (!verifyAdminAuth(req)) {
    securityLog('ADMIN_PAYMENTS_UNAUTHORIZED', ip);
    return errorResponse('Unauthorized.', 401);
  }

  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') ?? '0'));
  const limit = 50;
  const from = page * limit;
  const to = from + limit - 1;

  const db = createServiceClient();
  const { data, error, count } = await db
    .from('payments')
    .select(`
      id, coins_qty, amount, status, created_at,
      mp_payment_id,
      users (name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return errorResponse('Erro ao buscar pagamentos.', 500);

  return NextResponse.json({ payments: data ?? [], total: count ?? 0, page });
}

export async function POST()   { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
