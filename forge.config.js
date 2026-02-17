const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

function resolveGitHubRepository() {
  const override = process.env.ELECTRON_RELEASE_REPOSITORY;
  if (override) {
    const [owner, name] = override.split('/');
    if (owner && name) {
      return { owner, name };
    }
  }

  const ciRepo = process.env.GITHUB_REPOSITORY;
  if (ciRepo) {
    const [owner, name] = ciRepo.split('/');
    if (owner && name) {
      return { owner, name };
    }
  }

  return {
    owner: 'HydropowerNorge',
    name: 'Hydropower-FCR-Calculator'
  };
}

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
      platforms: ['darwin', 'linux']
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32']
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
      name: '@electron-forge/publisher-github',
      config: {
        repository: resolveGitHubRepository(),
        prerelease: false,
        draft: false,
        force: true,
        generateReleaseNotes: true
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
