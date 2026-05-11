import type { NextConfig } from "next";

// 部署到 IP 时通过路径前缀 /library 提供, 通过 BASE_PATH env 控制
// (dev / 域名场景: 留空)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
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
