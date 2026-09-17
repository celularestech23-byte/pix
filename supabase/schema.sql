-- PIX DA SORTE — Schema Supabase
-- Execute este arquivo no SQL Editor do Supabase

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: users (jogadores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  cpf         TEXT UNIQUE NOT NULL,
  phone       TEXT NOT NULL,
  coins       INTEGER NOT NULL DEFAULT 3,
  balance     NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: spins (histórico de giros)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.spins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: payments (pagamentos PIX)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mp_payment_id   TEXT,
  coins_qty       INTEGER NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | failed
  qr_code         TEXT,
  qr_base64       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: withdrawals (solicitações de saque)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL,
  pix_key         TEXT NOT NULL,
  cpf             TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: configs (configurações do admin — sempre 1 linha)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.configs (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  title           TEXT DEFAULT 'PIX DA SORTE',
  prize           TEXT DEFAULT 'Pix de R$ 50',
  participants    TEXT[] DEFAULT ARRAY['Guilherme','Action Cam 4K','Headset Gamer','Pix R$ 100','Tente Novamente','Pix R$ 50','Pedro','Felipe'],
  forced_winner   TEXT DEFAULT '',
  card1_title     TEXT DEFAULT 'ACTION CAM 4K',
  card1_img       TEXT DEFAULT '',
  card2_title     TEXT DEFAULT 'HEADSET GAMER',
  card2_img       TEXT DEFAULT '',
  card3_title     TEXT DEFAULT 'PIX R$ 100',
  card3_img       TEXT DEFAULT '',
  mp_access_token TEXT DEFAULT '',
  mp_webhook_secret TEXT DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Garante que só existe 1 linha de config
INSERT INTO public.configs (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configs ENABLE ROW LEVEL SECURITY;

-- Policies abertas para service_role (server-side apenas)
-- O frontend nunca acessa o Supabase diretamente — tudo via API Routes

-- Permite leitura pública de configs
CREATE POLICY "configs_public_read" ON public.configs FOR SELECT USING (true);

-- Service role tem acesso total (via SUPABASE_SERVICE_ROLE_KEY no servidor)
CREATE POLICY "service_role_users" ON public.users USING (auth.role() = 'service_role');
CREATE POLICY "service_role_spins" ON public.spins USING (auth.role() = 'service_role');
CREATE POLICY "service_role_payments" ON public.payments USING (auth.role() = 'service_role');
CREATE POLICY "service_role_withdrawals" ON public.withdrawals USING (auth.role() = 'service_role');
CREATE POLICY "service_role_configs" ON public.configs USING (auth.role() = 'service_role');

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_configs_updated_at
  BEFORE UPDATE ON public.configs
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
