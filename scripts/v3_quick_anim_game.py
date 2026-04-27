"""快速跑 v3 anim+game 生成 (绕过 ideation/debate)。

用途: 直接验证 kimi-k2.6 的 game/anim HTML 实现能力, 不被前面 9 个 step 的耗时拖累。

流程:
1. 加载 rocket-design knode 27 (推力是什么) 上下文
2. 手动构造 anim + game 的 detail_plan (跳过 step 0-4)
3. 跑 5.5a 静态闸门 (无 LLM, 快速验证 HTML 合规)
4. 调 s50_implement_anim + s50_implement_game (kimi-k2.6 上场)
5. 静态闸门再跑一次 (revise loop 不接, 失败就直接报)
6. 写到 lesson_content_v3 表 (与 v2 完全独立)

调用:
    python scripts/v3_quick_anim_game.py [knode_id]

默认 knode_id=27。产物落到 /tmp/v3_quick_*.html 便于直接预览。
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = "/Users/xinghan/Dev/systemedu"
os.chdir(PROJECT_ROOT)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "src"))
sys.path.insert(0, PROJECT_ROOT)


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


async def main(knode_id: int = 27) -> None:
    from systemedu.course_factory_v3.steps import s00_boot, s50_implement_anim, s50_implement_game
    from systemedu.course_factory_v3.gates.g_a_code_review import CodeReviewGate
    from systemedu.course_factory_v3.progress import Emitter
    from course_factory.factory import ensure_db_tables
    from systemedu.storage.db import LessonContentV3, get_session

    em = Emitter(lambda e, d: log(f"  EVT[{e}]: {str(d)[:160]}"))

    log(f"=== Step 0 boot (rocket-design knode {knode_id}) ===")
    ctx = await s00_boot.run("rocket-design", knode_id, user_id="quick", overrides={}, em=em)
    knode = ctx["knode"]
    log(f"知识点: {knode.get('title')}  (role={knode.get('module_role')}, d={knode.get('difficulty_level')})")
    log(f"core_question: {knode.get('core_question')}")
    log(f"hands_on_components: {knode.get('hands_on_components')}")

    # ---- 手构 detail_plan ----
    hands_on = knode.get("hands_on_components") or [""]
    artifacts = knode.get("acceptance_artifacts") or [{}]
    accept_ref = artifacts[0].get("title", "") if isinstance(artifacts[0], dict) else str(artifacts[0])
    accept_std = (knode.get("acceptance_standard") or [""])[0]

    anim_idea = {
        "idea_id": f"anim_quick_{int(time.time())}",
        "mode": "animation",
        "topic": "推力随时间累积",
        "context_summary": "可视化推力如何持续作用使物体加速",
        "style_key": "space",
        "hands_on_ref": hands_on[0] if hands_on else "",
        "acceptance_ref": accept_ref or accept_std,
        "detail_plan": {
            "style_key": "space",
            "title": "推力的累积",
            "frame_count": 4,
            "layout": {
                "focal_object": "正在加速升空的火箭",
                "secondary_object": "推力箭头 + 速度仪表",
                "canvas_fill": 0.7,
            },
            "asset_plan": [
                "深色星空背景含微弱网格",
                "细长银色火箭主体含尾焰",
                "随时间递增长度的推力箭头(主色 ORBIT 紫)",
                "右侧速度仪表盘 (HUD)",
                "底部时间轴标尺",
            ],
            "persuasion": {
                "learning_claim": "推力 × 时间 = 速度变化,推得越久速度越大",
                "evidence": "4 帧中火箭速度依次 0/15/45/90 m/s",
                "takeaway": "学生能复述: 推力持续时间长,加速效果累积",
            },
            "beats": [
                {"t": 0.0, "action": "enter", "focus": "火箭静止, 推力为 0"},
                {"t": 0.25, "action": "anticipation", "focus": "推力开始, 速度缓慢增加"},
                {"t": 0.5, "action": "main_action", "focus": "推力持续, 速度迅速增加"},
                {"t": 1.0, "action": "settle", "focus": "推力结束, 速度达到峰值"},
            ],
            "frames": [
                {"frame_index": 0, "description": "火箭静止在地面, 推力箭头为 0", "visual_elements": ["地面", "静止火箭"], "narration": "t=0s, v=0"},
                {"frame_index": 1, "description": "推力开始, 火箭刚离地, 速度 15m/s", "visual_elements": ["短推力箭头", "火箭微升"], "narration": "t=1s, v=15m/s"},
                {"frame_index": 2, "description": "推力持续, 火箭明显上升, 速度 45m/s", "visual_elements": ["中等推力箭头", "升空中火箭"], "narration": "t=2s, v=45m/s"},
                {"frame_index": 3, "description": "推力结束, 火箭速度达 90m/s", "visual_elements": ["最长推力箭头", "高空火箭"], "narration": "t=3s, v=90m/s"},
            ],
            "animation_type": "数据变化",
            "user_guide": {
                "what_it_shows": "推力持续作用使火箭速度逐帧累积",
                "observe_points": ["每帧推力箭头长度递增", "速度仪表读数逐帧增大", "火箭位置随帧上升"],
                "controls": "用上一帧 / 下一帧按钮逐帧观察",
                "takeaway": "推力 × 时间 = 速度变化",
            },
        },
    }

    game_idea = {
        "idea_id": f"game_quick_{int(time.time())}",
        "mode": "game",
        "topic": "推力档位实验室",
        "context_summary": "通过滑块调推力大小和持续时间,实时模拟火箭升空高度",
        "style_key": "space",
        "hands_on_ref": hands_on[0] if hands_on else "",
        "acceptance_ref": accept_ref or accept_std,
        "divergence": {
            "chosen_pattern": "Pattern 1: Sandbox Simulation",
        },
        "detail_plan": {
            "style_key": "space",
            "game_mechanic": "拖动两个滑块 (推力 N、持续秒数), 点击发射按钮, 看火箭升空轨迹和最高高度",
            "mechanic_reason": "Pattern 1 Sandbox: 学生通过调参建立推力↔高度的因果直觉",
            "game_concept": "学生调推力 + 持续时间, 看火箭实时升空, 推力 × 时间累积出速度, 速度决定射高",
            "game_title": "推力实验室",
            "visual_focus": "中央火箭升空轨迹 + 滑块控制",
            "visual_storyboard": [
                "初始: 火箭静止在发射台, 滑块均在中位",
                "拖滑块: 数值实时更新, 点击发射后火箭按物理规律加速",
                "完成: 显示峰值高度 + 鼓励再尝试不同参数",
            ],
            "persuasion": {
                "learning_claim": "推力越大、持续越久, 火箭飞得越高",
                "evidence": "调到极端档位时火箭直冲云霄",
                "takeaway": "学生记住: 推力 × 时间 = 速度变化, 速度决定射高",
            },
            "interaction_flow": [
                "拖动推力滑块 (10-100 N)",
                "拖动持续时间滑块 (1-5 s)",
                "点击发射, 火箭加速 → 减速 → 落回",
                "看到峰值高度后, 调整参数再试",
            ],
            "win_condition": "火箭达到 100m 高度",
            "difficulty_hint": "easy",
            "simulation_params": [
                {"param_name": "thrust", "label": "推力", "min": 10, "max": 100, "default": 50, "unit": "N"},
                {"param_name": "duration", "label": "持续时间", "min": 1, "max": 5, "default": 2, "unit": "s"},
            ],
            "scene_description": "深色星空背景, 中央立着一枚银色火箭, 左侧 200px 侧栏含两个 oklch 紫色滑块和一个金色发射按钮, 右上角 HUD 显示当前高度/速度/剩余燃料",
            "user_guide": {
                "goal": "调出能让火箭飞到 100m 的最佳推力组合",
                "controls": [
                    {"element": "推力滑块", "action": "调节推力大小 10-100 N"},
                    {"element": "持续时间滑块", "action": "调节推力持续秒数 1-5 s"},
                    {"element": "发射按钮", "action": "点击开始模拟"},
                ],
                "steps": [
                    "1. 拖动两个滑块设定参数",
                    "2. 点击发射, 看火箭升空",
                    "3. 观察峰值高度, 调整参数再试",
                ],
                "win_condition": "火箭飞到 100m 以上",
                "tips": "推力大不一定最好, 时间长效果更累积",
            },
        },
    }

    # ---- Step 5: 实现 anim + game (kimi-k2.6 上场) ----
    log("=== Step 5 implement anim (kimi-k2.6) ===")
    t0 = time.time()
    anim_html = await s50_implement_anim.implement(anim_idea, ctx, em=em)
    log(f"  anim 完成, 耗时 {time.time()-t0:.1f}s, html 长度={len(anim_html or '')}")

    log("=== Step 5 implement game (kimi-k2.6) ===")
    t0 = time.time()
    game_html = await s50_implement_game.implement(game_idea, ctx, em=em)
    log(f"  game 完成, 耗时 {time.time()-t0:.1f}s, html 长度={len(game_html or '')}")

    # ---- 5.5a 闸门 (无 LLM, 静态正则) ----
    log("=== 5.5a code_review (静态正则) ===")
    gate_a = CodeReviewGate()
    if anim_html:
        res = await gate_a.run(html=anim_html, idea=anim_idea, ctx=ctx, attempt=1)
        log(f"  anim 5.5a verdict={res.verdict}, issues={len(res.issues)}")
        for it in res.issues[:5]:
            log(f"    - {it}")
    if game_html:
        res = await gate_a.run(html=game_html, idea=game_idea, ctx=ctx, attempt=1)
        log(f"  game 5.5a verdict={res.verdict}, issues={len(res.issues)}")
        for it in res.issues[:5]:
            log(f"    - {it}")

    # ---- 写 DB ----
    log("=== 写 DB (lesson_content_v3) ===")
    ensure_db_tables()  # 含 LessonContentV3 新表

    # 构造 v3 风格 course_content
    anim_id = anim_idea["idea_id"]
    game_id = game_idea["idea_id"]
    course_content = {
        "plan_markdown": (
            f"> Module: {knode.get('module_id', '')} · {knode.get('module_role', '')}\n\n"
            f"## 学习目标\n\n这是 v3 (kimi-k2.6) 的快速演示版课程, 仅含 animation + game。\n\n"
            f"## 核心概念: {knode.get('title', '')}\n\n{knode.get('summary', '')[:300]}\n\n"
            f"[[IDEA:{anim_id}]]\n\n"
            f"## 互动游戏\n\n[[IDEA:{game_id}]]\n"
        ),
        "ideas": [
            {k: anim_idea[k] for k in ("idea_id", "mode", "topic", "context_summary", "style_key", "hands_on_ref", "acceptance_ref")},
            {k: game_idea[k] for k in ("idea_id", "mode", "topic", "context_summary", "style_key", "hands_on_ref", "acceptance_ref")},
        ],
        "rendered_sections": {
            anim_id: {
                "mode": "animation", "status": "ready" if anim_html else "failed",
                "html": anim_html or "",
                "story_paragraphs": None, "exercises": None,
                "generation_backend": "kimi-k2.6", "user_guide": "",
            },
            game_id: {
                "mode": "game", "status": "ready" if game_html else "failed",
                "html": game_html or "",
                "story_paragraphs": None, "exercises": None,
                "generation_backend": "kimi-k2.6", "user_guide": "",
            },
        },
        "theories": [],
        "external_resources": {},
        "sections": [],
        "_meta": {
            "version": "v3-quick",
            "generated_at": datetime.now().isoformat(),
            "generator": "scripts/v3_quick_anim_game.py",
            "model": "kimi-k2.6",
        },
    }

    db = get_session()
    try:
        row = db.query(LessonContentV3).filter_by(
            project_name="rocket-design", knode_id=knode_id,
        ).first()
        if row is None:
            row = LessonContentV3(
                project_name="rocket-design", knode_id=knode_id,
                status="ready" if (anim_html and game_html) else "partial",
                course_content=json.dumps(course_content, ensure_ascii=False),
                generated_at=datetime.now(),
            )
            db.add(row)
        else:
            row.status = "ready" if (anim_html and game_html) else "partial"
            row.course_content = json.dumps(course_content, ensure_ascii=False)
            row.generated_at = datetime.now()
        db.commit()
        log(f"  写入 lesson_content_v3 (project=rocket-design, knode_id={knode_id}, status={row.status})")
    finally:
        db.close()

    # ---- 产物存盘便于直接打开预览 ----
    if anim_html:
        out = Path(f"/tmp/v3_quick_anim_k{knode_id}.html")
        out.write_text(anim_html, encoding="utf-8")
        log(f"  anim 存到 {out}")
    if game_html:
        out = Path(f"/tmp/v3_quick_game_k{knode_id}.html")
        out.write_text(game_html, encoding="utf-8")
        log(f"  game 存到 {out}")

    log("=== DONE ===")


if __name__ == "__main__":
    knode_id = int(sys.argv[1]) if len(sys.argv) > 1 else 27
    asyncio.run(main(knode_id))
