import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  parseJsonBody,
  errorResponse,
  sanitizeString,
  securityLog,
} from '@/lib/security';

/* ================================================================
   POST /api/payment/create
   Cria um pagamento PIX via Mercado Pago

   Segurança:
   - Token do MP NUNCA vai ao frontend — fica só no servidor
   - Verifica usuário no banco antes de criar cobrança
   - Valida valor mínimo e máximo (evita cobranças absurdas)
   - Registra pagamento como 'pending' no banco antes de confirmar
   - Idempotency-Key único para evitar cobrança duplicada
================================================================ */

const MIN_AMOUNT = 0.50;
const MAX_AMOUNT = 500.00;
const VALID_QTYS  = [2, 3, 6, 10, 20, 50];

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  const body = await parseJsonBody(req, 3_000);
  if (!body) return errorResponse('Dados inválidos.', 400);

  const userId  = sanitizeString(String(body.userId  ?? ''), 50);
  const coinsQty = Number(body.coinsQty ?? 0);
  const amount   = Number(body.amount   ?? 0);

  /* Valida parâmetros */
  if (!userId) return errorResponse('Usuário não informado.', 400);
  if (!VALID_QTYS.includes(coinsQty)) {
    securityLog('PAYMENT_INVALID_QTY', ip, { coinsQty });
    return errorResponse('Quantidade de moedas inválida.', 422);
  }
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    securityLog('PAYMENT_INVALID_AMOUNT', ip, { amount });
    return errorResponse('Valor inválido.', 422);
  }

  /* Valor esperado para aquela quantidade (prevenção de tampering) */
  const expectedAmount = parseFloat((coinsQty * 0.5).toFixed(2));
  if (Math.abs(amount - expectedAmount) > 0.01) {
    securityLog('PAYMENT_AMOUNT_TAMPERED', ip, { amount, expectedAmount });
    return errorResponse('Valor adulterado detectado.', 422);
  }

  const db = createServiceClient();

  /* Verifica que o usuário existe */
  const { data: user } = await db
    .from('users')
    .select('id, name, cpf')
    .eq('id', userId)
    .maybeSingle();

  if (!user) {
    securityLog('PAYMENT_INVALID_USER', ip, { userId });
    return errorResponse('Usuário não encontrado.', 404);
  }

  /* Busca token do banco ou fallback pro env */
  const { data: cfg } = await db.from('configs').select('mp_access_token').eq('id', 1).single();
  const mpToken = cfg?.mp_access_token || process.env.MP_ACCESS_TOKEN;

  /* ── Se o token do MP estiver configurado, cria pagamento real ── */
  if (mpToken && mpToken.startsWith('APP_USR')) {
    try {
      const idempotencyKey = `pds_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mpToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description: `Recarga de ${coinsQty} Moedas - PIX DA SORTE`,
          payment_method_id: 'pix',
          payer: {
            email: 'pagador@pixdasorte.online',
            first_name: user.name.split(' ')[0],
            identification: { type: 'CPF', number: user.cpf },
          },
        }),
      });

      const mpData = await mpRes.json();

      if (mpData.id && mpData.point_of_interaction?.transaction_data) {
        const txData = mpData.point_of_interaction.transaction_data;

        /* Salva no banco como pending */
        const { data: payment } = await db.from('payments').insert({
          user_id:      userId,
          mp_payment_id: String(mpData.id),
          coins_qty:    coinsQty,
          amount,
          status:       'pending',
          qr_code:      txData.qr_code,
          qr_base64:    txData.qr_code_base64,
        }).select('id').single();

        return NextResponse.json({
          paymentId:  payment?.id,
          mpId:       mpData.id,
          qrCode:     txData.qr_code,
          qrBase64:   txData.qr_code_base64,
        });
      }

      console.error('[payment/create] MP error:', mpData);
    } catch (err) {
      console.error('[payment/create] MP fetch error:', err);
    }
  }

  /* ── Fallback: registra pending sem MP e retorna QR visual ── */
  const fallbackCode = `00020126580014br.gov.bcb.pix0136${user.cpf}520400005303986540${amount.toFixed(2)}5802BR5920Pix da Sorte6009Campinas62070503***6304`;

  const { data: fallbackPayment } = await db.from('payments').insert({
    user_id:   userId,
    coins_qty: coinsQty,
    amount,
    status:    'pending',
    qr_code:   fallbackCode,
  }).select('id').single();

  return NextResponse.json({
    paymentId: fallbackPayment?.id,
    qrCode:    fallbackCode,
    qrBase64:  null,
    fallback:  true,
  });
}

export async function GET()    { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
