"""平台知识树 Pydantic schema (spec 035).

约束 (validator 强制):
1. 所有 prerequisites 必须指向**同一学科**内已存在的节点 ID (跨学科 prereq 禁止)
2. 不允许 prereq 成环 (DAG)
3. node id 必须 = subject.<category>.<name> 形式 (snake_case)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# 7 档深度, 对应学龄
DepthLevel = Literal["K1", "K3", "K5", "K7", "K9", "K11", "K13"]
# K1=小1-2, K3=小3-4, K5=小5-6, K7=初1-2, K9=初3-高1, K11=高2-高3, K13=本科基础

SubjectId = Literal[
    "math", "phys", "chem", "bio", "cs",
    "elec", "env", "astro", "med", "eng", "geo",
]


class TreeNode(BaseModel):
    id: str = Field(..., description="<subject>.<category>.<name>, snake_case")
    name_zh: str
    name_en: str
    depth_level: DepthLevel
    prerequisites: list[str] = Field(default_factory=list)
    description: str


class Subject(BaseModel):
    id: SubjectId
    name_zh: str
    name_en: str
    color: str = Field(..., pattern=r"^#[0-9A-Fa-f]{6}$")
    nodes: list[TreeNode]

    @model_validator(mode="after")
    def validate_prereqs_in_subject(self) -> Subject:
        """prereq 只能指向本学科内已有节点 ID, 不允许跨学科."""
        node_ids = {n.id for n in self.nodes}
        for n in self.nodes:
            if not n.id.startswith(f"{self.id}."):
                raise ValueError(
                    f"node id {n.id!r} must start with '{self.id}.'"
                )
            for pid in n.prerequisites:
                if not pid.startswith(f"{self.id}."):
                    raise ValueError(
                        f"node {n.id!r} prereq {pid!r} 跨学科, 禁止 (spec 035 第一版每学科独立)"
                    )
                if pid not in node_ids:
                    raise ValueError(
                        f"node {n.id!r} prereq {pid!r} 不存在于学科 {self.id}"
                    )
        # 环检测 (DFS)
        graph = {n.id: list(n.prerequisites) for n in self.nodes}
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {nid: WHITE for nid in graph}

        def dfs(u: str) -> None:
            color[u] = GRAY
            for v in graph[u]:
                if color[v] == GRAY:
                    raise ValueError(f"prereq 成环: {u} -> {v}")
                if color[v] == WHITE:
                    dfs(v)
            color[u] = BLACK

        for nid in graph:
            if color[nid] == WHITE:
                dfs(nid)
        return self


class PlatformTree(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    subjects: list[Subject]

    @model_validator(mode="after")
    def validate_unique_subjects(self) -> PlatformTree:
        ids = [s.id for s in self.subjects]
        if len(ids) != len(set(ids)):
            raise ValueError(f"subject id 重复: {ids}")
        return self

    def total_node_count(self) -> int:
        return sum(len(s.nodes) for s in self.subjects)

    def find_node(self, node_id: str) -> TreeNode | None:
        for s in self.subjects:
            for n in s.nodes:
                if n.id == node_id:
                    return n
        return None

    def get_subject(self, subject_id: str) -> Subject | None:
        for s in self.subjects:
            if s.id == subject_id:
                return s
        return None


_DEFAULT_PATH = Path(__file__).parent / "platform_tree.json"


def load_platform_tree(path: Path | None = None) -> PlatformTree:
    p = path or _DEFAULT_PATH
    with p.open(encoding="utf-8") as f:
        data = json.load(f)
    return PlatformTree(**data)
