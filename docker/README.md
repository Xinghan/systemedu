# SystemEdu Docker 部署

本目录提供把 SystemEdu (backend gateway + Next.js web) 容器化的全部资源。

## 文件清单

| 文件 | 作用 |
| --- | --- |
| `Dockerfile.backend` | Python 3.12 + uv workspace, 启 gateway (`:18820`) |
| `Dockerfile.web` | Node 22 多阶段构建 Next.js, 启 `next start` (`:3000`) |
| `docker-compose.yml` | 编排 backend + web (+ 可选 qdrant) |
| `../.dockerignore` | 镜像构建忽略列表 (位于仓库根) |

## 快速开始

### 1. 准备 config

```bash
# 第一次先在宿主机上有 ~/.systemedu/config.yaml
ls ~/.systemedu/config.yaml || (mkdir -p ~/.systemedu && cp ../scripts/install/config.example.yaml ~/.systemedu/config.yaml)
```

### 2. 构建并启动

```bash
# 从仓库根目录跑
docker compose -f docker/docker-compose.yml up -d --build
```

启动后:
- backend: <http://localhost:18820/api/status>
- web: <http://localhost:3000>

### 3. 把宿主机 config 注入容器卷

第一次启动后，把 LLM key 等配置塞进容器:

```bash
docker compose -f docker/docker-compose.yml cp ~/.systemedu/config.yaml backend:/data/config.yaml
docker compose -f docker/docker-compose.yml restart backend
```

或者改 `docker-compose.yml` 直接挂宿主机目录:

```yaml
volumes:
  - ${HOME}/.systemedu:/data
```

## 启用 Mem0 (Qdrant 向量存储)

```bash
docker compose -f docker/docker-compose.yml --profile with-qdrant up -d --build
```

然后改 `~/.systemedu/config.yaml` 里:

```yaml
memory:
  backend: mem0
  enabled: true
  qdrant_url: http://qdrant:6333   # 容器内服务名
```

## 关于 `NEXT_PUBLIC_GATEWAY_URL`

Next.js 把这个 env **在 build 阶段 inline 进 JS bundle**, 浏览器里发的请求会用它直连 backend。所以:

- 本机开发: `http://localhost:18820` (默认值)
- 生产服务器有公网: `https://your-domain.com:18820` 或反代后填 `https://your-domain.com`
- nginx 同源反代 `/api/*` 到 backend: 留空 (前端走相对路径)

构建时覆盖:

```bash
NEXT_PUBLIC_GATEWAY_URL=https://api.systemedu.com \
  docker compose -f docker/docker-compose.yml build web
```

## 常用命令

```bash
# 看日志
docker compose -f docker/docker-compose.yml logs -f backend
docker compose -f docker/docker-compose.yml logs -f web

# 进容器调试
docker compose -f docker/docker-compose.yml exec backend bash
docker compose -f docker/docker-compose.yml exec web sh

# 重启某个服务
docker compose -f docker/docker-compose.yml restart backend

# 停掉 + 清卷 (谨慎: 删 systemedu-home 会丢 DB)
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml down -v
```

## 生产部署 (47.106.220.119) 适配建议

现有 `scripts/deploy.sh` 是 systemd + nginx 方案。要换 Docker:

1. 服务器装 docker + docker compose plugin
2. `git clone` 或 rsync 仓库到 `/opt/systemedu`
3. 把宿主机 `/root/.systemedu` 挂进 backend 容器 (compose volume 改成 bind mount)
4. nginx 配置改成: `/api/* -> http://127.0.0.1:18820`, `/* -> http://127.0.0.1:3000`
5. `docker compose -f docker/docker-compose.yml up -d --build`

## 已知限制

- 镜像里没装 dighuman, 数字人服务暂未容器化 (它是独立 pnpm workspace, 后续可加 `Dockerfile.dighuman`)
- 没装 manim / playwright (course_factory_v3 离线产物管线); 如需在容器内跑课程生成, 改 `Dockerfile.backend` 装 `apt-get install -y ffmpeg` 等
- backend 镜像未 strip __pycache__, 体积约 1.2GB (uv 装的依赖大头是 langchain+openai+sqlalchemy)
