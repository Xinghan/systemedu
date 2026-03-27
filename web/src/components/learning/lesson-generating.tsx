"use client"

import { useEffect, useState } from "react"
import {
  IconPickaxe, IconFlame, IconFlask, IconHammer, IconSparkles,
  IconChest, IconCastle, IconBoom, IconBlueprint, IconBricks,
  IconPaint, IconMagnify, IconBulb,
} from "./cartoon-icons"

const CRAFT_MESSAGES = [
  { text: "正在采集知识原矿...", Icon: IconPickaxe },
  { text: "正在熔炼核心概念...", Icon: IconFlame },
  { text: "正在合成示例材料...", Icon: IconFlask },
  { text: "正在锻造代码工具...", Icon: IconHammer },
  { text: "正在附魔练习卷轴...", Icon: IconSparkles },
  { text: "正在打包知识箱子...", Icon: IconChest },
  { text: "即将完成建造...", Icon: IconCastle },
]

const REGEN_MESSAGES = [
  { text: "正在拆除旧建筑...", Icon: IconBoom },
  { text: "正在重新设计蓝图...", Icon: IconBlueprint },
  { text: "正在搬运新材料...", Icon: IconBricks },
  { text: "正在重新建造中...", Icon: IconCastle },
  { text: "正在精装修...", Icon: IconPaint },
  { text: "最终检查中...", Icon: IconMagnify },
]

interface LessonGeneratingProps {
  nodeTitle: string
  isRegenerate?: boolean
}

/** Minecraft-style pixel block */
function PixelBlock({ filled, color, delay }: { filled: boolean; color: string; delay: number }) {
  return (
    <div
      className="w-5 h-5 sm:w-6 sm:h-6 border-2 transition-all duration-500"
      style={{
        transitionDelay: `${delay}ms`,
        backgroundColor: filled ? color : "var(--color-muted)",
        borderColor: filled ? "rgba(0,0,0,0.25)" : "rgba(128,128,128,0.2)",
        boxShadow: filled
          ? "inset -2px -2px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.2)"
          : "inset -1px -1px 0 rgba(0,0,0,0.05), inset 1px 1px 0 rgba(255,255,255,0.05)",
      }}
    />
  )
}

/** Floating pixel particles (pure CSS squares, no emoji) */
function Particles() {
  const colors = [
    "#6B8E23", "#8B6914", "#808080", "#4682B4",
    "#DAA520", "#06B6D4", "#6B8E23", "#4682B4",
  ]
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {colors.map((color, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-sm opacity-40"
          style={{
            left: `${10 + (i * 11) % 80}%`,
            backgroundColor: color,
            animation: `float-up ${3 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }}
        />
      ))}
    </div>
  )
}

// Block colors — earthy Minecraft palette
const BLOCK_COLORS = [
  "#6B8E23", // grass green
  "#8B6914", // dirt brown
  "#808080", // stone gray
  "#4682B4", // diamond blue
  "#DAA520", // gold
  "#06B6D4", // emerald green
]

const TOTAL_BLOCKS = 20

export function LessonGenerating({ nodeTitle, isRegenerate = false }: LessonGeneratingProps) {
  const messages = isRegenerate ? REGEN_MESSAGES : CRAFT_MESSAGES
  const [messageIndex, setMessageIndex] = useState(0)
  const [filledBlocks, setFilledBlocks] = useState(0)

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
      setFilledBlocks((n) => (n >= TOTAL_BLOCKS ? 0 : n + 1))
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  const currentMessage = messages[messageIndex]
  const CurrentIcon = currentMessage.Icon

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-8 relative">
      <Particles />

      <div className="w-full max-w-lg mx-auto space-y-8 relative z-10">
        {/* Animated tool icon */}
        <div className="flex justify-center">
          <div
            className="rounded-xl bg-muted/60 p-4 border-2 border-black/10 dark:border-white/10"
            style={{
              boxShadow: "inset -3px -3px 0 rgba(0,0,0,0.1), inset 3px 3px 0 rgba(255,255,255,0.1)",
            }}
          >
            <IconPickaxe
              className="h-10 w-10 sm:h-12 sm:w-12 animate-bounce"
              style={{ animationDuration: "0.8s" }}
            />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold tracking-wide">
            {isRegenerate ? "重新锻造中..." : "知识锻造中..."}
          </h2>
          <p className="text-sm text-muted-foreground truncate max-w-xs mx-auto">
            {nodeTitle}
          </p>
        </div>

        {/* Minecraft-style progress bar */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div
              className="inline-flex flex-wrap gap-0.5 p-2.5 rounded-lg bg-muted/40 border-2 border-black/10 dark:border-white/10"
              style={{
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.1)",
                maxWidth: "280px",
              }}
            >
              {[...Array(TOTAL_BLOCKS)].map((_, i) => (
                <PixelBlock
                  key={i}
                  filled={i < filledBlocks}
                  color={BLOCK_COLORS[i % BLOCK_COLORS.length]}
                  delay={i * 30}
                />
              ))}
            </div>
          </div>

          {/* Progress text with icon */}
          <div className="flex items-center justify-center gap-2.5 text-muted-foreground">
            <CurrentIcon className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">
              {currentMessage.text}
            </span>
          </div>
        </div>

        {/* Tip */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
            <IconBulb className="h-3.5 w-3.5 shrink-0" />
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
            opacity: 0.4;
          }
          90% {
            opacity: 0.4;
          }
          100% {
            transform: translateY(-20px) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
