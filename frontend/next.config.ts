import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  // Disable image optimization (not available in static export)
  images: { unoptimized: true },
};

export default nextConfig;
