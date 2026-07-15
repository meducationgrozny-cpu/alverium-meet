import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://178.154.219.197 https://edu.alverium.ru http://localhost:*;",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL", 
          }
        ],
      },
    ];
  },
};

export default nextConfig;
