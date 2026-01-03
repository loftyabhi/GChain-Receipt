import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@solana/kit',
    '@solana-program/system',
    '@solana-program/token',
    '@coinbase/cdp-sdk',
    '@reown/appkit',
    '@reown/appkit-adapter-wagmi'
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana/kit': path.resolve(__dirname, '../../node_modules/@solana/kit'),
    };
    return config;
  },
  env: {
    ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
  },
};

export default nextConfig;
