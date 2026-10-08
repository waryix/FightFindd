import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@fightfind/api-client",
    "@fightfind/config",
    "@fightfind/types",
    "@fightfind/ui",
    "@fightfind/utils",
  ],
};

export default nextConfig;
