/**
 * App config from Expo extra: API URLs, keys, and app metadata.
 */
import Constants from "expo-constants";

/** Read `expoConfig.extra` with manifest fallback for older Expo runtimes. */
const getConfig = () => {
  const config =
    Constants.expoConfig?.extra || (Constants.manifest as any)?.extra || {};
  return config;
};

const config = getConfig();

/** Backend and WebSocket base URLs for the detailer app. */
export const API_CONFIG = {
  detailerAppUrl: config.detailer_app_url,
  customerAppUrl: config.customer_app_url,
  websocketUrl: config.websockets_url,
};

// Navigation uses Linking.openURL to the Google Maps app — no embedded map or Places SDK.
/** @deprecated No longer used — detailer app does not call Google APIs directly. */
export const KEY_CONFIGS = {
  googleApiKeys: undefined as string | undefined,
};
/** Display name, version, deep-link scheme, and EAS project id. */
export const APP_CONFIG = {
  name: Constants.expoConfig?.name || "Prisma Detailer",
  version: Constants.expoConfig?.version || "1.0.0",
  scheme: Constants.expoConfig?.scheme || "prismadetailer",
  projectId:
    Constants.expoConfig?.extra?.eas?.projectId ||
    "12a19ebe-4dc8-457b-99e9-ccc269808a5c",
};

// Missing detailerAppUrl is handled at runtime where needed
