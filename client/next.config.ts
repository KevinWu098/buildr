import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdna.pcpartpicker.com",
        pathname: "/static/forever/images/**",
      },
      {
        protocol: "https",
        hostname: "cdnb.pcpartpicker.com",
        pathname: "/static/forever/images/**",
      },
      {
        protocol: "https",
        hostname: "cdnc.pcpartpicker.com",
        pathname: "/static/forever/images/**",
      },
      {
        protocol: "https",
        hostname: "cdnd.pcpartpicker.com",
        pathname: "/static/forever/images/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
