/** @type {import('next').NextConfig} */
const nextConfig = {
  // Catch common React bugs (double-invokes effects in dev only — production behaviour is unchanged)
  reactStrictMode: true,

  // Don't advertise the framework to attackers
  poweredByHeader: false,

  // Gzip/brotli compression on all responses
  compress: true,

  // Tree-shake commonly-imported barrel files so e.g. `import { Foo } from "lucide-react"`
  // doesn't pull in every icon. Cuts client bundle size significantly.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "framer-motion",
      "recharts",
    ],
  },

  // Image optimization — modern formats, cached for 1 hour minimum
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
};

export default nextConfig;
