// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
  // Allows importing JSON with resolveJsonModule
  // No extra config needed — tsconfig handles it
};

module.exports = nextConfig;
