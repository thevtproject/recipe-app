/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vtproject.my.id',
      },
    ],
    unoptimized: true,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apply to everything except /api/uploads-style image handlers
        // and static assets (Next.js serves these with its own headers).
        source: '/:path*',
        headers: [
          // Defence-in-depth; Cloudflare also sends HSTS but pinning it
          // from the origin means HSTS survives a Cloudflare misconfig.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Block clickjacking — same-origin framing only.
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          // Block MIME sniffing.
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Restrict referer leakage to same-origin by default.
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Light CSP — family app with no 3rd-party scripts. Tighten further
          // if analytics or other CDNs are added.
          // - default-src 'self' for everything
          // - img-src 'self' + data: (avatars/recipes), and our own uploads
          // - style-src 'self' 'unsafe-inline' (shadcn injects style tags)
          // - connect-src 'self' (NextAuth needs to call same-origin API)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Disable powerful browser features we don't use.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
