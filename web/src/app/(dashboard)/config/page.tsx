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
import { useT } from "@/lib/hooks/use-t"

export default function ConfigPage() {
  const config = useAppStore((s) => s.config)
  const [saving, setSaving] = useState(false)
  const [defaultProvider, setDefaultProvider] = useState("")
  const t = useT()

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
      toast.success(t("config.saved"))
    } catch (e: unknown) {
      toast.error(`${t("config.save_error")} ${e instanceof Error ? e.message : "未知错误"}`)
    }
    setSaving(false)
  }

  return (
    <>
      <AppHeader title={t("config.title")} />
      <div className="p-8 space-y-8 max-w-2xl">
        {/* LLM config */}
        <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                <Settings className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{t("config.llm")}</h2>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <Label>{t("config.default_provider")}</Label>
              <Input
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                placeholder="qwen"
                className="mt-2"
              />
            </div>

            <div className="h-px bg-border" />

            <div>
              <Label className="mb-4 block">{t("config.providers")}</Label>
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
                          <Badge>{t("config.default_badge")}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("config.model")} {prov.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("config.api")} {prov.base_url}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("config.key")} {prov.api_key} · {t("config.temperature")} {prov.temperature}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-base text-muted-foreground">{t("config.load_error")}</p>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-5 w-5 mr-2" />
              {saving ? t("config.saving") : t("config.save")}
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
              <h2 className="text-lg font-bold text-foreground">{t("config.system")}</h2>
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-base font-medium text-foreground">{t("config.sandbox")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("config.sandbox_desc")}</p>
              </div>
              <Badge variant={config?.sandbox.enabled ? "default" : "secondary"}>
                {config?.sandbox.enabled ? t("config.enabled") : t("config.disabled")}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-base font-medium text-foreground">{t("config.memory")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("config.backend")} {config?.memory.backend ?? "--"}
                </p>
              </div>
              <Badge variant={config?.memory.enabled ? "default" : "secondary"}>
                {config?.memory.enabled ? t("config.enabled") : t("config.disabled")}
              </Badge>
            </div>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <p className="text-base font-medium text-foreground">Gateway</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {config?.gateway.host}:{config?.gateway.port}
                </p>
              </div>
              <Badge variant="outline">{t("config.running")}</Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
