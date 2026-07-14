# Tasks 045: 知识星图"扩展知识"

- [ ] T1 数据管线: `IDEA/content-workspace/_review/concept_layer_scripts/fetch_neighbors.py`
  - 读 EDU concept-galaxy.json 全部 q; wbgetentities 批 50 拉 claims (7 属性);
    收集邻居 QID 去重; 批 50 拉 labels/descriptions (zh|en); 规则过滤 + 截断;
    写 EDU public/galaxy/galaxy-neighbors.json (key=概念 QID)。限速 2s + 增量落盘。
- [ ] T2 数据验收: 覆盖率 >80%, 抽查 10 概念邻居合理性, 无图内 QID 混入。
- [ ] T3 前端状态与数据: ConceptGalaxy 惰性 fetch neighbors; expansion state;
      详情卡 [扩展知识/收起扩展] 按钮 (有数据才显示)。
- [ ] T4 3D 扩展渲染: ring sprite + LineDashedMaterial 虚线 + 放射布局 +
      raycast 点击 + 标签投影; 换选/收起清理。
- [ ] T5 2D 扩展渲染: 空心 circle + 虚线 line + 点击。
- [ ] T6 扩展点详情卡: 名称/关系中文/描述/Wikidata 按钮/问导师提示行; i18n 双语。
- [ ] T7 浏览器验证 (3D/2D 扩展/收起/扩展卡/无 console 错误) + next build。
- [ ] T8 两仓 commit+push; 部署生产; spec 标 shipped。
