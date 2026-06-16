/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['chinese-days'],
  webpack: (config) => {
    // chinese-days ships an ESM build that webpack fails to parse
    // (its package.json marks `type: commonjs`). Force the CJS bundle.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'chinese-days$': require.resolve('chinese-days/dist/index.min.js'),
    };
    return config;
  },
};

module.exports = nextConfig;
