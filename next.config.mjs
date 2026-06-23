/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', 'googleapis'],
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Don't add trailing slashes — prevents double-slash issues with extension API
  trailingSlash: false,
  // Allow CORS for extension API routes
  async headers() {
    return [
      {
        source: '/api/extension/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
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
