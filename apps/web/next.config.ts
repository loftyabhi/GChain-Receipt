import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ADMIN_ADDRESS: process.env.ADMIN_ADDRESS,
  },
};

export default nextConfig;
