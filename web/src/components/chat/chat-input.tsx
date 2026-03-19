"use client"

import { useState, useRef, useCallback } from "react"
import { SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const msg = value.trim()
    if (!msg || disabled) return
    onSend(msg)
    setValue("")
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

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-end gap-2 rounded-2xl border bg-background px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none border-0 p-0 shadow-none focus-visible:ring-0 bg-transparent dark:bg-transparent"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="shrink-0 h-8 w-8 rounded-full"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        AI 可能会犯错，请核实重要信息
      </p>
    </div>
  )
}
