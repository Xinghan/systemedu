# systemedu-content-pipeline (stub)

**Status**: 占位, 实质实现见 spec 023 Phase 3。

## 用途

内容生产流水线 CLI (本地装, dev 用), 把
`~/Dev/systemeduidea/projects/<slug>/README.md` 蓝图 → V5 知识树 →
Claude Code 生成 knode 详细内容 → 打包 → 发布到 library service。

## 安装 (spec 023 实施后)

```bash
pip install -e tools/content-pipeline
```

会注册命令 `systemedu-content`。

## 命令清单 (spec 023 定义)

```
systemedu-content blueprint sync ~/Dev/systemeduidea
systemedu-content compile <slug>
systemedu-content status <slug>
systemedu-content publish <slug> --target=local
systemedu-content export <slug>
systemedu-content import <tarball> --target=<remote>
```

## 关键边界

- 不属于 packages/{core, cloud-app, library-app}
- 生产部署时**不装**它
- 它依赖 systemedu-core (用 V5 schema + 调 course_factory)
- 通过 HTTP API 调 library-app, 不直接读 library DB

详见 `specs/023-content-library/spec.md`。
