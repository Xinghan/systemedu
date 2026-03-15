"use client"

import { useEffect, useState } from "react"
import { Sparkles, Terminal } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { SkillInfo } from "@/lib/types/api"

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gateway
      .skills()
      .then(setSkills)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <AppHeader title="Skills" />
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            加载中...
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4" />
            <p>暂无 Skills</p>
            <p className="text-sm">在 ~/.systemedu/skills/ 下创建 SKILL.md</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <Card key={skill.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4" />
                    {skill.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {skill.description || "无描述"}
                  </p>
                  <div className="flex gap-2">
                    {skill.user_invocable && (
                      <Badge className="flex items-center gap-1">
                        <Terminal className="h-3 w-3" />
                        可调用
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs truncate max-w-[180px]">
                      {skill.source.split("/").slice(-2).join("/")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
