import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json ustiga CI qiymatlari:
 *   APP_VERSION       — "1.2.0" (git tegidan: v1.2.0)
 *   APP_VERSION_CODE  — butun son, har relizda oshadi (GitHub run raqami)
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const versionCode = Number(process.env.APP_VERSION_CODE);
  return {
    ...(config as ExpoConfig),
    version: process.env.APP_VERSION || config.version,
    android: {
      ...config.android,
      versionCode: Number.isInteger(versionCode) && versionCode > 0 ? versionCode : config.android?.versionCode,
    },
  };
};
