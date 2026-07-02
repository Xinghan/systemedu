"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Paperclip, Send } from "lucide-react"
import { useT } from "@/lib/hooks/use-t"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const t = useT()
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const msg = value.trim()
    if (!msg || disabled) return
    onSend(msg)
    setValue("")
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
    textareaRef.current?.focus()
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Auto-resize textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 128) + "px"
  }, [])

  const effectivePlaceholder = placeholder ?? t("chat.input_placeholder")

  return (
    <div>
      {/* Glass input panel */}
      <div className="bg-white/80 dark:bg-card/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_-8px_rgba(106,28,246,0.12)] border border-white/50 dark:border-white/10 flex items-end gap-2 p-2">

        {/* Attach button */}
        <button
          type="button"
          tabIndex={-1}
          className="p-3 text-muted-foreground hover:text-primary rounded-xl transition-colors shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        {/* Textarea */}
        <div className="flex-1 px-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            disabled={disabled}
            rows={1}
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none py-3 text-[15px] resize-none text-foreground placeholder:text-muted-foreground/40 max-h-32 font-[var(--font-manrope)] disabled:opacity-50"
            style={{ lineHeight: "1.6" }}
          />
        </div>

        {/* Right: mic + send */}
        <div className="flex items-center gap-1 p-1 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            className="p-3 text-muted-foreground hover:text-primary rounded-xl transition-colors"
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-white p-3 rounded-xl shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

    </div>
  )
}
