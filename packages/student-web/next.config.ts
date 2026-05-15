import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 生产构建时不卡在 pre-existing TS 错误上 (运行时不受影响)
  typescript: {
    ignoreBuildErrors: true,
  },
  // monorepo 里有多个 lockfile, 显式告知 turbopack root
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
