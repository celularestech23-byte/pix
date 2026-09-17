import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-poppins', // Keeping the variable name to not break existing CSS
});

export const metadata: Metadata = {
  title: 'PIX DA SORTE — Roleta Oficial de Prêmios',
  description: 'Cadastre-se, gire a roleta e ganhe prêmios instantâneos via PIX. Promoção oficial com Mercado Pago.',
  keywords: 'pix, sorte, roleta, prêmios, dinheiro, mercado pago',
  openGraph: {
    title: 'PIX DA SORTE — Roleta Oficial',
    description: 'Gire e ganhe prêmios instantâneos!',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PIX DA SORTE',
  },
};

export const viewport = {
  themeColor: '#04000F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
