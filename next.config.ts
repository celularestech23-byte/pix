/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
