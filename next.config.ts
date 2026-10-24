import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@react-pdf/renderer"],
  // PDFKit loads standard fonts dynamically; include them in the report function.
  outputFileTracingIncludes: {
    "/api/reports": [
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
  experimental: { cpus: 1 },
  // Keep module identity consistent when Windows development dependencies use a junction.
  webpack(config) {
    config.resolve.symlinks = false;
    config.resolveLoader.symlinks = false;
    return config;
  },
};
export default config;
