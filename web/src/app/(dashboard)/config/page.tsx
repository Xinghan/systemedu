"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save, Settings, Shield, Loader2, Plug, Mic } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import type { LLMProviderInfo, TTSInfo } from "@/lib/types/api"

interface CreativeForm {
  model: string
  base_url: string
  api_key: string
  temperature: string
  max_tokens: string
  api_key_mask: string
}

interface TTSForm {
  api_key: string
  model: string
  voice: string
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

function ttsToForm(t: TTSInfo): TTSForm {
  return {
    api_key: t.api_key,
    model: t.model,
    voice: t.voice,
    api_key_mask: t.api_key,
  }
}

export default function ConfigPage() {
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const t = useT()

  const [overrideForm, setOverrideForm] = useState<CreativeForm | null>(null)
  const [overrideTTS, setOverrideTTS] = useState<TTSForm | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [savingTTS, setSavingTTS] = useState(false)
  const [testingTTS, setTestingTTS] = useState(false)

  // 派生 form：用 store 里的 config 同步 + 用户编辑覆盖
  const baseProvider = config?.llm.providers.creative
  const baseTTS = config?.tts
  const baseSig = (
    (baseProvider ? baseProvider.api_key + "|" + baseProvider.model + "|" + baseProvider.base_url : "") +
    "::" +
    (baseTTS ? baseTTS.api_key + "|" + baseTTS.model + "|" + baseTTS.voice : "")
  )
  if (baseSig !== savedKey) {
    setSavedKey(baseSig)
    setOverrideForm(null)
    setOverrideTTS(null)
  }

  const creative: CreativeForm | null = overrideForm
    ? overrideForm
    : baseProvider
    ? providerToForm(baseProvider)
    : null

  const tts: TTSForm | null = overrideTTS
    ? overrideTTS
    : baseTTS
    ? ttsToForm(baseTTS)
    : null

  if (!creative || !tts) {
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
      return { ...base, [k]: v }
    })
  }

  const handleTTSField = <K extends keyof TTSForm>(k: K, v: TTSForm[K]) => {
    setOverrideTTS((prev) => {
      const base = prev ?? tts
      return { ...base, [k]: v }
    })
  }

  const handleTest = async () => {
    setTesting(true)
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

  const handleTestTTS = async () => {
    setTestingTTS(true)
    try {
      await persistTTS(tts)
      const res = await gateway.testTTS()
      if (res.ok) {
        toast.success(t("config.test.ok").replace("{ms}", String(res.latency_ms)))
      } else {
        toast.error(t("config.test.fail").replace("{msg}", res.message))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(t("config.test.fail").replace("{msg}", msg))
    }
    setTestingTTS(false)
  }

  const refreshConfig = async () => {
    const fresh = await gateway.config()
    setConfig(fresh)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await persistCreative(creative)
      await refreshConfig()
      toast.success(t("config.saved"))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(`${t("config.save_error")} ${msg}`)
    }
    setSaving(false)
  }

  const handleSaveTTS = async () => {
    setSavingTTS(true)
    try {
      await persistTTS(tts)
      await refreshConfig()
      toast.success(t("config.saved"))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(`${t("config.save_error")} ${msg}`)
    }
    setSavingTTS(false)
  }

  return (
    <>
      <AppHeader title={t("config.title")} />
      <div className="p-8 space-y-8 max-w-2xl">
        {/* Creative LLM 卡片 */}
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
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                {testing ? t("config.test.testing") : t("config.test.btn")}
              </Button>
              <Button onClick={handleSave} disabled={saving || testing}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? t("config.saving") : t("config.save")}
              </Button>
            </div>
          </div>
        </div>

        {/* TTS 卡片 (spec 019) */}
        <div className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/40">
                <Mic className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("config.tts.title")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t("config.tts.desc")}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <Label className="mb-2 block">{t("config.field.api_key")}</Label>
              <Input
                type="password"
                value={tts.api_key}
                onChange={(e) => handleTTSField("api_key", e.target.value)}
                placeholder={t("config.field.api_key_placeholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">{t("config.field.model")}</Label>
                <Input
                  value={tts.model}
                  onChange={(e) => handleTTSField("model", e.target.value)}
                  placeholder="qwen3-tts-flash"
                />
              </div>
              <div>
                <Label className="mb-2 block">{t("config.field.voice")}</Label>
                <Input
                  value={tts.voice}
                  onChange={(e) => handleTTSField("voice", e.target.value)}
                  placeholder="Cherry"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleTestTTS} disabled={testingTTS || savingTTS} variant="secondary">
                {testingTTS ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                {testingTTS ? t("config.test.testing") : t("config.test.btn")}
              </Button>
              <Button onClick={handleSaveTTS} disabled={savingTTS || testingTTS}>
                <Save className="h-4 w-4 mr-2" />
                {savingTTS ? t("config.saving") : t("config.save")}
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

/** 提交 creative 表单到 gateway。 */
async function persistCreative(form: CreativeForm): Promise<void> {
  const apiKeyToSend = form.api_key === form.api_key_mask ? "" : form.api_key

  const provider: Record<string, unknown> = {
    model: form.model,
    base_url: form.base_url,
    temperature: parseFloat(form.temperature) || 0,
  }
  if (apiKeyToSend !== "") provider.api_key = apiKeyToSend
  if (form.max_tokens !== "") provider.max_tokens = parseInt(form.max_tokens, 10)
  else provider.max_tokens = null

  await gateway.updateConfig({
    llm: { providers: { creative: provider } },
  })
}

/** 提交 TTS 表单到 gateway (spec 019)。 */
async function persistTTS(form: TTSForm): Promise<void> {
  const apiKeyToSend = form.api_key === form.api_key_mask ? "" : form.api_key

  const ttsPatch: Record<string, unknown> = {
    model: form.model,
    voice: form.voice,
  }
  if (apiKeyToSend !== "") ttsPatch.api_key = apiKeyToSend

  await gateway.updateConfig({ tts: ttsPatch })
}
