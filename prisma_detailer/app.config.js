/**
 * Dynamic Expo config: merges app.json and injects appEnv from EAS / local env.
 */
const appJson = require("./app.json");

const appEnv = process.env.EXPO_PUBLIC_APP_ENV || "development";

const envUrls = {
  production: {
    detailer_app_url: "https://detailer.prismavalet.com",
    customer_app_url: "https://client.prismavalet.com",
    websockets_url: "wss://client.prismavalet.com/ws/detailer/",
  },
  staging: {
    detailer_app_url: "https://staging.detailer.prismavalet.com",
    customer_app_url: "https://staging.client.prismavalet.com",
    websockets_url: "wss://staging.client.prismavalet.com/ws/detailer/",
  },
};

const selectedUrls = envUrls[appEnv] || envUrls.staging;

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      ...selectedUrls,
      appEnv,
    },
  },
};
