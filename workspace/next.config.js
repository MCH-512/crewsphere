
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' https://placehold.co https://picsum.photos https://*.tile.openstreetmap.org https://unpkg.com https://images.unsplash.com data: blob:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' http://127.0.0.1:* https://*.cloudworkstations.dev wss://*.cloudworkstations.dev https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://storage.googleapis.com https://www.googleapis.com https://opensky-network.org https://www.aviationweather.gov *.sentry.io;
    frame-src 'self';
    object-src 'none';
    form-action 'self';
    base-uri 'self';
    upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig = {
  allowedDevOrigins: [
    '*.cloudworkstations.dev'
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
    instrumentationHook: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false, 
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  productionBrowserSourceMaps: true,
  async headers() {
    const defaultHeaders = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          }
        ],
      },
    ];
    const staticCacheHeaders = [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
    return [...defaultHeaders, ...staticCacheHeaders];
  },
};

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
};

const sentryBuildOptions = {
  widenClientFileUpload: true,
  transpileClientSDK: true,
  hideSourceMaps: true,
  tunnelRoute: '/monitoring',
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryBuildOptions);
