import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client para uso no frontend (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client com service role (APENAS no servidor / API Routes)
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

// Tipos TypeScript
export interface User {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  coins: number;
  created_at: string;
}

export interface Spin {
  id: string;
  user_id: string;
  result: string;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  mp_payment_id: string | null;
  coins_qty: number;
  amount: number;
  status: 'pending' | 'approved' | 'failed';
  qr_code: string | null;
  qr_base64: string | null;
  created_at: string;
  updated_at: string;
}

export interface Config {
  id: number;
  title: string;
  prize: string;
  participants: string[];
  forced_winner: string;
  card1_title: string;
  card1_img: string;
  card2_title: string;
  card2_img: string;
  card3_title: string;
  card3_img: string;
  updated_at: string;
}
