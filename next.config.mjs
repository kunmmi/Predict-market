/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options",        value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires these
      "style-src 'self' 'unsafe-inline'",                  // Tailwind inline styles
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://deep-index.moralis.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

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

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
