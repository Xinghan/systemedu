"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { settings, type LlmSettings } from "@/lib/api"
import { useT } from "@/lib/i18n/use-t"

type Mode = "default" | "custom"

export default function SettingsPage() {
  const t = useT()
  const [data, setData] = useState<LlmSettings | null>(null)
  const [mode, setMode] = useState<Mode>("default")
  const [baseUrl, setBaseUrl] = useState("")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settings
      .getLlm()
      .then((d) => {
        setData(d)
        setMode(d.mode)
        setBaseUrl(d.base_url || "")
        setModel(d.model || "")
      })
      .catch(() => setData(null))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      if (mode === "default") {
        await settings.putLlm({ mode: "default" })
      } else {
        if (!baseUrl.trim() || !model.trim()) {
          toast.error(t("settings.llm.err.required"))
          setSaving(false)
          return
        }
        await settings.putLlm({
          mode: "custom",
          base_url: baseUrl.trim(),
          model: model.trim(),
          // 留空=保留原 key (后端据 has_key 判断)
          ...(apiKey ? { api_key: apiKey } : {}),
        })
      }
      toast.success(t("settings.llm.saved"))
      const fresh = await settings.getLlm()
      setData(fresh)
      setApiKey("")
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      const key = code ? `settings.llm.err.${code}` : "settings.llm.err.generic"
      const msg = t(key as never)
      // i18n 没命中该 code → 用通用提示
      toast.error(msg === key ? t("settings.llm.err.generic") : msg)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 14,
    color: "var(--ink)",
    background: "var(--card)",
    border: "1px solid var(--border-2)",
    borderRadius: 8,
    boxSizing: "border-box",
    marginTop: 6,
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
        {t("settings.title")}
      </h1>

      <section
        style={{
          marginTop: 24,
          background: "var(--paper-2)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
          {t("settings.llm.heading")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 4 }}>
          {t("settings.llm.desc")}
        </p>

        {/* 模式切换 */}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {(["default", "custom"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="btn btn-sm"
              style={{
                background: mode === m ? "var(--primary)" : "var(--card)",
                color: mode === m ? "#fff" : "var(--ink)",
                border: `1px solid ${mode === m ? "var(--primary)" : "var(--border-2)"}`,
              }}
            >
              {t(`settings.llm.mode.${m}` as never)}
            </button>
          ))}
        </div>

        {mode === "default" ? (
          <p style={{ marginTop: 16, fontSize: 14, color: "var(--ink)" }}>
            {t("settings.llm.default.hint")}
            <span style={{ fontFamily: "var(--mono)", color: "var(--primary-ink)" }}>
              {data?.default_model || "qwen3.7-max"}
            </span>
          </p>
        ) : (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13, color: "var(--sub)" }}>
              {t("settings.llm.custom.base_url")}
              <input
                style={inputStyle}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <label style={{ display: "block", marginTop: 14, fontSize: 13, color: "var(--sub)" }}>
              {t("settings.llm.custom.model")}
              <input
                style={inputStyle}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="qwen-plus / ..."
              />
            </label>
            <label style={{ display: "block", marginTop: 14, fontSize: 13, color: "var(--sub)" }}>
              {t("settings.llm.custom.api_key")}
              <input
                style={inputStyle}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  data?.has_key
                    ? t("settings.llm.custom.key_placeholder_set")
                    : t("settings.llm.custom.key_placeholder_new")
                }
              />
            </label>
            {data && !data.custom_crypto_available && (
              <p style={{ marginTop: 8, fontSize: 12, color: "var(--primary-ink)" }}>
                {t("settings.llm.err.crypto_unavailable")}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-violet btn-sm"
          style={{ marginTop: 20 }}
        >
          {saving ? t("settings.llm.saving") : t("settings.llm.save")}
        </button>
      </section>
    </main>
  )
}
