// next.config.js
// Build trigger: 1774306698953
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const ContentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProd ? '' : "'unsafe-eval'"} https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://hcaptcha.com https://*.hcaptcha.com",
  "img-src 'self' data: blob: https: https://hcaptcha.com https://*.hcaptcha.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss: https://api.stripe.com https://ipapi.co https://*.supabase.co https://*.supabase.in https://hcaptcha.com https://*.hcaptcha.com",
  "frame-src https://js.stripe.com https://hcaptcha.com https://*.hcaptcha.com",
  "base-uri 'self'",
  "form-action 'self'",
  // Allow same-origin iframe embedding for provider dashboard live preview.
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }] : []),
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // Allows importing JSON with resolveJsonModule
  // No extra config needed — tsconfig handles it
};

module.exports = nextConfig;
