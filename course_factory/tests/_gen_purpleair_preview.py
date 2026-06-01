"""生成任意已生成项目的自包含预览页 (本地验证用)。

用法: python3 _gen_purpleair_preview.py [slug]   (默认 purpleair-airquality-node)

扫 manifest 全部节点, 每节: lesson.md 正文(渲染 markdown + 展开 [[IDEA]]/[[THEORY]] 占位符)
+ anim/game HTML(iframe srcdoc) + theory K1/K3 + 习题 + 本节作业。
输出单个 _<slug>_preview.html, 左栏节点列表 + 右栏 iframe 看每节详情页。
"""
import json
import re
import sys
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


def md_lite(text: str) -> str:
    """极简 markdown -> html (标题/粗体/列表/表格/段落)。"""
    lines = text.split("\n")
    out = []
    in_table = False
    in_ul = False
    in_code = False
    code_buf = []
    for ln in lines:
        raw = ln.rstrip()
        # 围栏代码块 ```lang ... ``` (最高优先级)
        fence = re.match(r"^\s*```(\w*)\s*$", raw)
        if fence:
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                out.append("<pre class=code><code>" + "\n".join(html.escape(c) for c in code_buf) + "</code></pre>")
                code_buf = []
            continue
        if in_code:
            code_buf.append(ln)
            continue
        # 表格
        if raw.startswith("|") and raw.endswith("|"):
            cells = [c.strip() for c in raw.strip("|").split("|")]
            if set("".join(cells)) <= set("-: "):
                continue  # 分隔行
            if not in_table:
                out.append("<table>")
                in_table = True
            tag = "td"
            out.append("<tr>" + "".join(f"<{tag}>{inline(c)}</{tag}>" for c in cells) + "</tr>")
            continue
        elif in_table:
            out.append("</table>")
            in_table = False
        # 列表
        if re.match(r"^\s*[-*] ", raw):
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline(re.sub(r'^\\s*[-*] ', '', raw))}</li>")
            continue
        elif in_ul:
            out.append("</ul>")
            in_ul = False
        # 标题
        m = re.match(r"^(#{1,6}) (.*)$", raw)
        if m:
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            continue
        # 引用
        if raw.startswith(">"):
            out.append(f"<blockquote>{inline(raw.lstrip('> '))}</blockquote>")
            continue
        if raw.strip() == "":
            out.append("")
            continue
        out.append(f"<p>{inline(raw)}</p>")
    if in_code and code_buf:
        out.append("<pre class=code><code>" + "\n".join(html.escape(c) for c in code_buf) + "</code></pre>")
    if in_table:
        out.append("</table>")
    if in_ul:
        out.append("</ul>")
    return "\n".join(out)


