import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jszip", "unpdf", "nodemailer"],
  // `next dev` blocks dev assets when the browser host is 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
