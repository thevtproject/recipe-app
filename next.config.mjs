/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'recipes.thevtproject.my.id',
      },
    ],
  },
};

export default nextConfig;
