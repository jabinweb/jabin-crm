const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Types are checked by `pnpm typecheck` in CI. Repeating the check inside `next build`
  // pushed the deploy build past Node's heap limit (OOM during "Running TypeScript"), so
  // it only runs here when asked for with BUILD_TYPECHECK=1.
  typescript: {
    ignoreBuildErrors: process.env.BUILD_TYPECHECK !== '1',
  },
  // The deploy server is small (8 GB shared with other apps) and the webpack compile was
  // OOM-killed at 5.7 GB RSS. Everything below trades a little build speed for a lower peak.
  // Do not raise --max-old-space-size for the build: a bigger heap just lets it grow further.
  experimental: {
    webpackMemoryOptimizations: true,
    // A custom webpack() function turns the build worker off by default — keep it on
    webpackBuildWorker: true,
    serverSourceMaps: false,
  },
  productionBrowserSourceMaps: false,
  webpack: (config, { dev }) => {
    // Deploys build in a fresh container, so the persistent pack cache is never reused there;
    // serializing it only costs memory.
    if (config.cache && !dev) {
      config.cache = Object.freeze({ type: 'memory' });
    }
    return config;
  },
  images: { 
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
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
        // Calls need mic/camera; field GPS needs geolocation. Empty () blocks the browser prompt entirely.
        value: 'camera=(self), microphone=(self), geolocation=(self)',
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

module.exports = withBundleAnalyzer(nextConfig);
