/** @type {import('next').NextConfig} */

// This is the combined and cleaned up Next.js configuration.
// It removes Sentry and other complexities to ensure a stable build.

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  typescript: {
    // We want to see all type errors during the build.
    ignoreBuildErrors: false,
  },
  eslint: {
    // We want to enforce ESLint rules during the build.
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
};

module.exports = nextConfig;
