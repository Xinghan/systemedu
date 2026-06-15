import { redirect } from "next/navigation"

// 手机号 + 短信验证码登录后, 注册与登录是同一流程 (新手机号自动建号)。
// 旧 /register 路由重定向到 /login。
export default function RegisterPage() {
  redirect("/login")
}
