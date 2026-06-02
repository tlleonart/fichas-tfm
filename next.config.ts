import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the markdown docs are bundled with the /docs route on Vercel.
  outputFileTracingIncludes: {
    "/docs": ["./docs/**/*.md"],
  },
};

export default nextConfig;
