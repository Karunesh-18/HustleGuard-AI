import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: 'output: export' has been removed.
  // It conflicted with dynamic Next.js routing (useRouter, API-dependent pages).
  // For Capacitor Android builds, output:export should be applied via a separate
  // build config (e.g., next.config.capacitor.ts) so the web app is unaffected.
  images: { unoptimized: true },
};

export default nextConfig;
