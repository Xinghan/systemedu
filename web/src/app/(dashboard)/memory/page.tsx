"use client"

import { useEffect, useState } from "react"
import { Sparkles, Trash2, Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { memory, type MemoryFact } from "@/lib/api"
import { toast } from "sonner"

const CATEGORY_LABEL: Record<string, string> = {
  interest: "兴趣",
  goal: "目标",
  skill_level: "技能水平",
  family: "家庭背景",
  preference: "学习偏好",
  misconception: "错误概念",
  other: "其他",
}

export default function MemoryPage() {
  const [byCategory, setByCategory] = useState<Record<string, MemoryFact[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    try {
      const r = await memory.listFacts()
      setByCategory(r.by_category)
      setTotal(r.total)
    } catch (e) {
      toast.error((e as Error).message || "加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleRetire(id: string) {
    if (!confirm("删除这条记忆? AI 将不再用它来回答你.")) return
    try {
      await memory.retireFact(id)
      toast.success("已删除")
      await reload()
    } catch (e) {
      toast.error((e as Error).message || "删除失败")
    }
  }

  const cats = Object.keys(byCategory)

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">我的记忆</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI 导师记住了关于你的 {total} 条事实, 用来个性化回答.
          这些事实仅你可见, 可以随时删除.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : cats.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">还没有记忆</p>
            <p className="text-xs text-muted-foreground mt-1">
              跟 AI 导师聊一段时间后, 它会自动记住关于你的画像
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {cats.map((cat) => (
            <section key={cat} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {CATEGORY_LABEL[cat] || cat}
                </h2>
                <Badge variant="outline" className="text-[10px]">
                  {byCategory[cat].length}
                </Badge>
              </div>
              <div className="space-y-2">
                {byCategory[cat].map((f) => (
                  <Card key={f.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm leading-snug">
                            {f.value}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1.5">
                            <span className="font-mono">{f.key}</span>
                            <span className="mx-2">·</span>
                            <span>scope: {f.scope}</span>
                            {f.library_slug && (
                              <>
                                <span className="mx-2">·</span>
                                <span>{f.library_slug}</span>
                              </>
                            )}
                            <span className="mx-2">·</span>
                            <span>{new Date(f.created_at).toLocaleDateString("zh-CN")}</span>
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetire(f.id)}
                          className="text-destructive shrink-0"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground border-t border-border pt-4 flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          这些记忆只供 AI 导师在跟你对话时使用, 不会分享给其他用户.
          删除后立即从 AI 上下文中移除.
        </span>
      </div>
    </div>
  )
}
