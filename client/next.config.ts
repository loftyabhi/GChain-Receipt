import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  /* config options here */
  env: {
    ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
  },
};

export default nextConfig;
