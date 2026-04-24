"""Step 5: 并行实现 + Step 5.5 闸门链。阶段 B/C 实现。

每个 idea 走自己的 mode-specific 实现 + 闸门链:
    animation: implement_anim → 5.5a → 5.5b → 5.5c → 5.5f
    game     : implement_game → 5.5a → 5.5b → 5.5c → 5.5e → 5.5f
    exercise : make_exercises (无闸门)
    image    : download_course_image (无闸门)
    diagram  : implement_diagram → 5.5a → 5.5b
    kit      : implement_kit (无闸门)
    story    : implement_story (无闸门)

theory 的 5.5d 在 Step 1.5 之后单独跑(不在本文件)。
"""

from __future__ import annotations

from ..progress import Emitter


async def run(ctx: dict, *, em: Emitter) -> list[dict]:
    # TODO B11-B17 + C9: 并行实现 + 闸门链 + revise loop
    raise NotImplementedError("s50_implement: 阶段 B/C 实现")
