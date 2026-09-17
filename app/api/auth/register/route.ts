import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  validateCPF,
  validatePhone,
  sanitizeString,
  sanitizeCPF,
  sanitizePhone,
  parseJsonBody,
  errorResponse,
  securityLog,
} from '@/lib/security';

/* ================================================================
   POST /api/auth/register
   Registra ou recupera um usuário pelo CPF

   Segurança:
   - Valida CPF real (algoritmo completo)
   - Valida telefone real (DDD + 9 dígitos)
   - Sanitiza todos os inputs
   - Apenas via POST (sem GET que poderia expor dados na URL)
   - Limite de 5 cadastros/min por IP (middleware)
================================================================ */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  /* 1. Lê e valida o body */
  const body = await parseJsonBody(req, 5_000);
  if (!body) {
    securityLog('REGISTER_INVALID_BODY', ip);
    return errorResponse('Dados inválidos.', 400);
  }

  const rawName  = String(body.name  ?? '');
  const rawCpf   = String(body.cpf   ?? '');
  const rawPhone = String(body.phone ?? '');

  /* 2. Sanitiza */
  const name  = sanitizeString(rawName, 80);
  const cpf   = sanitizeCPF(rawCpf);
  const phone = sanitizePhone(rawPhone);

  /* 3. Valida */
  if (!name || name.length < 3) {
    return errorResponse('Nome inválido.', 422);
  }
  if (!validateCPF(cpf)) {
    securityLog('REGISTER_INVALID_CPF', ip, { cpf: cpf.substring(0,3) + '***' });
    return errorResponse('CPF inválido.', 422);
  }
  if (!validatePhone(phone)) {
    securityLog('REGISTER_INVALID_PHONE', ip);
    return errorResponse('Telefone inválido.', 422);
  }

  /* 4. Acessa banco com service role (seguro — server side only) */
  const db = createServiceClient();

  try {
    /* Verifica se CPF já existe */
    const { data: existing } = await db
      .from('users')
      .select('id, name, cpf, phone, coins, balance')
      .eq('cpf', cpf)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ user: existing, isNew: false });
    }

    /* Verifica se telefone já existe */
    const { data: byPhone } = await db
      .from('users')
      .select('id, name, cpf, phone, coins, balance')
      .eq('phone', phone)
      .maybeSingle();

    if (byPhone) {
      return NextResponse.json({ user: byPhone, isNew: false });
    }

    /* Cria novo usuário com 3 moedas gratuitas */
    const { data: newUser, error } = await db
      .from('users')
      .insert({ name, cpf, phone, coins: 3, balance: 0 })
      .select('id, name, cpf, phone, coins, balance')
      .single();

    if (error) {
      console.error('[register] Supabase error:', error.message);
      return errorResponse('Erro ao criar conta.', 500);
    }

    return NextResponse.json({ user: newUser, isNew: true }, { status: 201 });

  } catch (err) {
    console.error('[register] Unexpected error:', err);
    return errorResponse('Erro interno.', 500);
  }
}

/* Rejeita qualquer outro método */
export async function GET()    { return errorResponse('Method not allowed.', 405); }
export async function PUT()    { return errorResponse('Method not allowed.', 405); }
export async function DELETE() { return errorResponse('Method not allowed.', 405); }
