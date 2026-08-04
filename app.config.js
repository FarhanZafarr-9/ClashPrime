// Dynamic app configuration.
//
// Dev detection:
//  - EAS builds set EAS_BUILD_PROFILE to the eas.json profile name.
//  - Local dev (`npx expo start` / `npx expo run:android`) has no
//    EAS_BUILD_PROFILE and NODE_ENV is not 'production'.
//
// Dev builds get their own app name, Android package and iOS bundle id so they
// can be installed side by side with the production build on one device.
const easProfile = process.env.EAS_BUILD_PROFILE;
const isDev =
  easProfile === 'development' ||
  (!easProfile && process.env.NODE_ENV !== 'production');

export default ({ config }) => {
  return {
    ...config,
    name: isDev ? 'ClashPrime Dev' : 'ClashPrime',
    scheme: isDev ? 'clashprimedev' : 'clashprime',
    ios: {
      ...config.ios,
      bundleIdentifier: isDev ? 'com.clashprime.app.dev' : 'com.clashprime.app',
    },
    android: {
      ...config.android,
      package: isDev ? 'com.clashprime.app.dev' : 'com.clashprime.app',
    },
    extra: {
      ...config.extra,
      variant: isDev ? 'development' : 'production',
      commitHash: process.env.EAS_BUILD_GIT_COMMIT_HASH || null,
    },
  };
};
