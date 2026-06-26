"""页面 + JSON 路由。所有 /sysadmin/* (除 login) 和 /api/admin/* 需登录。"""
from __future__ import annotations

from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from starlette.routing import Route

from . import auth, queries, templates


def _authed(request: Request) -> bool:
    token = request.cookies.get(auth.COOKIE_NAME, "")
    return auth.verify_token(token) is not None


async def login_get(request: Request) -> Response:
    return HTMLResponse(templates.login_page())


async def login_post(request: Request) -> Response:
    form = await request.form()
    user = (form.get("user") or "").strip()
    password = form.get("password") or ""
    if not auth.verify_admin(user, password):
        return HTMLResponse(templates.login_page("账号或密码错误"), status_code=401)
    resp = RedirectResponse("/sysadmin", status_code=303)
    resp.set_cookie(auth.COOKIE_NAME, auth.issue_token(user), httponly=True, max_age=auth.TOKEN_TTL_HOURS * 3600, samesite="lax")
    return resp


async def logout(request: Request) -> Response:
    resp = RedirectResponse("/sysadmin/login", status_code=303)
    resp.delete_cookie(auth.COOKIE_NAME)
    return resp


async def users_list(request: Request) -> Response:
    if not _authed(request):
        return RedirectResponse("/sysadmin/login", status_code=303)
    return HTMLResponse(templates.users_page(queries.list_users()))


async def user_detail(request: Request) -> Response:
    if not _authed(request):
        return RedirectResponse("/sysadmin/login", status_code=303)
    d = queries.user_detail(request.path_params["uid"])
    if d is None:
        return HTMLResponse("<p>用户不存在</p>", status_code=404)
    return HTMLResponse(templates.detail_page(d))


async def api_users(request: Request) -> Response:
    if not _authed(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return JSONResponse(queries.list_users())


async def project_requests_list(request: Request) -> Response:
    if not _authed(request):
        return RedirectResponse("/sysadmin/login", status_code=303)
    return HTMLResponse(templates.project_requests_page(queries.list_project_requests()))


async def api_project_requests(request: Request) -> Response:
    if not _authed(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return JSONResponse(queries.list_project_requests())


ROUTES = [
    Route("/sysadmin/login", login_get, methods=["GET"]),
    Route("/sysadmin/login", login_post, methods=["POST"]),
    Route("/sysadmin/logout", logout, methods=["GET", "POST"]),
    Route("/sysadmin", users_list, methods=["GET"]),
    Route("/sysadmin/users/{uid}", user_detail, methods=["GET"]),
    Route("/sysadmin/project-requests", project_requests_list, methods=["GET"]),
    Route("/api/admin/users", api_users, methods=["GET"]),
    Route("/api/admin/project-requests", api_project_requests, methods=["GET"]),
]
