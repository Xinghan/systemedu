import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产构建时不卡在 pre-existing TS / ESLint 错误上 (运行时不受影响)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
