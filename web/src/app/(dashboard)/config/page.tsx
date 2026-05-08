"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Save, Shield, Loader2, Plug, Mic, Brain, Code2, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppHeader } from "@/components/layout/app-header"
import { useAppStore } from "@/lib/stores/app-store"
import { gateway } from "@/lib/api"
import { useT } from "@/lib/hooks/use-t"
import type { LLMProviderInfo, TTSInfo } from "@/lib/types/api"

interface ProviderForm {
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

function providerToForm(p: LLMProviderInfo): ProviderForm {
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

const ROLE_META: Record<string, { titleKey: string; descKey: string; iconKey: "brain" | "code" | "zap" }> = {
  thinking: { titleKey: "config.role.thinking.title", descKey: "config.role.thinking.desc", iconKey: "brain" },
  coding:   { titleKey: "config.role.coding.title",   descKey: "config.role.coding.desc",   iconKey: "code"  },
  fast:     { titleKey: "config.role.fast.title",     descKey: "config.role.fast.desc",     iconKey: "zap"   },
}

function RoleIcon({ name }: { name: "brain" | "code" | "zap" }) {
  if (name === "brain") return <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
  if (name === "code")  return <Code2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
  return <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
}

export default function ConfigPage() {
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const t = useT()

  // Per-provider form override (按 role 名 keyed)
  const [overrides, setOverrides] = useState<Record<string, ProviderForm>>({})
  const [overrideTTS, setOverrideTTS] = useState<TTSForm | null>(null)
  const [savedSig, setSavedSig] = useState<string | null>(null)
  const [savingProv, setSavingProv] = useState<string | null>(null)
  const [testingProv, setTestingProv] = useState<string | null>(null)
  const [savingTTS, setSavingTTS] = useState(false)
  const [testingTTS, setTestingTTS] = useState(false)

  const userEditableRoles = config?.llm.user_editable ?? []
  const baseTTS = config?.tts

  // 当 store 里 config 变了 (saved 后重拉), 重置 override
  const sig = (
    userEditableRoles.map(r => {
      const p = config?.llm.providers[r]
      return p ? `${r}:${p.api_key}|${p.model}|${p.base_url}` : `${r}:none`
    }).join(";;")
    + "::tts:" + (baseTTS ? `${baseTTS.api_key}|${baseTTS.model}|${baseTTS.voice}` : "none")
  )
  if (sig !== savedSig) {
    setSavedSig(sig)
    setOverrides({})
    setOverrideTTS(null)
  }

  if (!config || !baseTTS || userEditableRoles.length === 0) {
    return (
      <>
        <AppHeader title={t("config.title")} />
        <div className="p-8">
          <p className="text-muted-foreground">{t("config.load_error")}</p>
        </div>
      </>
    )
  }

  const formForRole = (role: string): ProviderForm | null => {
    if (overrides[role]) return overrides[role]
    const p = config.llm.providers[role]
    return p ? providerToForm(p) : null
  }

  const handleField = <K extends keyof ProviderForm>(role: string, k: K, v: ProviderForm[K]) => {
    const cur = formForRole(role)
    if (!cur) return
    setOverrides(prev => ({ ...prev, [role]: { ...cur, [k]: v } }))
  }

  const tts: TTSForm = overrideTTS ?? ttsToForm(baseTTS)
  const handleTTSField = <K extends keyof TTSForm>(k: K, v: TTSForm[K]) => {
    setOverrideTTS(prev => ({ ...(prev ?? tts), [k]: v }))
  }

  const refreshConfig = async () => {
    const fresh = await gateway.config()
    setConfig(fresh)
  }

  const handleTestProv = async (role: string) => {
    const form = formForRole(role)
    if (!form) return
    setTestingProv(role)
    try {
      await persistProvider(role, form)
      const res = await gateway.testLLM(role)
      if (res.ok) {
        toast.success(t("config.test.ok").replace("{ms}", String(res.latency_ms)))
      } else {
        toast.error(t("config.test.fail").replace("{msg}", res.message))
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(t("config.test.fail").replace("{msg}", msg))
    }
    setTestingProv(null)
  }

  const handleSaveProv = async (role: string) => {
    const form = formForRole(role)
    if (!form) return
    setSavingProv(role)
    try {
      await persistProvider(role, form)
      await refreshConfig()
      toast.success(t("config.saved"))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(`${t("config.save_error")} ${msg}`)
    }
    setSavingProv(null)
  }

  const handleTestTTS = async () => {
    setTestingTTS(true)
    try {
      await persistTTS(tts)
      const res = await gateway.testTTS()
      if (res.ok) toast.success(t("config.test.ok").replace("{ms}", String(res.latency_ms)))
      else toast.error(t("config.test.fail").replace("{msg}", res.message))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown"
      toast.error(t("config.test.fail").replace("{msg}", msg))
    }
    setTestingTTS(false)
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
        {/* spec 021: 3 张 LLM 卡片 + TTS 卡片 */}
        {userEditableRoles.map(role => {
          const form = formForRole(role)
          if (!form) return null
          const meta = ROLE_META[role] ?? { titleKey: "config.creative.title", descKey: "config.creative.desc", iconKey: "code" as const }
          return (
            <div key={role} className="rounded-2xl border bg-white dark:bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                    <RoleIcon name={meta.iconKey} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{t(meta.titleKey as never)}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{t(meta.descKey as never)}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <Label className="mb-2 block">{t("config.field.model")}</Label>
                  <Input value={form.model} onChange={e => handleField(role, "model", e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">{t("config.field.base_url")}</Label>
                  <Input value={form.base_url} onChange={e => handleField(role, "base_url", e.target.value)} />
                </div>
                <div>
                  <Label className="mb-2 block">{t("config.field.api_key")}</Label>
                  <Input
                    type="password"
                    value={form.api_key}
                    onChange={e => handleField(role, "api_key", e.target.value)}
                    placeholder={t("config.field.api_key_placeholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block">{t("config.field.temperature")}</Label>
                    <Input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => handleField(role, "temperature", e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-2 block">{t("config.field.max_tokens")}</Label>
                    <Input type="number" min="0" step="1" value={form.max_tokens} onChange={e => handleField(role, "max_tokens", e.target.value)} placeholder={t("config.field.max_tokens_placeholder")} />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={() => handleTestProv(role)} disabled={testingProv === role || savingProv === role} variant="secondary">
                    {testingProv === role ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                    {testingProv === role ? t("config.test.testing") : t("config.test.btn")}
                  </Button>
                  <Button onClick={() => handleSaveProv(role)} disabled={savingProv === role || testingProv === role}>
                    <Save className="h-4 w-4 mr-2" />
                    {savingProv === role ? t("config.saving") : t("config.save")}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

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
              <Input type="password" value={tts.api_key} onChange={e => handleTTSField("api_key", e.target.value)} placeholder={t("config.field.api_key_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">{t("config.field.model")}</Label>
                <Input value={tts.model} onChange={e => handleTTSField("model", e.target.value)} placeholder="qwen3-tts-flash" />
              </div>
              <div>
                <Label className="mb-2 block">{t("config.field.voice")}</Label>
                <Input value={tts.voice} onChange={e => handleTTSField("voice", e.target.value)} placeholder="Cherry" />
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

        {/* System info (read-only) */}
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

async function persistProvider(role: string, form: ProviderForm): Promise<void> {
  const apiKeyToSend = form.api_key === form.api_key_mask ? "" : form.api_key
  const provider: Record<string, unknown> = {
    model: form.model,
    base_url: form.base_url,
    temperature: parseFloat(form.temperature) || 0,
  }
  if (apiKeyToSend !== "") provider.api_key = apiKeyToSend
  if (form.max_tokens !== "") provider.max_tokens = parseInt(form.max_tokens, 10)
  else provider.max_tokens = null
  await gateway.updateConfig({ llm: { providers: { [role]: provider } } })
}

async function persistTTS(form: TTSForm): Promise<void> {
  const apiKeyToSend = form.api_key === form.api_key_mask ? "" : form.api_key
  const ttsPatch: Record<string, unknown> = {
    model: form.model,
    voice: form.voice,
  }
  if (apiKeyToSend !== "") ttsPatch.api_key = apiKeyToSend
  await gateway.updateConfig({ tts: ttsPatch })
}
