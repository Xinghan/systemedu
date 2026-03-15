"use client"

import { useEffect, useState } from "react"
import { Save, Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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
    } catch {}
    setSaving(false)
  }

  return (
    <>
      <AppHeader title="配置" />
      <div className="p-6 space-y-6 max-w-2xl">
        {/* LLM config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              LLM 配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>默认提供商</Label>
              <Input
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                placeholder="qwen"
              />
            </div>

            <Separator />

            <div>
              <Label className="mb-2 block">已配置的提供商</Label>
              {config?.llm.providers ? (
                <div className="space-y-3">
                  {Object.entries(config.llm.providers).map(([name, prov]) => (
                    <div
                      key={name}
                      className="p-3 rounded-md border bg-muted/30 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{name}</span>
                        {name === config.llm.default && (
                          <Badge>默认</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        模型: {prov.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        API: {prov.base_url}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        密钥: {prov.api_key} · 温度: {prov.temperature}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">无法加载配置</p>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "保存中..." : "保存更改"}
            </Button>
          </CardContent>
        </Card>

        {/* Other settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">系统设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">沙盒</p>
                <p className="text-xs text-muted-foreground">工具执行安全沙盒</p>
              </div>
              <Badge variant={config?.sandbox.enabled ? "default" : "secondary"}>
                {config?.sandbox.enabled ? "启用" : "禁用"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">记忆系统</p>
                <p className="text-xs text-muted-foreground">
                  后端: {config?.memory.backend ?? "—"}
                </p>
              </div>
              <Badge variant={config?.memory.enabled ? "default" : "secondary"}>
                {config?.memory.enabled ? "启用" : "禁用"}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Gateway</p>
                <p className="text-xs text-muted-foreground">
                  {config?.gateway.host}:{config?.gateway.port}
                </p>
              </div>
              <Badge variant="outline">运行中</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
