/** student-web i18n 字典 — zh/en 双语。
 *
 * 覆盖: 顶栏导航/账户 + 6 个主页面骨架 (home/library/my-projects/sessions/memory/auth)。
 * 首页 (landing) 有独立 COPY 表 (文案量大), 不在此处, 但复用全局 locale 值。
 */

export type Locale = "zh" | "en"

export const zh = {
  // ── 顶栏 ──
  "nav.home": "首页",
  "nav.library": "项目库",
  "nav.my_projects": "我的项目",
  "nav.sessions": "学习记录",
  "nav.memory": "记忆",
  "nav.account": "账户",
  "nav.logout": "退出登录",
  "nav.login": "登录",
  "nav.register": "注册",
  "nav.search": "搜索项目、模块、概念…",
  "nav.assistant": "AI 助手",

  // ── /home ──
  "home.welcome_back": "欢迎回来",
  "home.my_projects": "我的项目",
  "home.empty.title": "你的书架还是空的",
  "home.empty.desc": "去项目库看看，把感兴趣的项目 Pull 到这里开始学习。",
  "home.empty.cta": "去项目库看看",
  "home.continue": "继续学习",
  "home.start": "开始学习",
  "home.knode_count": "{n} 个章节",
  "home.last_module": "最后学到: {m}",
  "home.unavailable": "项目暂不可用",

  // ── Library ──
  "library.title": "项目库",
  "library.subtitle": "选择一个项目，Pull 到你的书架开始学习",
  "library.pull": "Pull 到我的书架",
  "library.pulled": "已在书架，开始学习",
  "library.login_first": "登录后 Pull",
  "library.pulling": "正在 Pull...",
  "library.pulled_toast": "已加入我的书架",
  "library.filter.all": "全部",
  "library.request.title": "没找到想做的?",
  "library.request.desc": "导师会跟行业作者一起为你定一个项目。",
  "library.request.cta": "申请一个项目",
  "library.sort": "排序",
  "library.sort.recent": "最新",

  // ── My Projects ──
  "myproj.title": "我的项目",
  "myproj.subtitle": "你 Pull 到书架上的项目",
  "myproj.empty.title": "书架还是空的",
  "myproj.empty.desc": "去项目库挑一个项目，Pull 到这里开始。",
  "myproj.empty.cta": "去项目库",
  "myproj.continue": "继续学习",
  "myproj.start": "开始学习",
  "myproj.last_visited": "最近学习",

  // ── Sessions ──
  "sessions.title": "学习记录",
  "sessions.subtitle": "你和 AI 导师的对话记录",
  "sessions.empty.title": "还没有学习记录",
  "sessions.empty.desc": "开始学习一个项目，和 AI 导师对话后会出现在这里。",
  "sessions.resume": "继续",

  // ── Memory ──
  "memory.title": "记忆",
  "memory.subtitle": "AI 记住的关于你的学习与偏好",
  "memory.empty.title": "还没有记忆",
  "memory.empty.desc": "多和 AI 导师对话、多学习，它会逐渐记住你。",
  "memory.fact_count": "{n} 条记忆",

  // ── Auth ──
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

export type TranslationKey = keyof typeof zh

export const en: Record<TranslationKey, string> = {
  "nav.home": "Home",
  "nav.library": "Library",
  "nav.my_projects": "My Projects",
  "nav.sessions": "Sessions",
  "nav.memory": "Memory",
  "nav.account": "Account",
  "nav.logout": "Sign out",
  "nav.login": "Sign in",
  "nav.register": "Sign up",
  "nav.search": "Search projects, modules, concepts…",
  "nav.assistant": "Assistant",

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
  "library.filter.all": "All",
  "library.request.title": "Can't find what you want?",
  "library.request.desc": "A mentor will define a project for you with an industry author.",
  "library.request.cta": "Request a project",
  "library.sort": "Sort",
  "library.sort.recent": "Most recent",

  "myproj.title": "My Projects",
  "myproj.subtitle": "Projects you've pulled to your shelf",
  "myproj.empty.title": "Your shelf is empty",
  "myproj.empty.desc": "Pick a project from the Library and pull it here to start.",
  "myproj.empty.cta": "Browse Library",
  "myproj.continue": "Continue",
  "myproj.start": "Start",
  "myproj.last_visited": "Last visited",

  "sessions.title": "Sessions",
  "sessions.subtitle": "Your conversations with the AI tutor",
  "sessions.empty.title": "No sessions yet",
  "sessions.empty.desc": "Start a project and chat with the AI tutor — sessions will show up here.",
  "sessions.resume": "Resume",

  "memory.title": "Memory",
  "memory.subtitle": "What the AI remembers about your learning and preferences",
  "memory.empty.title": "No memories yet",
  "memory.empty.desc": "Chat with the AI tutor and keep learning — it will gradually remember you.",
  "memory.fact_count": "{n} memories",

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

export const tables: Record<Locale, Record<string, string>> = { zh, en }
