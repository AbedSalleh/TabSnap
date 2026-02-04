import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  transpilePackages: ['@yume-chan'],
  output: 'export',
  images: { unoptimized: true },
  // GitHub Pages hosts at /TabSnap/, so we need this to link assets correctly
  basePath: isProd ? '/TabSnap' : '',
  assetPrefix: isProd ? '/TabSnap/' : '',
};

export default nextConfig;
