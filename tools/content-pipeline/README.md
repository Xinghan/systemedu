# systemedu-content-pipeline

**spec 023 Phase 3 — 内容生产流水线 CLI** (本地 dev 用, 生产不装)。

## 用途

把 `~/Dev/systemeduidea/projects/<slug>/README.md` 蓝图 → V5 知识树骨架
→ Claude Code + course_factory/SKILL.md 生成 knode 详细内容 → 打包 tarball
→ 发布到 library-app 服务。

## 安装

```bash
pip install -e tools/content-pipeline
```

会注册命令 `systemedu-content`。

## 工作区

默认在 repo 下 `content-workspace/` (gitignored):

```
content-workspace/
├── blueprints/<slug>/{README.md, README.zh.md}    sync 自 systemeduidea
├── generated/<slug>/                              compile + Claude 生成的成品
│   ├── manifest.json
│   ├── blueprint/{README.md, README.zh.md}
│   ├── tree/knowledge_tree.json
│   └── knodes/<id>/{lesson.md, sections.json, audio_scripts.json, ...}
└── dist/<slug>-<version>.tar.gz                   export 出来的包
```

可通过 `SYSTEMEDU_CONTENT_WORKSPACE` 环境变量覆盖路径。

## 命令

```bash
# 1. sync 蓝图 (一次性 + 后续增量)
systemedu-content blueprint sync ~/Dev/systemeduidea
systemedu-content blueprint sync ~/Dev/systemeduidea --diff
systemedu-content blueprint sync ~/Dev/systemeduidea --slug ai-ant-ethologist

# 2. compile: README → V5 骨架 + 空 knode 目录
systemedu-content compile ai-ant-ethologist
systemedu-content compile --all

# 3. status: 看每个 knode 完成度
systemedu-content status ai-ant-ethologist
# → 表格列出 24 个 module: pending / partial (有 lesson.md 没 sections) / done

# 4. 详细内容生成 (人在 Claude Code 里手动跑)
#   在 Claude Code 里: "用 course_factory/SKILL.md 给 ai-ant-ethologist
#                      生成内容, 保存到 content-workspace/generated/"
#   Claude 按 SKILL 流程跑, 调 content_pipeline.factory_bridge.save_knode()
#   写入 content-workspace/generated/<slug>/knodes/<id>/

# 5. 本地联调: 打包 + 上传到本地 library
systemedu-content login admin --target=http://127.0.0.1:18821
# (打印 JWT, 记下来)
export LIBRARY_ADMIN_TOKEN="<token>"
systemedu-content publish ai-ant-ethologist --target=local --version=1.0.0

# 6. 导出 tarball (不上传, 给云端运维用)
systemedu-content export ai-ant-ethologist --version=1.0.0
# → content-workspace/dist/ai-ant-ethologist-1.0.0.tar.gz

# 7. 上传 tarball 到远端 library
systemedu-content import content-workspace/dist/ai-ant-ethologist-1.0.0.tar.gz \
    --target=https://library.<your-domain> \
    --admin-token=$LIBRARY_ADMIN_TOKEN
```

## 边界

- **不属于 packages/{core, cloud-app, library-app}**, 是 tools/* 之一
- 生产部署时不装它 (cloud-app 不需要 content-pipeline 在生产机器上)
- 它依赖 `systemedu-core` (V5 schema)
- 通过 HTTP API 调 library-app, 不直接读 library DB

详见 `specs/023-content-library/spec.md`。
