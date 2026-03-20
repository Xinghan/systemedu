"""ObjectNeedAnalyzer — uses Planner-style LLM to decide what object(s) a node needs.

Given a knowledge node's title and summary, determines:
1. Whether the topic warrants a 3D object visualization at all
2. Which family it belongs to (rocket / cell / atom / plant / human_body / earth / ...)
3. Which specific variant is needed (e.g. "engine", "nozzle", "nucleus")
   - variant must be a real physical component name, NOT derived from the node title

Output: list[str] of object_keys to create (e.g. ["rocket.engine", "rocket.nozzle"])
        or [] if no new object is needed.

Design:
- Only suggests objects that are NOT already in ObjectRegistry
- Returns at most 3 keys per node (avoid over-creation)
- LLM must choose variant names from a controlled vocabulary per family
"""

from __future__ import annotations

import json
import logging

from deepagents import create_deep_agent
from langchain_core.messages import AIMessage, HumanMessage

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Family definitions: known families + candidate variants per family
# (variants NOT yet in registry become candidates; LLM selects among them)
# ---------------------------------------------------------------------------

_FAMILY_VARIANTS: dict[str, list[str]] = {
    "rocket": [
        "engine",       # rocket engine / combustion chamber cross-section
        "nozzle",       # nozzle bell detail
        "fuel_tank",    # propellant tank structure
        "fairing",      # payload fairing
        "stage",        # multi-stage separation diagram
        "launch_pad",   # launch facility overview
        "guidance",     # guidance system / avionics bay
    ],
    "aircraft": [
        "basic",        # full airplane side view
        "engine",       # jet engine cross-section
        "wing",         # wing airfoil cross-section
        "cockpit",      # cockpit instruments
        "fuselage",     # fuselage cross-section
        "landing_gear", # landing gear mechanism
    ],
    "cell": [
        "plant",        # plant cell (with cell wall, chloroplast)
        "bacteria",     # prokaryotic cell
        "nucleus",      # nucleus detail (nuclear envelope, chromatin)
        "mitochondria", # mitochondrion (cristae)
        "chloroplast",  # chloroplast (thylakoid, stroma)
        "membrane",     # cell membrane bilayer
    ],
    "atom": [
        "hydrogen",     # hydrogen atom (1 proton, 1 electron)
        "carbon",       # carbon atom
        "oxygen",       # oxygen atom
        "molecule_h2o", # water molecule
        "molecule_co2", # carbon dioxide molecule
        "molecule_nacl",# sodium chloride / ionic bond
        "covalent_bond",# covalent bond diagram
    ],
    "plant": [
        "leaf",         # leaf cross-section (palisade, spongy)
        "root",         # root structure (root hair, vascular)
        "flower",       # flower anatomy (stamen, pistil, petal)
        "seed",         # seed structure (embryo, endosperm)
        "stem",         # stem cross-section (xylem, phloem)
    ],
    "human_body": [
        "skeleton",     # skeletal system overview
        "heart",        # heart cross-section (chambers, valves)
        "brain",        # brain lobes (frontal, parietal, etc.)
        "lung",         # lung structure (alveoli)
        "muscle",       # muscle fiber (sarcomere)
        "digestive",    # digestive system overview
        "neuron",       # neuron (axon, dendrite, synapse)
    ],
    "earth": [
        "crust",        # tectonic plate cross-section
        "atmosphere",   # atmospheric layers (troposphere to exosphere)
        "volcano",      # volcano cross-section (magma chamber, vent)
        "core",         # earth core detail
        "ocean_floor",  # ocean floor (trench, mid-ocean ridge)
        "water_cycle",  # water cycle diagram
    ],
    "submarine": [
        "basic",        # submarine side view
        "hull",         # pressure hull cross-section
        "propeller",    # propeller detail
        "sonar",        # sonar array
        "ballast",      # ballast tank system
    ],
    "robot": [
        "basic",        # humanoid robot
        "arm",          # robotic arm (joints, actuators)
        "sensor",       # sensor array (camera, LIDAR)
        "wheel",        # wheeled drive system
    ],
}


