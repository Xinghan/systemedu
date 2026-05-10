# Research Query 抽取 prompt

你是一位资深英文检索专家,要为下面这个 STEM 知识节点设计 Tavily 搜索的查询词。

## 节点信息

- **项目**: {project_name}
- **学科**: {category}
- **节点标题**: {node_title}
- **节点摘要**: {node_summary}
- **核心驱动问题** (core_question): {core_question}
- **所属里程碑**: {milestone_title}
- **阶段背景** (sub_project core_problem): {sub_project_problem}

## 任务

输出**两个英文查询词**,目标是从 Tavily 搜出与本节点强相关的:
1. **web_query**: 网页/学术资料(论文/科普/教程/数据集),通常 3-7 词
   - 必须含项目领域关键词 + 节点核心概念
   - 例: "Mars HiRISE DEM stereo reconstruction"
   - 不要只写节点标题,要把领域上下文带上

2. **youtube_query**: YouTube 视频检索词,通常 3-6 词
   - 必须英文(YouTube 中文检索命中极低)
   - 例: "Mars HiRISE digital elevation model"
   - 偏向"演示/讲解/教程"类视频,可加 tutorial / explained / demo

## 输出格式

严格输出 JSON,无任何其它文本(包括 ```代码块标记```):

```json
{{"web_query":"...","youtube_query":"..."}}
```

不允许中文,不允许过短(<3 词),不允许通用词(如 "rocket",必须 "rocket nozzle expansion ratio")。
