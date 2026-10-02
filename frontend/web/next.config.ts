import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* Allow CORS and clean media asset loading */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  /* Proxy all /api/* requests to the Flask backend so frontend fetch()
     calls using http://localhost:5000 (or any NEXT_PUBLIC_API_URL) Just Work. */
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${base}/api/:path`,
      },
    ];
  },
};

export default nextConfig;
