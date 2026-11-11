import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer fails when bundled into server actions; load it from node_modules at runtime.
  serverExternalPackages: ["nodemailer"],
  async redirects() {
    return [
      { source: "/login", destination: "/auth", permanent: false },
      { source: "/signup", destination: "/auth?view=signup", permanent: false },
      { source: "/reset-password", destination: "/auth?view=reset", permanent: false },
    ];
  },
};

export default nextConfig;
