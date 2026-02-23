import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize package imports - tree-shakes barrel exports
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
    ],
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Enable React strict mode for better debugging
  reactStrictMode: true,

  // Reduce powered-by header exposure
  poweredByHeader: false,
};

export default nextConfig;
