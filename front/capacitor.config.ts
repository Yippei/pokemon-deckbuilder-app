import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "studio.pks.app",
  appName: "PKS",
  webDir: "out",
  server: {
    iosScheme: "pks",
    appStartPath: "/mobile.html",
  },
};

export default config;
