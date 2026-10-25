import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }, { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
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
