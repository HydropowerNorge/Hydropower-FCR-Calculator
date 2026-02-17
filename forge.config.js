const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('node:path');

function getS4Config() {
  const endpoint = (process.env.S4_ENDPOINT || 'https://s3.eu-central-1.s4.mega.io')
    .replace(/\/+$/, '');
  const bucket = process.env.S4_BUCKET || 'app';
  const region = process.env.S4_REGION || 'eu-central-1';
  const updatesPrefix = (process.env.S4_UPDATES_PREFIX || 'updates')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const omitAcl = process.env.S4_OMIT_ACL === '1';

  return { endpoint, bucket, region, updatesPrefix, omitAcl };
}

function shouldPublishToS4() {
  return process.env.FORGE_ENABLE_S3_PUBLISHER === '1';
}

function resolvePublicUpdatesBaseUrl() {
  const explicitPublicBase = process.env.S4_PUBLIC_UPDATES_BASE_URL;
  if (typeof explicitPublicBase === 'string' && explicitPublicBase.trim().length > 0) {
    return explicitPublicBase.trim().replace(/\/+$/, '');
  }

  const s4 = getS4Config();
  return `${s4.endpoint}/${s4.bucket}/${s4.updatesPrefix}`;
}

function updateArtifactsBaseUrl(platform, arch) {
  const publicBase = resolvePublicUpdatesBaseUrl();
  return `${publicBase}/${platform}/${arch}`;
}

function resolveWindowsRemoteReleases(arch) {
  // First release has no remote RELEASES yet; make should not fail on sync.
  if (process.env.S4_ENABLE_WINDOWS_REMOTE_RELEASES !== '1') {
    return {};
  }

  return {
    remoteReleases: updateArtifactsBaseUrl('win32', arch)
  };
}

function shouldPublishToGitHub() {
  return Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
}

function hasNonEmptyValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveMacCodeSignConfig() {
  const identity = process.env.MACOS_CODESIGN_IDENTITY || process.env.CSC_NAME;
  if (!hasNonEmptyValue(identity)) {
    return undefined;
  }

  const entitlementsPath = path.join(__dirname, 'resources', 'entitlements.mac.plist');
  return {
    identity: identity.trim(),
    hardenedRuntime: true,
    gatekeeperAssess: false,
    signatureFlags: 'library',
    entitlements: entitlementsPath,
    entitlementsInherit: entitlementsPath
  };
}

function resolveMacNotarizeConfig() {
  if (hasNonEmptyValue(process.env.APPLE_NOTARY_KEYCHAIN_PROFILE)) {
    return {
      tool: 'notarytool',
      keychainProfile: process.env.APPLE_NOTARY_KEYCHAIN_PROFILE.trim()
    };
  }

  if (
    hasNonEmptyValue(process.env.APPLE_API_KEY_PATH) &&
    hasNonEmptyValue(process.env.APPLE_API_KEY_ID) &&
    hasNonEmptyValue(process.env.APPLE_API_ISSUER)
  ) {
    return {
      tool: 'notarytool',
      appleApiKey: process.env.APPLE_API_KEY_PATH.trim(),
      appleApiKeyId: process.env.APPLE_API_KEY_ID.trim(),
      appleApiIssuer: process.env.APPLE_API_ISSUER.trim()
    };
  }

  if (
    hasNonEmptyValue(process.env.APPLE_ID) &&
    hasNonEmptyValue(process.env.APPLE_APP_SPECIFIC_PASSWORD) &&
    hasNonEmptyValue(process.env.APPLE_TEAM_ID)
  ) {
    return {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID.trim(),
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD.trim(),
      teamId: process.env.APPLE_TEAM_ID.trim()
    };
  }

  return undefined;
}

function resolveGitHubRepository() {
  const rawRepository = process.env.GITHUB_REPOSITORY || 'HydropowerNorge/Hydropower-FCR-Calculator';
  const [owner, name] = rawRepository.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid GitHub repository "${rawRepository}". Expected "owner/name".`);
  }

  return { owner, name };
}

function shouldIgnorePackagedFile(file) {
  if (!file) return false;

  // Keep Vite bundles, runtime dependencies, and package metadata in packaged builds.
  if (file.startsWith('/.vite')) return false;
  if (file.startsWith('/node_modules')) return false;
  if (file === '/package.json') return false;

  return true;
}

const s4 = getS4Config();
const macCodeSignConfig = resolveMacCodeSignConfig();
const macNotarizeConfig = resolveMacNotarizeConfig();
const publishers = [];

if (shouldPublishToS4()) {
  publishers.push({
    name: '@electron-forge/publisher-s3',
    config: {
      bucket: s4.bucket,
      endpoint: s4.endpoint,
      region: s4.region,
      folder: s4.updatesPrefix,
      s3ForcePathStyle: true,
      omitAcl: s4.omitAcl,
      public: !s4.omitAcl,
      releaseFileCacheControlMaxAge: 300
    }
  });
}

if (shouldPublishToGitHub()) {
  publishers.push({
    name: '@electron-forge/publisher-github',
    config: {
      repository: resolveGitHubRepository(),
      draft: false,
      prerelease: false,
      force: true
    }
  });
}

module.exports = {
  packagerConfig: {
    ignore: shouldIgnorePackagedFile,
    asar: true,
    name: 'Hydropower',
    icon: './icon',
    arch: ['x64', 'arm64'],
    appBundleId: process.env.MACOS_APP_BUNDLE_ID || 'no.hydropower.desktop',
    appCategoryType: 'public.app-category.utilities',
    osxSign: macCodeSignConfig,
    ...(macCodeSignConfig && macNotarizeConfig ? { osxNotarize: macNotarizeConfig } : {})
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
      config: (arch) => ({
        // Generates RELEASES.json for Squirrel.Mac auto-updates.
        macUpdateManifestBaseUrl: updateArtifactsBaseUrl('darwin', arch)
      })
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: (arch) => ({
        // Optional: enable only after an initial RELEASES file exists remotely.
        ...resolveWindowsRemoteReleases(arch)
      })
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        ...(macCodeSignConfig
          ? {
              additionalDMGOptions: {
                'code-sign': {
                  'signing-identity': macCodeSignConfig.identity,
                  identifier: process.env.MACOS_APP_BUNDLE_ID || 'no.hydropower.desktop'
                }
              }
            }
          : {})
      }
    }
  ],
  publishers,
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.ts',
            config: 'vite.main.config.mjs',
            target: 'main'
          },
          {
            entry: 'src/preload.ts',
            config: 'vite.preload.config.mjs',
            target: 'preload'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs'
          }
        ]
      }
    },
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false
    })
  ]
};
