import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 大文件上传 (tarball 可能 50-200MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  // 生产构建时不卡在 TS / ESLint 上 (与 web/ 一致)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
