import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "files.taskflow.macwillingham.com",
      },
    ],
  },
};

export default nextConfig;
