"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Send } from "lucide-react"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "输入消息...",
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const msg = value.trim()
    if (!msg || disabled) return
    onSend(msg)
    setValue("")
    inputRef.current?.focus()
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

  return (
    <div className="px-6 py-5 bg-primary/5 border-t border-primary/10 shrink-0">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-white dark:bg-card border border-primary/20 rounded-2xl px-5 py-4 pr-24 text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        <div className="absolute right-2 flex items-center gap-1">
          <button
            type="button"
            className="p-2 text-muted-foreground hover:text-primary transition-colors"
            tabIndex={-1}
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="bg-primary hover:bg-primary/90 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-center text-[9px] text-muted-foreground/60 mt-3 uppercase tracking-[0.2em] font-[var(--font-manrope)]">
        Cognitive Sanctuary Neural Engine v4.2
      </p>
    </div>
  )
}
