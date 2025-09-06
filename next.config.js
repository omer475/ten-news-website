/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  },
  // Vercel-optimized settings
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  trailingSlash: false,
  // Ensure proper static optimization
  output: 'standalone'
}

module.exports = nextConfig