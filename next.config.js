/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { 
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  experimental: {
    optimizePackageImports: ['@/components/ui'],
  },
  
  // Security headers — strict CSP only in production (blocks Razorpay on localhost during dev)
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push(
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com https://*.razorpay.com",
            "worker-src 'self' blob:",
            "style-src 'self' 'unsafe-inline' https://*.razorpay.com",
            "img-src 'self' data: https: blob:",
            "font-src 'self' data: https://*.razorpay.com",
            "connect-src 'self' https://*.google.com https://*.googleapis.com https://*.googleusercontent.com https://lh3.googleusercontent.com https://*.razorpay.com https://api.gemini.com",
            "frame-src 'self' https://accounts.google.com https://www.google.com https://*.razorpay.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self' https://*.razorpay.com",
            "frame-ancestors 'self'",
            "upgrade-insecure-requests",
          ].join('; '),
        }
      );
    }

    return [
      {
        source: '/auth/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
