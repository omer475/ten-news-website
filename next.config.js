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
  generateEtags: false,
  trailingSlash: false,
  // Ensure proper static optimization (removed 'standalone' for Vercel JSON serving)
  // output: 'standalone',
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