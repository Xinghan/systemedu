"""内嵌 HTML 渲染 — 简洁表格, 内部工具风格。所有用户输入经 html.escape。"""
from __future__ import annotations

from html import escape as e

_STYLE = """
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#faf9f5;color:#222}
  header{background:#191814;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
  header a{color:#D97757;text-decoration:none}
  main{padding:20px;max-width:1100px;margin:0 auto}
  table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}
  th,td{border:1px solid #e5e0d3;padding:8px 10px;text-align:left}
  th{background:#f1eddf}
  tr:hover{background:#faf7ef}
  a.row{color:#9A4A2E;text-decoration:none;font-weight:600}
  .card{background:#fff;border:1px solid #e5e0d3;border-radius:8px;padding:16px;margin-bottom:16px}
  h2{font-size:16px;margin:0 0 10px}
  details{margin:4px 0}summary{cursor:pointer;color:#666}
  .login{max-width:320px;margin:80px auto}
  input{width:100%;padding:8px;margin:6px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box}
  button{background:#D97757;color:#fff;border:0;padding:8px 16px;border-radius:4px;cursor:pointer}
</style>
"""


def _page(title: str, body: str, show_logout: bool = True) -> str:
    logout = '<a href="/sysadmin/logout">退出</a>' if show_logout else ""
    return f"<!doctype html><html><head><meta charset='utf-8'><title>{e(title)}</title>{_STYLE}</head><body><header><span>SystemEdu 管理后台</span>{logout}</header><main>{body}</main></body></html>"


def login_page(error: str = "") -> str:
    err = f'<p style="color:#c0392b">{e(error)}</p>' if error else ""
    body = f"""<div class="login"><h2>管理员登录</h2>{err}
      <form method="post" action="/sysadmin/login">
        <input name="user" placeholder="账号" autofocus>
        <input name="password" type="password" placeholder="密码">
        <button type="submit">登录</button>
      </form></div>"""
    return _page("登录", body, show_logout=False)


def users_page(rows: list[dict]) -> str:
    trs = ""
    for r in rows:
        trs += (f"<tr><td><a class='row' href='/sysadmin/users/{e(r['id'])}'>{e(r['phone'] or '-')}</a></td>"
                f"<td>{e(r['display_name'] or '-')}</td><td>{e(str(r['student_age']) if r['student_age'] else '-')}</td>"
                f"<td>{e(r['gender'] or '-')}</td><td>{e((r['created_at'] or '')[:19])}</td>"
                f"<td>{e((r['last_login_at'] or '-')[:19])}</td>"
                f"<td>{r['project_count']}</td><td>{r['knode_count']}</td><td>{r['question_count']}</td></tr>")
    body = (f"<h2>注册用户 ({len(rows)})</h2><table><tr><th>手机号</th><th>用户名</th><th>年龄</th>"
            f"<th>性别</th><th>注册时间</th><th>最后登录</th><th>项目</th><th>节点</th><th>提问</th></tr>{trs}</table>")
    return _page("用户列表", body)


def detail_page(d: dict) -> str:
    u = d["user"]
    info = (f"<div class='card'><h2>基本信息</h2>手机号 {e(u['phone'] or '-')} · 用户名 {e(u['display_name'] or '-')} · "
            f"年龄 {e(str(u['student_age']) if u['student_age'] else '-')} · 性别 {e(u['gender'] or '-')} · "
            f"注册 {e((u['created_at'] or '')[:19])}</div>")
    proj_tr = "".join(f"<tr><td>{e(p['library_slug'])}</td><td>{e((p['pulled_at'] or '')[:19])}</td>"
                      f"<td>{e(p['last_module_id'] or '-')}</td><td>{p['knode_count']}</td></tr>" for p in d["projects"])
    projects = (f"<div class='card'><h2>Pull 的项目 ({len(d['projects'])})</h2><table>"
                f"<tr><th>项目</th><th>Pull 时间</th><th>最近学到</th><th>完成节点</th></tr>{proj_tr}</table></div>")
    kn_tr = "".join(f"<tr><td>{e(k['project_slug'])}</td><td>{e(k['knode_id'])}</td><td>{e((k['completed_at'] or '')[:19])}</td></tr>" for k in d["knodes"])
    knodes = (f"<div class='card'><h2>完成的节点 ({len(d['knodes'])})</h2><table>"
              f"<tr><th>项目</th><th>节点</th><th>完成时间</th></tr>{kn_tr}</table></div>")
    q_items = ""
    for q in d["questions"]:
        ans = f"<details><summary>查看 AI 回答</summary><div style='white-space:pre-wrap;color:#444'>{e(q['answer'] or '(无)')}</div></details>" if q["answer"] else ""
        q_items += (f"<div style='border-bottom:1px solid #eee;padding:8px 0'>"
                    f"<div style='color:#999;font-size:12px'>{e(q['library_slug'])} / {e(q['module_id'])} · {e((q['created_at'] or '')[:19])}</div>"
                    f"<div>{e(q['content'])}</div>{ans}</div>")
    questions = f"<div class='card'><h2>问的问题 ({len(d['questions'])})</h2>{q_items or '<p>无</p>'}</div>"
    body = f"<p><a href='/sysadmin'>← 返回列表</a></p>{info}{projects}{knodes}{questions}"
    return _page(f"用户 {u['phone']}", body)
