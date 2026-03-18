"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { IconStar, IconCheck, IconLightning, IconClock } from "./cartoon-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AnimatedExamplesView } from "./animated-examples"
import { InteractiveLabView } from "./interactive-lab-view"
import { PagedContentView } from "./paged-content-view"
import { PracticeView } from "./practice-view"
import { ResourceSearchView } from "./resource-search-view"
import { AudioPlayerBar } from "./audio-player-bar"
import type { KnodeInfo, LessonContent } from "@/lib/types/api"

interface LessonContentViewProps {
  knode: KnodeInfo
  lesson: LessonContent
  projectName: string
  nodeId: number
  onMarkComplete: () => void
  onRegenerate: () => void
  onNavigate: (direction: "prev" | "next") => void
  onPageChange?: (tab: string, pageIndex: number, pageContent: string) => void
  hasPrev: boolean
  hasNext: boolean
  isCompleted: boolean
  completing: boolean
  regenerating: boolean
}

const TAB_CONFIG = [
  { key: "concept", label: "概念", field: "concept" as const, audioField: "concept_audio_url" as const },
  { key: "examples", label: "示例", field: "examples" as const, audioField: null },
  { key: "interactive_lab", label: "实验", field: "interactive_lab" as const, audioField: "lab_audio_url" as const },
  { key: "code_samples", label: "代码", field: "code_samples" as const, audioField: null },
  { key: "practice", label: "练习", field: "practice" as const, audioField: "practice_audio_url" as const },
  { key: "key_takeaways", label: "总结", field: "key_takeaways" as const, audioField: "key_takeaways_audio_url" as const },
]

export function LessonContentView({
  knode,
  lesson,
  projectName,
  nodeId,
  onMarkComplete,
  onRegenerate,
  onNavigate,
  onPageChange,
  hasPrev,
  hasNext,
  isCompleted,
  completing,
  regenerating,
}: LessonContentViewProps) {
  const [activeTab, setActiveTab] = useState(0)

  // Filter out tabs with empty content
  const availableTabs = TAB_CONFIG.filter((tab) => {
    const content = lesson[tab.field]
    return content && content.trim().length > 0
  })

  const RESOURCE_TAB = { key: "resources", label: "资料" }
  const allTabs = [...availableTabs, RESOURCE_TAB]

  const difficultyLabel = knode.difficulty_level <= 3 ? "入门" : knode.difficulty_level <= 6 ? "中级" : "高级"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold truncate">{knode.title}</h2>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant="outline" className="gap-1 text-xs">
                  <IconLightning className="h-3 w-3" />
                  {difficultyLabel} {knode.difficulty_level}/10
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <IconClock className="h-3 w-3" />
                  {knode.estimated_minutes}分钟
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <IconStar className="h-3 w-3" />
                  {knode.xp_reward} XP
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                disabled={regenerating}
                className="gap-1 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                重新生成
              </Button>
              {isCompleted ? (
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                  <IconCheck className="h-3 w-3" />
                  已完成
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={onMarkComplete}
                  disabled={completing}
                  className="gap-1"
                >
                  <IconCheck className="h-4 w-4" />
                  标记完成
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      {availableTabs.length > 0 ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="max-w-5xl mx-auto w-full px-6 pt-3 flex gap-1">
            {allTabs.map((tab, index) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(index)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === index
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-4">
              {(allTabs[activeTab]?.key ?? allTabs[0]?.key) === "resources" ? (
                <ResourceSearchView projectName={projectName} nodeId={nodeId} nodeTitle={knode.title} />
              ) : (availableTabs[activeTab]?.key ?? availableTabs[0]?.key) === "examples" ? (
                <AnimatedExamplesView content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]} />
              ) : (availableTabs[activeTab]?.key ?? availableTabs[0]?.key) === "interactive_lab" ? (
                <InteractiveLabView html={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]} />
              ) : (availableTabs[activeTab]?.key ?? availableTabs[0]?.key) === "practice" ? (
                <PracticeView
                  content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]}
                  projectName={projectName}
                  nodeId={nodeId}
                />
              ) : (
                <PagedContentView
                  content={lesson[availableTabs[activeTab]?.field ?? availableTabs[0].field]}
                  projectName={projectName}
                  nodeId={nodeId}
                  tab={availableTabs[activeTab]?.key ?? availableTabs[0]?.key}
                  onPageChange={(pageIndex, pageContent) => {
                    const tabKey = availableTabs[activeTab]?.key ?? availableTabs[0]?.key
                    onPageChange?.(tabKey, pageIndex, pageContent)
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>暂无内容</p>
        </div>
      )}

      {/* Audio player bar — per-tab audio, fallback to teacher audio */}
      {(() => {
        const currentTab = availableTabs[activeTab] ?? availableTabs[0]
        const tabAudioUrl = currentTab?.audioField ? lesson[currentTab.audioField] : null
        const audioUrl = tabAudioUrl || lesson.teacher_audio_url
        return audioUrl ? (
          <AudioPlayerBar
            key={audioUrl}
            audioUrl={audioUrl}
            script={lesson.teacher_script}
            timestamps={lesson.teacher_timestamps}
          />
        ) : null
      })()}

      {/* Bottom navigation */}
      <div className="border-t">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("prev")}
            disabled={!hasPrev}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            上一节
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("next")}
            disabled={!hasNext}
            className="gap-1"
          >
            下一节
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
