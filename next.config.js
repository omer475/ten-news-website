/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
    domains: [
      'rollcall.com',
      'thehill.com',
      'd15shllkswkct0.cloudfront.net',
      'akns-images.eonline.com',
      'cdn.cnn.com',
      'static01.nyt.com',
      'assets.bwbx.io',
      'media.npr.org',
      'ichef.bbci.co.uk',
      'media.wired.com',
      'techcrunch.com',
      'venturebeat.com',
      'siliconangle.com',
      'reuters.com',
      'bloomberg.com',
      'wsj.com',
      'ft.com',
      'economist.com',
      'guardian.com',
      'bbc.com',
      'cnn.com',
      'foxnews.com',
      'abcnews.go.com',
      'cbsnews.com',
      'nbcnews.com',
      'usatoday.com',
      'latimes.com',
      'washingtonpost.com',
      'nytimes.com',
      'ap.org',
      'afp.com',
      'gettyimages.com',
      'shutterstock.com',
      'unsplash.com',
      'pixabay.com',
      'pexels.com'
    ]
  },
  // Vercel-optimized settings
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  trailingSlash: false,
  // Ensure proper static optimization
  output: 'standalone',
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