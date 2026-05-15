/** student-web i18n — 极简 zh-CN 默认, EN 占位。 */

export type Locale = "zh" | "en"

const zh = {
  // 顶栏
  "nav.library": "Library",
  "nav.my_projects": "我的项目",
  "nav.account": "账户",
  "nav.logout": "退出登录",
  "nav.login": "登录",
  "nav.register": "注册",

  // /home
  "home.welcome_back": "欢迎回来",
  "home.my_projects": "我的项目",
  "home.empty.title": "你的书架还是空的",
  "home.empty.desc": "去 Library 看看，把感兴趣的项目 Pull 到这里开始学习。",
  "home.empty.cta": "去 Library 看看",
  "home.continue": "继续学习",
  "home.start": "开始学习",
  "home.knode_count": "{n} 个章节",
  "home.last_module": "最后学到: {m}",
  "home.unavailable": "项目暂不可用",

  // Library
  "library.title": "Library",
  "library.subtitle": "选择一个项目，Pull 到你的书架开始学习",
  "library.pull": "Pull 到我的书架",
  "library.pulled": "已在书架，开始学习",
  "library.login_first": "登录后 Pull",
  "library.pulling": "正在 Pull...",
  "library.pulled_toast": "已加入我的书架",

  // Auth
  "auth.login.title": "登录到 SystemEdu",
  "auth.register.title": "注册 SystemEdu 账号",
  "auth.username": "用户名",
  "auth.password": "密码",
  "auth.login.submit": "登录",
  "auth.register.submit": "创建账号",
  "auth.to_register": "还没账号？立即注册",
  "auth.to_login": "已有账号？登录",
  "auth.error_generic": "操作失败",
} as const

const en: Record<keyof typeof zh, string> = {
  "nav.library": "Library",
  "nav.my_projects": "My Projects",
  "nav.account": "Account",
  "nav.logout": "Sign out",
  "nav.login": "Sign in",
  "nav.register": "Sign up",

  "home.welcome_back": "Welcome back",
  "home.my_projects": "My Projects",
  "home.empty.title": "Your shelf is empty",
  "home.empty.desc": "Pull a project from the Library to start learning.",
  "home.empty.cta": "Browse Library",
  "home.continue": "Continue",
  "home.start": "Start",
  "home.knode_count": "{n} modules",
  "home.last_module": "Last: {m}",
  "home.unavailable": "Project unavailable",

  "library.title": "Library",
  "library.subtitle": "Pull a project to your shelf to start learning",
  "library.pull": "Pull to my shelf",
  "library.pulled": "On your shelf — Start",
  "library.login_first": "Sign in to Pull",
  "library.pulling": "Pulling...",
  "library.pulled_toast": "Added to your shelf",

  "auth.login.title": "Sign in to SystemEdu",
  "auth.register.title": "Create your SystemEdu account",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.login.submit": "Sign in",
  "auth.register.submit": "Create account",
  "auth.to_register": "No account? Sign up",
  "auth.to_login": "Already have an account? Sign in",
  "auth.error_generic": "Action failed",
}

const tables: Record<Locale, Record<string, string>> = { zh, en }

export type TranslationKey = keyof typeof zh

let currentLocale: Locale = "zh"

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const tbl = tables[currentLocale]
  let s = tbl[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }
  return s
}
