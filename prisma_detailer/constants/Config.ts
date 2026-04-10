import Constants from "expo-constants";

// Function to get config with fallbacks
const getConfig = () => {
  const config =
    Constants.expoConfig?.extra || (Constants.manifest as any)?.extra || {};
  return config;
};

const config = getConfig();
// API Configuration with fallbacks for testing
export const API_CONFIG = {
  detailerAppUrl: config.detailer_app_url,
  customerAppUrl: config.customer_app_url,
  websocketUrl: config.websockets_url,
};

export const KEY_CONFIGS = {
  googleApiKeys: config.googoleApiKeys,
};
// App Configuration
export const APP_CONFIG = {
  name: Constants.expoConfig?.name || "Prisma Detailer",
  version: Constants.expoConfig?.version || "1.0.0",
  scheme: Constants.expoConfig?.scheme || "prismadetailer",
  projectId:
    Constants.expoConfig?.extra?.eas?.projectId ||
    "12a19ebe-4dc8-457b-99e9-ccc269808a5c",
};

// Missing detailerAppUrl is handled at runtime where needed
