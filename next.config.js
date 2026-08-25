/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Inventory imports are uploaded through a Server Action; allow files up
      // to the 5 MB app cap (default is 1 MB).
      bodySizeLimit: "6mb",
    },
  },
};

module.exports = nextConfig;
