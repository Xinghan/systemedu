"use client"

import { useState } from "react"
import { TreePine, BookOpen, FileText, Lightbulb, StickyNote } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { KnowledgeTreeView } from "@/components/knowledge-tree/knowledge-tree-view"
import type { MilestoneInfo, NodeProgress } from "@/lib/types/api"

const TABS = [
  { id: "tree", label: "知识树", icon: TreePine },
  { id: "materials", label: "学习资料", icon: BookOpen },
  { id: "assignments", label: "作业", icon: FileText },
  { id: "suggestions", label: "AI建议", icon: Lightbulb },
  { id: "notes", label: "笔记", icon: StickyNote },
] as const

type TabId = (typeof TABS)[number]["id"]

interface LearningSidebarProps {
  milestones: MilestoneInfo[]
  progress: NodeProgress[]
  onNodeClick?: (nodeId: number) => void
}

export function LearningSidebar({
  milestones,
  progress,
  onNodeClick,
}: LearningSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>("tree")

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {activeTab === "tree" && (
            <KnowledgeTreeView
              milestones={milestones}
              progress={progress}
              onNodeClick={onNodeClick}
            />
          )}
          {activeTab !== "tree" && (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              即将推出
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
