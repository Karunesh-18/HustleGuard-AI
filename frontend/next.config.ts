import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Required for Capacitor Android: ensures each route has an index.html
  trailingSlash: true,
  // Disable image optimization (not available in static export)
  images: { unoptimized: true },
};

export default nextConfig;
