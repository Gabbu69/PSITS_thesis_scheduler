import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@react-pdf/renderer"],
  experimental: { cpus: 1 },
  // Keep module identity consistent when Windows development dependencies use a junction.
  webpack(config) {
    config.resolve.symlinks = false;
    config.resolveLoader.symlinks = false;
    return config;
  },
};
export default config;
