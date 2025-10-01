/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  },
  // Disable static optimization for client-side features
  experimental: {
    serverComponentsExternalPackages: []
  },
  // Vercel-optimized settings
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  trailingSlash: false,
  // HIDE DEVELOPER INFORMATION FROM USERS
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    if (!dev) {
      // Disable source maps and dev info in production
      config.devtool = false;
      config.optimization.minimize = true;
    }
    return config;
  },
}

module.exports = nextConfig