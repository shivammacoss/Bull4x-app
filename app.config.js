/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require('./app.json');

/**
 * EAS / CI sets API_BASE_URL in env at build time; Expo injects it into extra.
 * Local dev: set API_BASE_URL in `.env` (same folder as this file).
 */
module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      apiBaseUrl: process.env.API_BASE_URL || undefined,
    },
  },
};
