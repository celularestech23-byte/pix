import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse, sanitizeString, securityLog } from '@/lib/security';

/* ================================================================
   GET /api/payment/status?id=<paymentId>
   Polling seguro do status de um pagamento

   Segurança:
   - Não expõe dados sensíveis (cpf, token, etc.)
   - Retorna apenas o status
================================================================ */
export async function GET(req: NextRequest) {
  const id = sanitizeString(req.nextUrl.searchParams.get('id') ?? '', 50);

  if (!id) return errorResponse('ID não informado.', 400);

  const db = createServiceClient();
  const { data } = await db
    .from('payments')
    .select('status')
    .eq('id', id)
    .maybeSingle();

  if (!data) return errorResponse('Pagamento não encontrado.', 404);

  return NextResponse.json({ status: data.status });
}

export async function POST()   { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
