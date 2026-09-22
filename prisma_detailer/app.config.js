/**
 * Dynamic Expo config: extends static app.json (via Expo `config`) and injects URLs from EAS / local env.
 * Function form satisfies expo-doctor when both app.json and app.config.js exist.
 */
module.exports = ({ config }) => {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV || "development";

  const envUrls = {
    production: {
      detailer_app_url: "https://crew.prismavalet.com",
      customer_app_url: "https://client.prismavalet.com",
      websockets_url: "wss://crew.prismavalet.com/ws/support-chat/",
    },
    staging: {
      detailer_app_url: "https://staging.crew.prismavalet.com",
      customer_app_url: "https://staging.client.prismavalet.com",
      websockets_url: "wss://staging.crew.prismavalet.com/ws/support-chat/",
    },
  };

  const selectedUrls = envUrls[appEnv] || envUrls.staging;

  return {
    ...config,
    android: {
      ...(config.android || {}),
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ||
        config.android?.googleServicesFile ||
        "./google-services.json",
    },
    extra: {
      ...(config.extra || {}),
      ...selectedUrls,
      appEnv,
    },
  };
};
