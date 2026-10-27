import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "app.atoz.workshop",
  appName: "ATOZ",
  webDir: "shell",
  backgroundColor: "#f3ecdf",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    ...(serverUrl
      ? {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        }
      : {}),
  },
};

export default config;
