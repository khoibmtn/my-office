/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin', 'googleapis', 'jwks-rsa', 'jose'],
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Don't add trailing slashes — prevents double-slash issues with extension API
  trailingSlash: false,
  // CORS for /api/extension/* is handled per-route in lib/api-auth.ts (no wildcard origin)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}/__/auth/:path*`,
      },
    ]
  },
}

export default nextConfig
