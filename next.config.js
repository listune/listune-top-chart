/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false, // Disable Next.js compression to avoid conflicts with Hostinger/LiteSpeed
  reactStrictMode: true,
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      if (typeof config.externals === 'object' && !Array.isArray(config.externals)) {
        config.externals = [config.externals];
      }
      config.externals.push({
        cheerio: 'commonjs cheerio',
      });
    }
    return config;
  },
}

module.exports = nextConfig
