import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['@solana/kit', '@solana-program/system', '@solana-program/token'],
  env: {
    ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
  },
};

export default nextConfig;
