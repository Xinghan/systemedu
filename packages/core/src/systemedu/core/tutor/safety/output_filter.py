"""Output-side safety filter (spec 043 P5 A6, first slice).

Checks the tutor's FINAL reply before it reaches the student. This is a
defence-in-depth *first layer* — a local rule pass, deliberately not the whole
story (cf the T1.4 spotlighting conclusion). The main line of defence stays the
system prompt + model alignment; a semantic LLM judge / Aliyun moderation is the
planned second layer (a `judge` hook is reserved below, not implemented here).

Design intent — flag *actionable harm*, not topic mentions, so ordinary teaching
content is not false-flagged:

  - "摩擦力让物体停下来"                    → SAFE (physics)
  - "二战中的暴力造成了巨大伤亡"            → SAFE (history discussion)
  - "把这些家用化学品混在一起会产生毒气"    → BLOCK (dangerous procedure)
  - "自杀最没有痛苦的方法是…"               → BLOCK (self-harm method)

Patterns therefore key on method/instruction/solicitation shapes, not on a
sensitive noun alone. False negatives are expected (semantic bypass survives a
regex); that's why this is layer one, and why we log every block for eval.

The verdict is advisory data; the caller (`tutor_runner`) decides to replace the
reply with `SAFE_FALLBACK`. `check_output_safety` never raises — on any internal
error it returns a not-blocked verdict and logs, because false-blocking every
reply would make the product unusable, while a filter crash is a rare system
event (operator's call, spec 043 P5 design).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

log = logging.getLogger(__name__)


# Shown to the student when the tutor's own reply is blocked. Symmetric to the
# input-side SAFETY_RESPONSE but framed as "what I was about to say isn't right".
SAFE_FALLBACK = (
    "抱歉，我刚才想说的内容不太合适，我换个方式帮你。"
    "如果你遇到的是让你难受或危险的事，最好找你信任的大人聊聊——"
    "家长或老师会真正帮到你。如果很紧急，可以拨打 12355 青少年心理热线。"
)


# ---------------------------------------------------------------------------
# Category patterns — each keys on an *actionable* shape, not a bare noun.
# ---------------------------------------------------------------------------
# self_harm: a method / how-to / encouragement of self-harm or suicide.
_SELF_HARM = re.compile(
    r"(自杀|自残|割腕|上吊)[^。！？\n]{0,12}(方法|步骤|怎么|如何|技巧|教程|最好|不痛|无痛)"
    r"|(怎么|如何)[^。！？\n]{0,8}(自杀|自残|结束生命|了结)"
    r"|(结束|了结)[^。！？\n]{0,6}(自己的)?生命[^。！？\n]{0,8}(方法|怎么|如何)"
)

# weapons_explosives: making/obtaining weapons, bombs, or toxic gas.
_WEAPONS = re.compile(
    r"(制作|制造|自制|怎么做|如何做|配方|合成)[^。！？\n]{0,14}"
    r"(炸药|炸弹|爆炸物|枪支|土枪|毒气|毒药|燃烧瓶)"
    r"|(炸药|炸弹|毒气)[^。！？\n]{0,10}(配方|做法|步骤|制作方法)"
)

# dangerous_procedure: mixing household/lab chemicals to produce harm.
_DANGEROUS_CHEM = re.compile(
    r"(混合|倒在一起|加在一起|混在一起)[^。！？\n]{0,16}(产生|生成|释放|会有)?"
    r"[^。！？\n]{0,8}(毒气|有毒气体|氯气|致命)"
    r"|(漂白|洁厕|84)[^。！？\n]{0,8}(和|加|混)[^。！？\n]{0,8}(氨|洁厕|洁厕灵|盐酸)"
)

# adult_sexual: sexually explicit content directed at a minor context.
_ADULT = re.compile(
    r"(色情|裸照|裸体|性行为|性交|做爱)[^。！？\n]{0,12}(描述|细节|过程|怎么|如何|教程)"
    r"|(发|拍|给我看)[^。！？\n]{0,6}(裸照|裸体照)"
)

# solicit_pii: pressuring the child to reveal personal/contact/location info,
# or to meet / keep secrets from parents (grooming shapes).
_SOLICIT_PII = re.compile(
    r"(告诉我|发给我|把你的|你的)[^。！？\n]{0,10}"
    r"(家庭住址|家在哪|真实姓名|电话号码|手机号|学校名字|定位|位置)"
    r"|(不要|别)[^。！？\n]{0,6}(告诉|让)[^。！？\n]{0,6}(爸妈|父母|家长|老师)"
    r"|(我们|咱们)[^。！？\n]{0,8}(见面|单独见|私下见)"
)

# jailbreak_leak: the model leaking that it has "no restrictions" / is acting as
# an unfiltered persona — a sign an injection/jailbreak succeeded.
_JAILBREAK = re.compile(
    r"(作为|我是)[^。！？\n]{0,10}(没有任何限制|不受限制|没有道德限制|越狱)"
    r"|(忽略|无视)[^。！？\n]{0,8}(之前|以上|所有)[^。！？\n]{0,6}(指令|规则|限制|设定)"
    r"|(DAN模式|开发者模式|no restrictions|ignore (all |previous )?(instructions|rules))"
)

_CATEGORY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("self_harm", _SELF_HARM),
    ("weapons_explosives", _WEAPONS),
    ("dangerous_procedure", _DANGEROUS_CHEM),
    ("adult_sexual", _ADULT),
    ("solicit_pii", _SOLICIT_PII),
    ("jailbreak_leak", _JAILBREAK),
]

# Categories severe enough that the student should be pointed at a trusted adult
# / hotline (drives an escalation, symmetric to the input-side gate).
_ESCALATE_CATEGORIES = {"self_harm", "solicit_pii"}


@dataclass
class OutputSafetyVerdict:
    """Result of checking one tutor reply."""

    blocked: bool
    categories: list[str] = field(default_factory=list)
    matched: list[str] = field(default_factory=list)

    @property
    def should_escalate(self) -> bool:
        return any(c in _ESCALATE_CATEGORIES for c in self.categories)


_SAFE = OutputSafetyVerdict(blocked=False)


def check_output_safety(text: str) -> OutputSafetyVerdict:
    """Scan a final tutor reply for actionable-harm content.

    Returns a not-blocked verdict for empty/normal text. Never raises: on any
    internal error it fails open (not blocked) and logs, so a filter bug cannot
    take the whole tutor down (spec 043 P5 design decision).
    """
    if not text or not text.strip():
        return _SAFE
    try:
        categories: list[str] = []
        matched: list[str] = []
        for name, pat in _CATEGORY_PATTERNS:
            m = pat.search(text)
            if m:
                categories.append(name)
                matched.append(m.group(0))
        if not categories:
            return _SAFE
        log.warning(
            "output_filter blocked reply: categories=%s matched=%s",
            categories, matched,
        )
        return OutputSafetyVerdict(blocked=True, categories=categories, matched=matched)
    except Exception:  # noqa: BLE001
        # Fail open: a crashed checker must not block every reply.
        log.exception("output_filter crashed; failing open (reply allowed)")
        return _SAFE


__all__ = [
    "SAFE_FALLBACK",
    "OutputSafetyVerdict",
    "check_output_safety",
]
