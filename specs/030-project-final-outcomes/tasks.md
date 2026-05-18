# 030-project-final-outcomes Tasks

**Status**: draft
**Last updated**: 2026-05-18

## Phase 1: Schema + 后端 (~ 1.5h)

- [ ] 1.1 `core/education/models.py` 加 `FinalOutcome` model + `KnowledgeTreeV5.final_outcomes` 字段
- [ ] 1.2 `core/education/services.py` validate_v5_tree 跑通 PurpleAir tree (现有 + 假 final_outcomes)
- [ ] 1.3 看 `library-app/src/library/api.py` `/v1/projects/{slug}` handler, 确认 final_outcomes 透传
- [ ] 1.4 看 `library-app/.../importer.py`, 确认接受新字段 (Pydantic 不报 422)
- [ ] 1.5 `core/library_client/client.py` ProjectMeta dataclass 加 `final_outcomes: list[dict]`
- [ ] 1.6 `from_dict` 加解析
- [ ] 1.7 pytest test_library_client 加 final_outcomes 解析 test
- [ ] 1.8 pytest tests/student/test_library_proxy 加 final_outcomes 透传 test
- [ ] 1.9 跑 pytest 全过
- [ ] 1.10 **P1 commit**: `feat(030-P1): final_outcomes schema + library API 透传`

## Phase 2: PurpleAir 回填 + import (~ 1h)

- [ ] 2.1 手动编辑 `content-workspace/generated/purpleair-airquality-node/tree/knowledge_tree.json`
      顶层加 5 条 final_outcomes (按 plan.md Step 2.1 草稿)
- [ ] 2.2 `version` bump 到 0.3.1
- [ ] 2.3 重新 build tarball (用 `tools/content-pipeline/compile.py` 或 等价命令):
      重新算 manifest sha256 + tar.gz, 输出 `content-workspace/dist/purpleair-airquality-node-0.3.1.tar.gz`
- [ ] 2.4 起 library-app + admin login + import:
      ```bash
      TOKEN=$(curl -s -X POST :18821/admin/auth/login -H 'Content-Type: application/json' \
        -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
      curl -X POST :18821/admin/projects/import -H "Authorization: Bearer $TOKEN" \
        -F "file=@content-workspace/dist/purpleair-airquality-node-0.3.1.tar.gz"
      curl -X POST :18821/admin/projects/purpleair-airquality-node/publish \
        -H "Authorization: Bearer $TOKEN"
      ```
- [ ] 2.5 验证: `curl :18820/api/library/projects/purpleair-airquality-node | \
      python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('final_outcomes') or []))"`
      期望输出 5
- [ ] 2.6 **P2 commit**: `feat(030-P2): PurpleAir 反向回填 5 条 final_outcomes`
      含 tree.json + manifest.json + dist tarball

## Phase 3: student-web UI (~ 1h)

- [ ] 3.1 `packages/student-web/src/lib/api/index.ts` 加 `FinalOutcome` type +
      `LibraryProjectSummary.final_outcomes?: FinalOutcome[]`
- [ ] 3.2 `packages/student-web/src/app/(home)/library/[slug]/page.tsx` §02:
      - 加 `KIND_ICON` map: capability/artifact/service/publication
      - 加 `KIND_LABEL` map (中文)
      - 加 `KIND_TINT` + `KIND_SOFT` map (用设计稿 7 色 domain 调色板)
      - 写 `FinalOutcomeCard` 子组件: round icon + title + description +
        evidence (mono 小字常驻) + related_stage_id chip
      - 替换原 Outcome stub: 如果 `project.final_outcomes?.length` > 0 用真数据,
        否则保留 stub
- [ ] 3.3 浏览器手测: /library/purpleair-airquality-node 显示 5 张产出卡
- [ ] 3.4 截图留档 (`/tmp/snap-outcomes.png`)
- [ ] 3.5 老 cloud-app 回归: `python -c "from systemedu.cloud.gateway.server import create_app; create_app()"`
- [ ] 3.6 **P3 commit**: `feat(030-P3): ProjectHome §02 真数据渲染 FinalOutcome 5 类`

## 验收

- [ ] 全部 P1/P2/P3 task 完成
- [ ] 跑 spec.md 验收 checklist
- [ ] spec.md Status 改 shipped (2026-XX-XX)
- [ ] docs/prd.md Phase checklist 加 spec 030 行
