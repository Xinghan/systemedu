"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save, Settings, Shield, Loader2, Plug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import type { LLMProviderInfo } from "@/lib/types/api"

interface CreativeForm {
  model: string
  base_url: string
  api_key: string
  temperature: string
  max_tokens: string
  /** 后端返回的原 mask 串，提交时若 api_key 仍等于此值则跳过覆盖 */
  api_key_mask: string
}

function providerToForm(p: LLMProviderInfo): CreativeForm {
  return {
    model: p.model,
    base_url: p.base_url,
    api_key: p.api_key,
    temperature: String(p.temperature ?? ""),
    max_tokens: p.max_tokens != null ? String(p.max_tokens) : "",
    api_key_mask: p.api_key,
  }
}

export default function ConfigPage() {
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const t = useT()
  const [overrideForm, setOverrideForm] = useState<CreativeForm | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // 派生 form：用 store 里的 config 同步 + 用户编辑覆盖
  const baseProvider = config?.llm.providers.creative
  // 当 config 重新拉取（saved 后）替换 store 里的 mask 串时重置 overrideForm
  const baseSig = baseProvider ? baseProvider.api_key + "|" + baseProvider.model + "|" + baseProvider.base_url : ""
  if (baseSig !== savedKey) {
    setSavedKey(baseSig)
    setOverrideForm(null)
  }
  const creative: CreativeForm | null = overrideForm
    ? overrideForm
    : baseProvider
    ? providerToForm(baseProvider)
    : null

  if (!creative) {
    return (
      <>
        <AppHeader title={t("config.title")} />
        <div className="p-8">
          <p className="text-muted-foreground">{t("config.load_error")}</p>
        </div>
      </>
    )
  }

  const handleField = <K extends keyof CreativeForm>(k: K, v: CreativeForm[K]) => {
    setOverrideForm((prev) => {
      const base = prev ?? creative
      if (!base) return prev
      return { ...base, [k]: v }
    })
  }

  const handleTest = async () => {
    if (!creative) return
    setTesting(true)
    // 先保存当前编辑值，再测试
    try {
      await persistCreative(creative)
      const res = await gateway.testLLM("creative")
      if (res.ok) {
        toast.success(t("config.test.ok").replace("{ms}", String(res.latency_ms)))
      } else {
        toast.error(t("config.test.fail").replace("{msg}", res.message))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(t("config.test.fail").replace("{msg}", msg))
    }
    setTesting(false)
  }

  const handleSave = async () => {
    if (!creative) return
    setSaving(true)
    try {
      await persistCreative(creative)
      // 重新拉一次 config 让 mask 重置
      const fresh = await gateway.config()
      setConfig(fresh)
      toast.success(t("config.saved"))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(`${t("config.save_error")} ${msg}`)
    }
    setSaving(false)
  }

  return (
    <>
      <AppHeader title={t("config.title")} />
      <div className="p-8 space-y-8 max-w-2xl">
        {/* Creative LLM 卡片（用户唯一可配的 provider） */}
        <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-950/40">
                <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("config.creative.title")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t("config.creative.desc")}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <Label className="mb-2 block">{t("config.field.model")}</Label>
              <Input
                value={creative.model}
                onChange={(e) => handleField("model", e.target.value)}
                placeholder="glm-5.1"
              />
            </div>
            <div>
              <Label className="mb-2 block">{t("config.field.base_url")}</Label>
              <Input
                value={creative.base_url}
                onChange={(e) => handleField("base_url", e.target.value)}
                placeholder="https://open.bigmodel.cn/api/paas/v4"
              />
            </div>
            <div>
              <Label className="mb-2 block">{t("config.field.api_key")}</Label>
              <Input
                type="password"
                value={creative.api_key}
                onChange={(e) => handleField("api_key", e.target.value)}
                placeholder={t("config.field.api_key_placeholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">{t("config.field.temperature")}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={creative.temperature}
                  onChange={(e) => handleField("temperature", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">{t("config.field.max_tokens")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={creative.max_tokens}
                  onChange={(e) => handleField("max_tokens", e.target.value)}
                  placeholder={t("config.field.max_tokens_placeholder")}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleTest} disabled={testing || saving} variant="secondary">
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4 mr-2" />
                )}
                {testing ? t("config.test.testing") : t("config.test.btn")}
              </Button>
              <Button onClick={handleSave} disabled={saving || testing}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? t("config.saving") : t("config.save")}
              </Button>
            </div>
          </div>
        </div>

        {/* System settings (read-only) */}
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

/** 提交 creative 表单到 gateway。
 *
 * - api_key 等于原 mask 串或为空，提交空字符串（gateway PUT 端会保留旧 key）
 * - max_tokens 空字符串视为 null，传给 gateway
 */
async function persistCreative(form: CreativeForm): Promise<void> {
  const apiKeyToSend = form.api_key === form.api_key_mask ? "" : form.api_key

  const provider: Record<string, unknown> = {
    model: form.model,
    base_url: form.base_url,
    temperature: parseFloat(form.temperature) || 0,
  }
  if (apiKeyToSend !== "") {
    provider.api_key = apiKeyToSend
  }
  if (form.max_tokens !== "") {
    provider.max_tokens = parseInt(form.max_tokens, 10)
  } else {
    provider.max_tokens = null
  }

  await gateway.updateConfig({
    llm: { providers: { creative: provider } },
  })
}
