import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  allowedDevOrigins: ["192.168.1.238", "localhost"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "192.168.1.238:3000",
      ],
    },
  },
};

export default nextConfig;
