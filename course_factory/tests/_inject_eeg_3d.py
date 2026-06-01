"""把已生成的 3D object HTML 接入 eeg 对应节点 (sections.json + lesson.md)。

3 个节点: M05 头皮电极 / M10 OpenBCI Cyton / M40 录制套件。
每节: ideas[] 加一条 3d_object idea + rendered_sections 加 {mode,status,html,...}
+ media/ 存 3D 副本 + lesson.md 在 anim 占位符后插 3D 占位符。
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EEG = ROOT / "content-workspace/generated/eeg-minecraft-bci/knodes"
ANIM = ROOT / "course_factory/tests/anim"

# (节点目录, 3D源文件, 3D idea_id, media文件名, 物体描述, 锚点anim占位符前缀)
JOBS = [
    ("M05-w0-module", "test_3d_m05_scalp_electrodes.html",
     "obj_m05_scalp_electrodes", "object3d-scalp-electrodes.html",
     "10-20 头皮电极阵列 3D — 点击任一电极下钻看它贴在头皮哪个脑区、量的是什么波。",
     "anim_1779470271874_trin"),
    ("M10-w0-openbci-cyton", "test_3d_m10_openbci_cyton.html",
     "obj_m10_openbci_cyton", "object3d-openbci-cyton.html",
     "OpenBCI Cyton 采集板 3D — 旋转看 8 通道输入、SD 卡槽、电源, 点击下钻每个接口干什么。",
     "anim_1779472627401_ituq"),
    ("M40-w0-50", "test_3d_m40_recording_kit.html",
     "obj_m40_recording_kit", "object3d-recording-kit.html",
     "OpenBCI 录制佩戴套件 3D — 电极帽 + Cyton + 电脑整套怎么连, 点击下钻每件的作用。",
     "anim_1779715878967_nfms"),
]


def main():
    for node_dir, src_name, obj_id, media_name, desc, anchor in JOBS:
        d = EEG / node_dir
        sec_path = d / "sections.json"
        lesson_path = d / "lesson.md"
        src_html = (ANIM / src_name).read_text(encoding="utf-8")

        sections = json.loads(sec_path.read_text(encoding="utf-8"))

        # 已接入则跳过 (幂等)
        existing_ids = {i.get("idea_id") for i in sections.get("ideas", [])}
        if obj_id in existing_ids:
            print(f"{node_dir}: 已有 {obj_id}, 跳过")
            continue

        # 1. media 副本
        media_dir = d / "media"
        media_dir.mkdir(exist_ok=True)
        (media_dir / media_name).write_text(src_html, encoding="utf-8")

        # 2. ideas[] 加 3d idea
        sections.setdefault("ideas", []).append({
            "idea_id": obj_id,
            "mode": "3d_object",
            "topic": desc[:20],
            "context_summary": desc,
            "generation_backend": "threejs_manual",
            "style_key": "aesthetic_manual",
            "mode_reason": "真实物理装置需可旋转可下钻的 3D 展示",
            "hands_on_ref": "",
            "acceptance_ref": "",
            "object_path": f"media/{media_name}",
        })

        # 3. rendered_sections 加 3D html
        sections.setdefault("rendered_sections", {})[obj_id] = {
            "mode": "3d_object",
            "status": "ready",
            "html": src_html,
            "story_paragraphs": None,
            "exercises": None,
            "generation_backend": "threejs_manual",
        }

        sec_path.write_text(json.dumps(sections, ensure_ascii=False, indent=2), encoding="utf-8")

        # 4. lesson.md 在 anchor anim 占位符后插 3D 占位符
        lesson = lesson_path.read_text(encoding="utf-8")
        anchor_ph = f"[[IDEA:{anchor}]]"
        obj_ph = f"[[IDEA:{obj_id}]]"
        if obj_ph in lesson:
            print(f"{node_dir}: lesson 已有 {obj_ph}")
        elif anchor_ph in lesson:
            # 只替换第一次出现
            lesson = lesson.replace(anchor_ph, anchor_ph + "\n\n" + obj_ph, 1)
            lesson_path.write_text(lesson, encoding="utf-8")
        else:
            # 锚点不在则追加到文件末
            lesson = lesson.rstrip() + "\n\n" + obj_ph + "\n"
            lesson_path.write_text(lesson, encoding="utf-8")

        print(f"{node_dir}: 接入 {obj_id} OK (media/{media_name}, lesson 占位符已插)")


if __name__ == "__main__":
    main()
