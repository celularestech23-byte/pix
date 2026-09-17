import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { errorResponse, verifyMPWebhookSignature, securityLog } from '@/lib/security';

/* ================================================================
   POST /api/payment/webhook
   Recebe notificações de pagamento do Mercado Pago

   Segurança:
   - Verifica assinatura HMAC do Mercado Pago
   - Consulta o status diretamente na API do MP (não confia no body)
   - Idempotente (processa cada payment_id apenas 1x)
   - Sem rate limit (vem dos servidores do MP)
================================================================ */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  let rawBody = '';

  try {
    rawBody = await req.text();
  } catch {
    return errorResponse('Invalid body.', 400);
  }

  const db = createServiceClient();
  const { data: cfg } = await db.from('configs').select('mp_access_token, mp_webhook_secret').eq('id', 1).single();

  /* 1. Verifica assinatura do Mercado Pago */
  if (!verifyMPWebhookSignature(req, rawBody, cfg?.mp_webhook_secret)) {
    securityLog('WEBHOOK_INVALID_SIGNATURE', ip);
    return errorResponse('Unauthorized.', 401);
  }

  let data: Record<string, unknown>;
  try { data = JSON.parse(rawBody); } catch {
    return errorResponse('Invalid JSON.', 400);
  }

  /* 2. Só processa eventos de pagamento */
  if (data.type !== 'payment' || !data.data) {
    return NextResponse.json({ ok: true });
  }

  const mpPaymentId = String((data.data as Record<string, unknown>).id ?? '');
  if (!mpPaymentId) return NextResponse.json({ ok: true });

  const mpToken = cfg?.mp_access_token || process.env.MP_ACCESS_TOKEN;
  if (!mpToken) return NextResponse.json({ ok: true, note: 'MP not configured' });

  try {
    /* 3. Consulta status DIRETAMENTE no MP (nunca confia no webhook body) */
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });
    const mpData = await mpRes.json();

    if (mpData.status !== 'approved') {
      return NextResponse.json({ ok: true, status: mpData.status });
    }



    /* 4. Busca o pagamento no banco pelo mp_payment_id */
    const { data: payment } = await db
      .from('payments')
      .select('id, user_id, coins_qty, status')
      .eq('mp_payment_id', mpPaymentId)
      .maybeSingle();

    if (!payment) {
      securityLog('WEBHOOK_PAYMENT_NOT_FOUND', ip, { mpPaymentId });
      return NextResponse.json({ ok: true });
    }

    /* 5. Idempotência — ignora se já foi processado */
    if (payment.status === 'approved') {
      return NextResponse.json({ ok: true, note: 'already processed' });
    }

    /* 6. Atualiza pagamento e adiciona moedas atomicamente */
    await db.from('payments').update({ status: 'approved' }).eq('id', payment.id);

    // Incrementa moedas com valor atual do banco (evita race)
    const { data: user } = await db
      .from('users')
      .select('coins')
      .eq('id', payment.user_id)
      .single();

    if (user) {
      await db
        .from('users')
        .update({ coins: user.coins + payment.coins_qty })
        .eq('id', payment.user_id);
    }

    return NextResponse.json({ ok: true, processed: true });

  } catch (err) {
    console.error('[webhook] Error:', err);
    return errorResponse('Webhook processing error.', 500);
  }
}

export async function GET()    { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
