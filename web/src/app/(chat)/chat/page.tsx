"use client"

import Link from "next/link"
import { Plus, History, BookOpen, Settings, HelpCircle, LogOut, ArrowLeft, Zap } from "lucide-react"
import { ChatPanel } from "@/components/chat/chat-panel"
import { useChatStore } from "@/lib/stores/chat-store"
import { useT } from "@/lib/hooks/use-t"

export default function ChatPage() {
  const t = useT()
  const { sessions, activeSessionId, setActiveSession } = useChatStore()

  const newSession = () => setActiveSession(null)

  // Group sessions by date
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const isToday = (d: Date) => d.toDateString() === today.toDateString()
  const isYesterday = (d: Date) => d.toDateString() === yesterday.toDateString()

  const todaySessions = sessions.filter((s) => isToday(s.createdAt))
  const yesterdaySessions = sessions.filter((s) => isYesterday(s.createdAt))
  const olderSessions = sessions.filter((s) => !isToday(s.createdAt) && !isYesterday(s.createdAt))

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#f8f5ff] dark:bg-background">

      {/* ── Left Sidebar ── */}
      <aside className="w-64 shrink-0 flex flex-col h-full bg-white/60 dark:bg-card/60 backdrop-blur-xl border-r border-violet-100/40 dark:border-border/30">

        {/* Brand */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/8 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground font-[var(--font-manrope)]">
              {t("chat.sanctuary_title") || "Cognitive Sanctuary"}
            </h1>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 font-[var(--font-manrope)] pl-7">
            {t("chat.premium_curator") || "Premium AI Curator"}
          </p>
        </div>

        {/* New Chat */}
        <div className="px-4 mb-2">
          <button
            onClick={newSession}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-[var(--font-manrope)] font-semibold text-sm transition-all duration-300
              ${activeSessionId === null
                ? "bg-primary/10 text-primary border-l-4 border-primary"
                : "text-muted-foreground hover:bg-primary/8 hover:text-foreground border-l-4 border-transparent"
              }`}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t("chat.new_chat") || "New Chat"}
          </button>
        </div>

        {/* Session history */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-5 pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#d9daff transparent" }}>

          {todaySessions.length > 0 && (
            <div>
              <h3 className="px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-2 font-[var(--font-manrope)]">
                {t("chat.today") || "Today"}
              </h3>
              <div className="space-y-0.5">
                {todaySessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === activeSessionId}
                    onClick={() => setActiveSession(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {yesterdaySessions.length > 0 && (
            <div>
              <h3 className="px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-2 font-[var(--font-manrope)]">
                {t("chat.yesterday") || "Yesterday"}
              </h3>
              <div className="space-y-0.5">
                {yesterdaySessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === activeSessionId}
                    onClick={() => setActiveSession(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {olderSessions.length > 0 && (
            <div>
              <h3 className="px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] mb-2 font-[var(--font-manrope)]">
                {t("chat.earlier") || "Earlier"}
              </h3>
              <div className="space-y-0.5">
                {olderSessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === activeSessionId}
                    onClick={() => setActiveSession(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-8 font-[var(--font-manrope)]">
              {t("chat.no_sessions") || "No conversations yet"}
            </p>
          )}

          {/* Nav links */}
          <div className="space-y-0.5 pt-2 border-t border-violet-100/40">
            <NavLink icon={<BookOpen className="h-4 w-4" />} label={t("chat.collections") || "Collections"} />
            <NavLink icon={<Settings className="h-4 w-4" />} label={t("chat.settings") || "Settings"} href="/config" />
          </div>
        </nav>

        {/* Bottom: Upgrade + Help/Logout */}
        <div className="px-4 pt-3 pb-5 border-t border-violet-100/40">
          <button className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 mb-3 transition-all hover:scale-[1.02] active:scale-95 font-[var(--font-manrope)] flex items-center justify-center gap-2">
            <Zap className="h-4 w-4" />
            {t("chat.upgrade") || "Upgrade to Pro"}
          </button>
          <div className="flex flex-col gap-0.5">
            <NavLink icon={<HelpCircle className="h-4 w-4" />} label={t("chat.help") || "Help"} small />
            <NavLink icon={<LogOut className="h-4 w-4" />} label={t("chat.sign_out") || "Sign Out"} small />
          </div>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute -top-64 -right-64 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute -bottom-64 -left-32 w-[500px] h-[500px] bg-cyan-500/4 rounded-full blur-[120px] pointer-events-none z-0" />

        <div className="relative z-10 flex-1 min-h-0">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}

interface Session {
  id: string
  agent?: string
  project?: string
  messages: Array<{ content: string }>
  createdAt: Date
}

function SessionItem({ session, active, onClick }: { session: Session; active: boolean; onClick: () => void }) {
  const label = session.messages[0]?.content.slice(0, 35) || "新会话"
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-all duration-200 font-[var(--font-manrope)] ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-primary/6 hover:text-foreground"
      }`}
    >
      <History className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="text-sm truncate">{label}</span>
    </button>
  )
}

function NavLink({ icon, label, href, small }: { icon: React.ReactNode; label: string; href?: string; small?: boolean }) {
  const cls = `flex items-center gap-3 px-4 py-${small ? "2" : "2.5"} text-sm text-muted-foreground hover:text-primary transition-colors font-[var(--font-manrope)] rounded-lg hover:bg-primary/6`
  if (href) return <Link href={href} className={cls}>{icon}{label}</Link>
  return <button className={cls}>{icon}<span>{label}</span></button>
}
