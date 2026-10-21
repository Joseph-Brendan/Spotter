import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      { source: "/login", destination: "/auth", permanent: false },
      { source: "/signup", destination: "/auth?view=signup", permanent: false },
      { source: "/reset-password", destination: "/auth?view=reset", permanent: false },
    ];
  },
};

export default nextConfig;