def inline(s: str) -> str:
    s = html.escape(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    # 图片 markdown ![alt](url) (youtube 缩略图)
    s = re.sub(r"!\[(.*?)\]\((.*?)\)", r'<img src="\2" alt="\1" style="max-width:240px;border-radius:6px;margin:4px">', s)
    s = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2" target="_blank">\1</a>', s)
    return s


def iframe_block(title: str, raw_html: str) -> str:
    enc = html.escape(raw_html, quote=True)
    return (
        f'<div class="media"><div class="media-h">{html.escape(title)}</div>'
        f'<iframe class="rich" srcdoc="{enc}" loading="lazy"></iframe></div>'
    )


def theory_block(t: dict) -> str:
    parts = [f'<div class="theory"><div class="theory-h">理论: {html.escape(t.get("title",""))} '
             f'<span class="tag">{html.escape(t.get("subject",""))}</span></div>']
    for lb in (t.get("level_bodies") or []):
        lvl = lb.get("level", "")
        body = md_lite(lb.get("body_markdown", ""))
        parts.append(f'<details open><summary>{lvl} 版</summary><div class="lvl">{body}</div></details>')
    for ex in (t.get("exercises") or []):
        parts.append(render_ex(ex))
    parts.append("</div>")
    return "\n".join(parts)


def render_ex(ex: dict) -> str:
    q = html.escape(ex.get("question") or ex.get("prompt") or "")
    typ = ex.get("type", "")
    out = [f'<div class="ex"><b>[{html.escape(typ)}]</b> {q}']
    opts = ex.get("options") or ex.get("choices")
    if opts:
        out.append("<ol type='A'>")
        for o in opts:
            txt = o if isinstance(o, str) else (o.get("text") or o.get("label") or "")
            out.append(f"<li>{html.escape(str(txt))}</li>")
        out.append("</ol>")
    ans = ex.get("answer") or ex.get("correct")
    if ans is not None:
        out.append(f'<div class="ans">答案: {html.escape(str(ans))}</div>')
    if ex.get("explanation"):
        out.append(f'<div class="exp">{html.escape(ex["explanation"])}</div>')
    out.append("</div>")
    return "\n".join(out)


def build_detail(node: dict, proj: Path, detail_dir: Path) -> str:
    d = proj / node["knode_dir"]
    lesson = (d / "lesson.md").read_text(encoding="utf-8") if (d / "lesson.md").exists() else ""
    sections = json.loads((d / "sections.json").read_text(encoding="utf-8")) if (d / "sections.json").exists() else {}
    theories = json.loads((d / "theories.json").read_text(encoding="utf-8")) if (d / "theories.json").exists() else []
    if isinstance(theories, dict):
        theories = theories.get("theories", [])
    assignment = (d / "assignment.md").read_text(encoding="utf-8") if (d / "assignment.md").exists() else ""

    rendered = sections.get("rendered_sections", {})
    theory_by_id = {t["theory_id"]: t for t in theories}

    # 第一步: 把占位符换成唯一 token (不含 markdown 特殊字符), 渲染后再换回真实 HTML 块
    blocks = {}

    def stash(m):
        kind, _id = m.group(1), m.group(2)
        if kind == "THEORY":
            t = theory_by_id.get(_id)
            blk = theory_block(t) if t else f"<i>[缺失 theory {_id}]</i>"
        else:  # IDEA
            rh = rendered.get(_id)
            if not rh:
                blk = f"<i>[缺失 idea {_id}]</i>"
            else:
                raw_html = rh.get("html") if isinstance(rh, dict) else rh
                exs = rh.get("exercises") if isinstance(rh, dict) else None
                if _id.startswith("ex"):
                    if exs:
                        blk = '<div class="exwrap"><div class="media-h">课内习题</div>' + "".join(render_ex(e) for e in exs) + "</div>"
                    else:
                        blk = iframe_block("习题", raw_html or "")
                elif _id.startswith("anim"):
                    blk = iframe_block("互动动画", raw_html or "")
                elif _id.startswith("game"):
                    blk = iframe_block("互动游戏", raw_html or "")
                elif _id.startswith("obj") or _id.startswith("3d"):
                    blk = iframe_block("3D 模型 (可旋转/点击下钻)", raw_html or "")
                elif _id.startswith("kit"):
                    blk = iframe_block("动手套件", raw_html or "")
                else:
                    blk = iframe_block("富媒体", raw_html or "")
        token = f"@@BLOCK{len(blocks)}@@"
        blocks[token] = blk
        return "\n\n" + token + "\n\n"

    body = re.sub(r"\[\[(IDEA|THEORY):([^\]]+)\]\]", stash, lesson)
    body_html = md_lite(body)
    # token 被 md_lite 包成 <p>@@BLOCK0@@</p>, 整段替换回真实 HTML
    for token, blk in blocks.items():
        body_html = body_html.replace(f"<p>{token}</p>", blk).replace(token, blk)
    asg_html = md_lite(assignment) if assignment else "<p><i>无 assignment.md</i></p>"

    page = f"""<!doctype html><meta charset=utf-8>
<title>{html.escape(node['module_id'])} {html.escape(node['title'])}</title>
<style>
body{{margin:0;font-family:system-ui,-apple-system,'PingFang SC';line-height:1.7;color:#191814;background:#FAF9F5}}
.wrap{{max-width:860px;margin:0 auto;padding:24px 28px 80px}}
h1{{font-size:22px;border-bottom:2px solid #D97757;padding-bottom:8px}}
h2{{font-size:18px;margin-top:28px;color:#9A4A2E}}
h3{{font-size:15px;color:#6B6557}}
code{{background:#F1EDDF;padding:1px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:13px}}
pre.code{{background:#191814;color:#F1EDDF;padding:14px 16px;border-radius:10px;overflow-x:auto;font-size:13px;line-height:1.55;margin:14px 0}}
pre.code code{{background:none;padding:0;color:inherit;font-family:'JetBrains Mono',monospace;white-space:pre}}
table{{border-collapse:collapse;margin:12px 0;width:100%}}
td{{border:1px solid #EBE5D6;padding:6px 10px;font-size:14px}}
tr:first-child td{{background:#F1EDDF;font-weight:600}}
blockquote{{border-left:3px solid #ECCFB8;margin:8px 0;padding:4px 14px;background:#F8EDE5;color:#6B6557}}
.media{{margin:18px 0;border:1px solid #D9D1BD;border-radius:10px;overflow:hidden;background:#fff}}
.media-h{{background:#191814;color:#FAF9F5;padding:6px 12px;font-size:13px;font-family:'JetBrains Mono',monospace}}
iframe.rich{{width:100%;height:560px;border:0;display:block}}
.theory{{border:1px solid #EBE5D6;border-radius:10px;padding:14px;margin:16px 0;background:#fff}}
.theory-h{{font-weight:700;color:#9A4A2E;margin-bottom:6px}}
.tag{{font-size:11px;background:#DEE5EC;color:#527B95;padding:1px 7px;border-radius:8px;margin-left:6px}}
details{{margin:8px 0}}summary{{cursor:pointer;font-weight:600;color:#527B95}}
.lvl{{padding:6px 0 6px 12px;border-left:2px solid #ECCFB8}}
.ex{{background:#F8EDE5;border-radius:8px;padding:10px;margin:10px 0;font-size:14px}}
.ans{{color:#9A4A2E;font-weight:600;margin-top:4px}}.exp{{color:#6B6557;font-size:13px}}
img{{vertical-align:top}}
</style>
<div class=wrap>
<h1>{html.escape(node['module_id'])} · {html.escape(node['title'])}</h1>
{body_html}
<h2>本节作业 (assignment.md)</h2>
{asg_html}
</div>"""
    fn = detail_dir / f"{node['module_id']}.html"
    fn.write_text(page, encoding="utf-8")
    return fn.name


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else "purpleair-airquality-node"
    proj = ROOT / "content-workspace/generated" / slug
    if not (proj / "manifest.json").exists():
        print(f"找不到 {proj}/manifest.json")
        sys.exit(1)
    out = HERE / f"_{slug}_preview.html"
    pages_dirname = f"_{slug}_pages"
    detail_dir = HERE / pages_dirname
    detail_dir.mkdir(exist_ok=True)

    manifest = json.loads((proj / "manifest.json").read_text(encoding="utf-8"))
    nodes = manifest["knodes"]
    title = manifest.get("title_zh") or manifest.get("title") or slug
    rows = []
    ok = 0
    for n in nodes:
        d = proj / n["knode_dir"]
        if (d / "lesson.md").exists():
            fn = build_detail(n, proj, detail_dir)
            ok += 1
            stage = n.get("stage") or ""
            rows.append(
                f'<div class="row" data-stage="{html.escape(stage)}">'
                f'<b>{html.escape(n["module_id"])}</b> <span class=st>{html.escape(stage)}</span><br>'
                f'<a href="{pages_dirname}/{fn}" target="detail">{html.escape(n["title"])}</a></div>'
            )
        else:
            rows.append(f'<div class="row miss"><b>{html.escape(n["module_id"])}</b> (未生成)<br><span class=t>{html.escape(n["title"])}</span></div>')

    first = next((n["module_id"] for n in nodes if (proj / n["knode_dir"] / "lesson.md").exists()), None)
    index = f"""<!doctype html><meta charset=utf-8><title>{html.escape(title)} 内容预览 ({ok}/{len(nodes)} 节)</title>
<style>
body{{margin:0;font-family:system-ui,'PingFang SC';display:flex;height:100vh}}
.list{{width:340px;overflow:auto;border-right:1px solid #D9D1BD;background:#F1EDDF;padding:10px}}
.list h3{{margin:6px 4px;color:#9A4A2E;font-size:13px}}
.row{{margin:6px 0;padding:8px 10px;border:1px solid #E3DAC6;border-radius:8px;background:#fff;font-size:13px}}
.row b{{color:#D97757}}.row .st{{font-size:10px;color:#527B95;background:#DEE5EC;padding:0 5px;border-radius:6px}}
.row a{{color:#191814;text-decoration:none}}.row a:hover{{color:#D97757}}
.row.miss{{opacity:.5;background:#faf7f0}}.row .t{{color:#9D978A;font-size:12px}}
iframe.detail{{flex:1;border:0;height:100vh}}
</style>
<div class=list>
<h3>{html.escape(title)} · 已生成 {ok}/{len(nodes)} 节</h3>
{''.join(rows)}
</div>
<iframe name=detail class=detail src="{pages_dirname}/{first}.html"></iframe>
"""
    out.write_text(index, encoding="utf-8")
    print(f"WROTE {out}  ({ok}/{len(nodes)} 节有 lesson.md)")
    print(f"详情页目录: {detail_dir}")


if __name__ == "__main__":
    main()
