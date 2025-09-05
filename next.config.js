/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel optimized configuration
  experimental: {
    appDir: false
  },
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization for Vercel
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Output configuration for static export if needed
  trailingSlash: false,
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Compression
  compress: true,
  
  // PoweredByHeader
  poweredByHeader: false,
  
  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1, stale-while-revalidate=59'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
