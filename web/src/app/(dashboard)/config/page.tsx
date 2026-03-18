"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Save, Settings, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"

export default function ConfigPage() {
  const config = useAppStore((s) => s.config)
  const [saving, setSaving] = useState(false)
  const [defaultProvider, setDefaultProvider] = useState("")

  useEffect(() => {
    if (config) {
      setDefaultProvider(config.llm.default)
    }
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      await gateway.updateConfig({
        llm: { default: defaultProvider },
      })
      toast.success("配置已保存")
    } catch (e: unknown) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : "未知错误"}`)
    }
    setSaving(false)
  }

  return (
    <>
      <AppHeader title="配置" />
      <div className="p-8 space-y-8 max-w-2xl">
        {/* LLM config */}
        <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                <Settings className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">LLM 配置</h2>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <Label>默认提供商</Label>
              <Input
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                placeholder="qwen"
                className="mt-2"
              />
            </div>

            <div className="h-px bg-border" />

            <div>
              <Label className="mb-4 block">已配置的提供商</Label>
              {config?.llm.providers ? (
                <div className="space-y-4">
                  {Object.entries(config.llm.providers).map(([name, prov]) => (
                    <div
                      key={name}
                      className="p-5 rounded-xl border bg-muted/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-base text-foreground">{name}</span>
                        {name === config.llm.default && (
                          <Badge>默认</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        模型: {prov.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        API: {prov.base_url}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        密钥: {prov.api_key} · 温度: {prov.temperature}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-base text-muted-foreground">无法加载配置</p>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-5 w-5 mr-2" />
              {saving ? "保存中..." : "保存更改"}
            </Button>
          </div>
        </div>

        {/* System settings */}
        <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">系统设置</h2>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-base font-medium text-foreground">沙盒</p>
                <p className="text-sm text-muted-foreground mt-1">工具执行安全沙盒</p>
              </div>
              <Badge variant={config?.sandbox.enabled ? "default" : "secondary"}>
                {config?.sandbox.enabled ? "启用" : "禁用"}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-base font-medium text-foreground">记忆系统</p>
                <p className="text-sm text-muted-foreground mt-1">
                  后端: {config?.memory.backend ?? "--"}
                </p>
              </div>
              <Badge variant={config?.memory.enabled ? "default" : "secondary"}>
                {config?.memory.enabled ? "启用" : "禁用"}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-base font-medium text-foreground">Gateway</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {config?.gateway.host}:{config?.gateway.port}
                </p>
              </div>
              <Badge variant="outline">运行中</Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
