import { redirect } from "next/navigation"
import { cookies } from "next/headers"

// `/` 入口: 有 token cookie -> /home, 否则 /login
// 注意: JWT 现在存在 localStorage, 服务端无法读, 所以这里只能 redirect /login
// 客户端 /login 页面里再判断 localStorage, 已登录就跳 /home
export default async function Root() {
  // 客户端会接管: 真有 token 时 LoginPage 的 useEffect 会跳 /home
  redirect("/login")
}
