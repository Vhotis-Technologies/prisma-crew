/**
 * Dynamic Expo config: merges app.json and injects appEnv from EAS / local env.
 */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || "development",
    },
  },
};
