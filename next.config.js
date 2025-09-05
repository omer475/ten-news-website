/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Vercel-specific optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  images: {
    unoptimized: true
  },
  // Allow news JSON files to be served
  async rewrites() {
    return [
      {
        source: '/tennews_data_:date.json',
        destination: '/tennews_data_:date.json',
      },
    ];
  },
  // Headers for API and static files
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
          { key: 'Cache-Control', value: 'public, s-maxage=60' },
        ],
      },
      {
        source: '/:path*.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
