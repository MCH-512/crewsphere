
import type {NextConfig} from 'next';

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' https://placehold.co https://*.tile.openstreetmap.org https://unpkg.com data: blob:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://storage.googleapis.com https://www.googleapis.com https://opensky-network.org;
    frame-src 'self';
    object-src 'none';
    form-action 'self';
    base-uri 'self';
    upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();


const nextConfig: NextConfig = {
  /* config options here */
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      { // Allow Firebase Storage images
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      }
    ],
  },
  productionBrowserSourceMaps: true, // For Lighthouse: Missing source maps
  async headers() {
    return [
      {
        source: '/(.*)', // Apply to all routes
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload', // For HSTS
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY', // For Clickjacking
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
            value: "camera=(), microphone=(), geolocation=(), payment=()", // Example: disable features by default
          }
        ],
      },
    ];
  },
};

export default nextConfig;
