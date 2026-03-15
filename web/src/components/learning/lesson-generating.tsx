"use client"

import { useEffect, useState } from "react"

const CRAFT_MESSAGES = [
  { text: "正在采集知识原矿...", emoji: "⛏️" },
  { text: "正在熔炼核心概念...", emoji: "🔥" },
  { text: "正在合成示例材料...", emoji: "🧪" },
  { text: "正在锻造代码工具...", emoji: "🔨" },
  { text: "正在附魔练习卷轴...", emoji: "✨" },
  { text: "正在打包知识箱子...", emoji: "📦" },
  { text: "即将完成建造...", emoji: "🏗️" },
]

const REGEN_MESSAGES = [
  { text: "正在拆除旧建筑...", emoji: "💥" },
  { text: "正在重新设计蓝图...", emoji: "📐" },
  { text: "正在搬运新材料...", emoji: "🧱" },
  { text: "正在重新建造中...", emoji: "🏗️" },
  { text: "正在精装修...", emoji: "🎨" },
  { text: "最终检查中...", emoji: "🔍" },
]

interface LessonGeneratingProps {
  nodeTitle: string
  isRegenerate?: boolean
}

/** Minecraft-style pixel block */
function PixelBlock({ filled, color, delay }: { filled: boolean; color: string; delay: number }) {
  return (
    <div
      className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-black/20 dark:border-white/20 transition-all duration-500"
      style={{
        transitionDelay: `${delay}ms`,
        backgroundColor: filled ? color : "transparent",
        boxShadow: filled ? `inset -2px -2px 0 rgba(0,0,0,0.2), inset 2px 2px 0 rgba(255,255,255,0.15)` : "none",
        imageRendering: "pixelated",
      }}
    />
  )
}

/** Animated pickaxe */
function PickaxeAnimation() {
  return (
    <div className="text-4xl sm:text-5xl animate-bounce" style={{ animationDuration: "0.8s" }}>
      ⛏️
    </div>
  )
}

/** Floating particles */
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute text-lg opacity-60"
          style={{
            left: `${10 + (i * 11) % 80}%`,
            animation: `float-up ${3 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }}
        >
          {["✨", "⭐", "💎", "🟩", "🟫", "⬛", "🟨", "💚"][i]}
        </div>
      ))}
    </div>
  )
}

export function LessonGenerating({ nodeTitle, isRegenerate = false }: LessonGeneratingProps) {
  const messages = isRegenerate ? REGEN_MESSAGES : CRAFT_MESSAGES
  const [messageIndex, setMessageIndex] = useState(0)
  const [filledBlocks, setFilledBlocks] = useState(0)

  const TOTAL_BLOCKS = 20

  // Cycle through messages
  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [messages.length])

  // Animate progress blocks
  useEffect(() => {
    setFilledBlocks(0)
    const timer = setInterval(() => {
      setFilledBlocks((n) => {
        if (n >= TOTAL_BLOCKS) return 0  // Loop back
        return n + 1
      })
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  const currentMessage = messages[messageIndex]

  // Block colors — earthy Minecraft palette
  const blockColors = [
    "#6B8E23", // grass green
    "#8B6914", // dirt brown
    "#808080", // stone gray
    "#4682B4", // diamond blue
    "#DAA520", // gold
    "#228B22", // emerald green
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-8 relative">
      <Particles />

      <div className="w-full max-w-lg mx-auto space-y-8 relative z-10">
        {/* Pickaxe animation */}
        <div className="flex justify-center">
          <PickaxeAnimation />
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
          <h2 className="text-xl font-bold tracking-wide" style={{ fontFamily: "system-ui" }}>
            {isRegenerate ? "重新锻造中..." : "知识锻造中..."}
          </h2>
          <p className="text-sm text-muted-foreground truncate max-w-xs mx-auto">
            {nodeTitle}
          </p>
        </div>

        {/* Minecraft-style progress bar */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <div
              className="inline-flex flex-wrap gap-0.5 p-2 rounded-lg bg-muted/50 border-2 border-black/10 dark:border-white/10"
              style={{
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                maxWidth: "280px",
              }}
            >
              {[...Array(TOTAL_BLOCKS)].map((_, i) => (
                <PixelBlock
                  key={i}
                  filled={i < filledBlocks}
                  color={blockColors[i % blockColors.length]}
                  delay={i * 30}
                />
              ))}
            </div>
          </div>

          {/* Progress text */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{currentMessage.emoji}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {currentMessage.text}
            </span>
          </div>
        </div>

        {/* Fun tip */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
            <span>💡</span>
            <span>AI 工匠正在为你精心打造课程内容，请稍候...</span>
          </div>
        </div>
      </div>

      {/* CSS animation for floating particles */}
      <style jsx>{`
        @keyframes float-up {
          0% {
            transform: translateY(100vh) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-20px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