def _build_analyzer_prompt(
    existing_keys: set[str],
    families_with_candidates: dict[str, list[str]],
) -> str:
    lines = [
        "你是一位教育游戏物体需求分析师。",
        "",
        "任务：给定一个知识节点的标题和内容，判断该节点是否需要一个新的 3D 教学物体（object）用于游戏可视化。",
        "",
        "判断规则：",
        "1. 只有当知识点直接涉及某个具体物体的结构/原理时，才需要创建 object",
        "   适合创建：火箭发动机原理 → rocket.engine；细胞核结构 → cell.nucleus",
        "   不适合创建：比较概念 / 历史事件 / 抽象公式 / 社会现象 → 不需要 object",
        "2. object_key 格式必须是 family.variant，variant 必须从候选列表中选择",
        "   不允许使用知识点标题作为 variant（如 rocket.为什么先讲安全 是错误的）",
        "3. 最多返回 2 个 object_key",
        "4. 如果不需要任何新 object，返回空列表 []",
        "",
        "已存在于系统中的 object（不需要重复创建）：",
    ]
    for k in sorted(existing_keys):
        lines.append(f"  - {k}")
    lines.append("")
    lines.append("可选的 family 和候选 variant（只能从以下选择）：")
    for family, variants in families_with_candidates.items():
        if variants:
            lines.append(f"  {family}: {', '.join(variants)}")
    lines.append("")
    lines.append("输出格式（严格 JSON，无其他文字）：")
    lines.append('{"needed": ["family.variant", ...]}  // 或 {"needed": []}')
    return "\n".join(lines)


class ObjectNeedAnalyzer:
    """LLM-based analyzer: given a node, decide which object_keys to create."""

    def __init__(self, llm=None):
        self._llm = llm

    async def analyze(self, node_title: str, node_summary: str) -> list[str]:
        """Return list of object_keys that should be created for this node.

        Returns [] if no new object is needed.
        Filters out keys already in ObjectRegistry.
        """
        from systemedu.agents.builtin.gameagent.objects import ObjectRegistry

        existing_keys = set(ObjectRegistry.supported_keys())

        # Build candidate lists (only variants not already in registry)
        families_with_candidates: dict[str, list[str]] = {}
        for family, variants in _FAMILY_VARIANTS.items():
            candidates = [
                v for v in variants
                if f"{family}.{v}" not in existing_keys
            ]
            if candidates:
                families_with_candidates[family] = candidates

        if not families_with_candidates:
            logger.info("ObjectNeedAnalyzer: all standard variants already in registry")
            return []

        system_prompt = _build_analyzer_prompt(existing_keys, families_with_candidates)
        user_prompt = (
            f"知识节点标题：{node_title}\n"
            f"内容简介：{node_summary}\n\n"
            f"请判断是否需要创建新的 object，输出 JSON。"
        )

        try:
            agent = create_deep_agent(
                model=self._llm,
                tools=[],
                system_prompt=system_prompt,
            )
            result = await agent.ainvoke({"messages": [HumanMessage(content=user_prompt)]})

            raw = ""
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content:
                    raw = msg.content.strip()
                    break

            # Strip markdown fences
            if raw.startswith("```"):
                lines = raw.split("\n")
                raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                raw = raw.strip()

            data = json.loads(raw)
            needed: list[str] = data.get("needed", [])

            # Validate: must be family.variant format, must not already exist
            valid_families = set(_FAMILY_VARIANTS.keys())
            filtered: list[str] = []
            for key in needed:
                if "." not in key:
                    logger.warning(f"ObjectNeedAnalyzer: invalid key format {key!r}, skipping")
                    continue
                family, variant = key.split(".", 1)
                if family not in valid_families:
                    logger.warning(f"ObjectNeedAnalyzer: unknown family {family!r} in {key!r}, skipping")
                    continue
                if key in existing_keys:
                    logger.debug(f"ObjectNeedAnalyzer: {key!r} already in registry, skipping")
                    continue
                if variant not in _FAMILY_VARIANTS.get(family, []):
                    logger.warning(
                        f"ObjectNeedAnalyzer: variant {variant!r} not in candidate list "
                        f"for family {family!r}, skipping"
                    )
                    continue
                filtered.append(key)

            logger.info(
                f"ObjectNeedAnalyzer: {node_title!r} → needed={filtered}"
            )
            return filtered[:2]  # max 2 per node

        except Exception:
            logger.exception(f"ObjectNeedAnalyzer failed for {node_title!r}")
            return []
