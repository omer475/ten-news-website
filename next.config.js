/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: false
  },
  reactStrictMode: true,
  swcMinify: true,
  
  // Vercel optimization
  compress: true,
  poweredByHeader: false,
  
  // Image optimization for Vercel
  images: {
    domains: [],
    unoptimized: false
  },
  
  // Headers for performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
  
  // Redirects for SEO
  async redirects() {
    return []
  }
}

module.exports = nextConfig
