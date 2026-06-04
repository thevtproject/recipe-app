/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Trust Nginx proxy headers
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs'],
  },
  // Allow serving uploaded images
  images: {
    domains: ['recipes.thevtproject.my.id', 'localhost'],
  },
  // Security headers (belt-and-suspenders alongside Nginx)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
