const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

function getS4Config() {
  const endpoint = (process.env.S4_ENDPOINT || 'https://s3.eu-central-1.s4.mega.io')
    .replace(/\/+$/, '');
  const bucket = process.env.S4_BUCKET || 'app';
  const region = process.env.S4_REGION || 'eu-central-1';
  const updatesPrefix = process.env.S4_UPDATES_PREFIX || 'updates';
  const omitAcl = process.env.S4_OMIT_ACL === '1';

  return { endpoint, bucket, region, updatesPrefix, omitAcl };
}

function updateArtifactsBaseUrl(platform, arch) {
  const s4 = getS4Config();
  return `${s4.endpoint}/${s4.bucket}/${s4.updatesPrefix}/${platform}/${arch}`;
}

const s4 = getS4Config();

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'FCR Calculator',
    icon: './icon',
    arch: ['x64', 'arm64']
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
        // Enables creation of proper Windows update metadata.
        remoteReleases: updateArtifactsBaseUrl('win32', arch)
      })
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO'
      }
    }
  ],
  publishers: [
    {
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
    }
  ],
  plugins: [
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
