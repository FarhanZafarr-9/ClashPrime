// Dynamic app configuration.
//
// Variant detection:
//  - EAS builds set EAS_BUILD_PROFILE to the eas.json profile name.
//  - Local dev (`npx expo start` / `npx expo run:android`) has no
//    EAS_BUILD_PROFILE and NODE_ENV is not 'production'.
//  - Any unrecognised profile falls back to production, since a build should
//    never be treated as a side-by-side installable by accident.
//
// Every variant gets its own app name, Android package and iOS bundle id so it
// installs side by side with production on one device. Development keeps the
// historical `.dev` suffix so existing development installs are not orphaned;
// `preview` previously fell through to the production identifiers and would
// overwrite a production install.
const VARIANTS = {
  development: { name: 'ClashPrime Dev', scheme: 'clashprimedev', suffix: '.dev' },
  preview: { name: 'ClashPrime Preview', scheme: 'clashprimepreview', suffix: '.preview' },
  production: { name: 'ClashPrime', scheme: 'clashprime', suffix: '' },
};

function resolveVariant() {
  const easProfile = process.env.EAS_BUILD_PROFILE;
  if (easProfile === 'development' || easProfile === 'preview' || easProfile === 'production') {
    return easProfile;
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

const variant = resolveVariant();
const { name, scheme, suffix } = VARIANTS[variant];

export default ({ config }) => {
  return {
    ...config,
    name,
    scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: `com.clashprime.app${suffix}`,
    },
    plugins: [...(config.plugins ?? []), ['expo-sharing', {}]],
    android: {
      ...config.android,
      package: `com.clashprime.app${suffix}`,
    },
    extra: {
      ...config.extra,
      variant,
      commitHash: process.env.EAS_BUILD_GIT_COMMIT_HASH || null,
    },
  };
};
