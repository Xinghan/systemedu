"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { FileJson, Eye, Check, AlertCircle, ArrowLeft, ArrowRight, Sparkles, Upload } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AppHeader } from "@/components/layout/app-header"
import { TreeFlow } from "@/components/knowledge-tree/tree-flow"
import { gateway } from "@/lib/api"
import type { TreePreviewResponse } from "@/lib/types/api"

type Step = "input" | "preview" | "confirm"

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("input")
  const [rawJson, setRawJson] = useState("")
  const [treeData, setTreeData] = useState<Record<string, unknown> | null>(null)
  const [preview, setPreview] = useState<TreePreviewResponse | null>(null)
  const [projectName, setProjectName] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("")
  const [dragOver, setDragOver] = useState(false)

  // AI generate form state
  const [aiTitle, setAiTitle] = useState("")
  const [aiDescription, setAiDescription] = useState("")
  const [aiAge, setAiAge] = useState(12)
  const [aiNodeCount, setAiNodeCount] = useState(20)

  const handleFile = useCallback((file: File) => {
    setError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRawJson(text)
      try {
        const parsed = JSON.parse(text)
        setTreeData(parsed)
      } catch {
        setError("JSON 解析失败，请检查文件格式")
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handlePaste = useCallback(() => {
    setError("")
    try {
      const parsed = JSON.parse(rawJson)
      setTreeData(parsed)
    } catch {
      setError("JSON 解析失败，请检查格式")
    }
  }, [rawJson])

  const handlePreview = useCallback(async () => {
    if (!treeData) return
    setLoading(true)
    setLoadingLabel("正在验证知识树...")
    setError("")
    try {
      const result = await gateway.previewTree(treeData)
      setPreview(result)
      if (result.valid) {
        const metaTitle = result.meta?.title as string
        if (metaTitle) setProjectTitle(metaTitle)
        setStep("preview")
      } else {
        setError(`验证失败: ${result.errors.join("; ")}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "预览请求失败")
    } finally {
      setLoading(false)
    }
  }, [treeData])

  const handleAiGenerate = useCallback(async () => {
    if (!aiTitle.trim() || !aiDescription.trim()) return
    setLoading(true)
    setLoadingLabel("AI 正在生成知识树，请稍候...")
    setError("")
    try {
      const result = await gateway.generateTree({
        title: aiTitle.trim(),
        description: aiDescription.trim(),
        age: aiAge,
        node_count: aiNodeCount,
      })
      setPreview(result)
      setTreeData({ milestones: result.milestones })
      setProjectTitle(aiTitle.trim())
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 生成失败，请重试")
    } finally {
      setLoading(false)
    }
  }, [aiTitle, aiDescription, aiAge])

  const handleCreate = useCallback(async () => {
    if (!treeData || !projectName.trim()) return
    setLoading(true)
    setLoadingLabel("正在创建项目...")
    setError("")
    try {
      await gateway.createProject(projectName.trim(), projectTitle.trim(), treeData)
      router.push(`/projects/${projectName.trim()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败")
    } finally {
      setLoading(false)
    }
  }, [treeData, projectName, projectTitle, router])

  const stepLabels: Record<Step, string> = {
    input: "选择方式",
    preview: "预览",
    confirm: "确认创建",
  }

  if (loading) {
    return (
      <>
        <AppHeader title="新建项目" />
        <PageLoading label={loadingLabel} />
      </>
    )
  }

  return (
    <>
      <AppHeader title="新建项目" />
      <div className="p-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(["input", "preview", "confirm"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <Badge variant={step === s ? "default" : "outline"}>
                {i + 1}. {stepLabels[s]}
              </Badge>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm max-w-2xl">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Choose method — Tab switch (mutually exclusive) */}
        {step === "input" && (
          <div className="max-w-2xl">
            <Tabs defaultValue={0}>
              <TabsList className="mb-6">
                <TabsTrigger value={0}>
                  <Sparkles className="h-4 w-4" />
                  AI 生成
                </TabsTrigger>
                <TabsTrigger value={1}>
                  <Upload className="h-4 w-4" />
                  上传 JSON
                </TabsTrigger>
              </TabsList>

              {/* AI Generate */}
              <TabsContent value={0}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4" />
                      AI 生成知识树
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="ai-title">项目标题</Label>
                      <Input
                        id="ai-title"
                        placeholder="例如：树叶识别AI模型"
                        value={aiTitle}
                        onChange={(e) => setAiTitle(e.target.value)}
                        className="mt-1 max-w-md"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ai-desc">项目描述</Label>
                      <textarea
                        id="ai-desc"
                        className="w-full max-w-lg h-28 p-4 rounded-xl border bg-muted/50 text-base resize-y focus:outline-none focus:ring-2 focus:ring-ring mt-2"
                        placeholder="描述项目的目标、学习内容、预期成果等..."
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ai-age">学生年龄</Label>
                      <Input
                        id="ai-age"
                        type="number"
                        min={6}
                        max={18}
                        value={aiAge}
                        onChange={(e) => setAiAge(Number(e.target.value) || 12)}
                        className="mt-1 w-20"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ai-node-count">知识树精细度</Label>
                        <span className="text-sm font-medium tabular-nums">{aiNodeCount} 节点</span>
                      </div>
                      <input
                        id="ai-node-count"
                        type="range"
                        min={5}
                        max={500}
                        step={1}
                        value={aiNodeCount}
                        onChange={(e) => setAiNodeCount(Number(e.target.value))}
                        className="mt-1 w-full max-w-md"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {aiNodeCount <= 15
                          ? "入门概览 -- 快速了解项目全貌"
                          : aiNodeCount <= 50
                            ? "标准课程 -- 适合大多数学习场景"
                            : aiNodeCount <= 150
                              ? "深入学习 -- 包含更多细节和练习"
                              : "完整体系 -- 全面覆盖，适合系统学习"}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={handleAiGenerate}
                        disabled={!aiTitle.trim() || !aiDescription.trim()}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        生成知识树
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Upload JSON */}
              <TabsContent value={1}>
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileJson className="h-4 w-4" />
                        上传 JSON 文件
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                      >
                        <FileJson className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-3">
                          拖拽 JSON 文件到此处，或点击选择文件
                        </p>
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          id="file-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFile(file)
                          }}
                        />
                        <label htmlFor="file-input" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                          选择文件
                        </label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">或粘贴 JSON</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <textarea
                        className="w-full h-44 p-4 rounded-xl border bg-muted/50 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder='{"知识树节点": [...], "模块依赖图": [...]} 或 {"milestones": [...]}'
                        value={rawJson}
                        onChange={(e) => setRawJson(e.target.value)}
                      />
                      <Button variant="outline" size="sm" className="mt-2" onClick={handlePaste}>
                        解析 JSON
                      </Button>
                    </CardContent>
                  </Card>

                  {treeData && (
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        JSON 已解析
                      </Badge>
                      <Button onClick={handlePreview}>
                        <Eye className="h-4 w-4 mr-2" />
                        预览知识树
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Step 2: Preview (full width for tree visualization) */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 max-w-2xl">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold">{preview.stats.milestone_count}</div>
                  <div className="text-xs text-muted-foreground">模块</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold">{preview.stats.node_count}</div>
                  <div className="text-xs text-muted-foreground">知识节点</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold">{preview.stats.total_minutes}</div>
                  <div className="text-xs text-muted-foreground">总分钟</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-2xl font-bold">~{preview.stats.estimated_hours}h</div>
                  <div className="text-xs text-muted-foreground">预计学时</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">知识树预览</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[500px] w-full">
                  <TreeFlow milestones={preview.milestones} progress={[]} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between max-w-2xl">
              <Button variant="outline" onClick={() => setStep("input")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <Button onClick={() => setStep("confirm")}>
                确认并创建项目
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">创建项目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="proj-name">项目标识 (英文 slug)</Label>
                <Input
                  id="proj-name"
                  placeholder="e.g. tree-leaf-ai"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                  className="mt-1 max-w-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  仅允许小写字母、数字和连字符
                </p>
              </div>
              <div>
                <Label htmlFor="proj-title">项目标题</Label>
                <Input
                  id="proj-title"
                  placeholder="e.g. 树叶识别AI模型"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="mt-1 max-w-md"
                />
              </div>

              {preview && (
                <div className="text-sm text-muted-foreground">
                  将创建包含 {preview.stats.milestone_count} 个模块、{preview.stats.node_count} 个节点的项目
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("preview")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回预览
                </Button>
                <Button onClick={handleCreate} disabled={!projectName.trim()}>
                  <Check className="h-4 w-4 mr-2" />
                  创建项目
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
