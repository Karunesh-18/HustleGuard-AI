import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hustleguard.app",
  appName: "HustleGuard",
  webDir: "out",
  server: {
    // Allow local network IP access for development
    allowNavigation: ["*"],
  },
};

export default config;
