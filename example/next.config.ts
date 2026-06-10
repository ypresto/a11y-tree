import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The workspace packages ship ESM + types; let Next compile them.
  transpilePackages: ['a11y-tree', '@a11y-tree/ai-sdk'],
  // This is a minimal demo; don't fail the build on lint.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
