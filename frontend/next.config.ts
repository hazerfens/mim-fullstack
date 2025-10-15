import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images:{
    domains: ['images.pexels.com','lh3.googleusercontent.com', 'images.unsplash.com'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/companies/**',
      },
     
    ],
  }
  /* config options here */
};

export default nextConfig;
