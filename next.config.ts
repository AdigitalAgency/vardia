import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Το repo είναι nested μέσα στο workspace του ομίλου· χωρίς αυτό ο Turbopack
  // ψάχνει package.json στον γονικό φάκελο και βγάζει warning.
  turbopack: { root: __dirname },
};

export default nextConfig;
