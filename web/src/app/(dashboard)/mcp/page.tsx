"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Plug, Plus, Trash2 } from "lucide-react"
import { PageLoading } from "@/components/ui/page-loading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AppHeader } from "@/components/layout/app-header"
import { gateway } from "@/lib/api"
import type { MCPServer } from "@/lib/types/api"

export default function MCPPage() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCommand, setNewCommand] = useState("")
  const [newArgs, setNewArgs] = useState("")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    gateway
      .mcpServers()
      .then(setServers)
      .catch((e) => setError(e.message ?? "无法加载 MCP 服务器"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleAdd = async () => {
    if (!newName.trim() || !newCommand.trim()) return
    try {
      await gateway.addMCPServer({
        name: newName.trim(),
        command: newCommand.trim(),
        args: newArgs.trim() ? newArgs.trim().split(/\s+/) : [],
      })
      setNewName("")
      setNewCommand("")
      setNewArgs("")
      setDialogOpen(false)
      toast.success(`已添加 MCP 服务器: ${newName.trim()}`)
      refresh()
    } catch (e: unknown) {
      toast.error(`添加失败: ${e instanceof Error ? e.message : "未知错误"}`)
    }
  }

  const handleRemove = async (name: string) => {
    try {
      await gateway.removeMCPServer(name)
      toast.success(`已移除 MCP 服务器: ${name}`)
      refresh()
    } catch (e: unknown) {
      toast.error(`移除失败: ${e instanceof Error ? e.message : "未知错误"}`)
    }
  }

  return (
    <>
      <AppHeader title="MCP 服务" />
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-base border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <p className="text-base text-muted-foreground">
            管理 MCP（Model Context Protocol）服务器
          </p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  <Plus className="h-5 w-5" />
                  添加服务器
                </button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加 MCP 服务器</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <Label>名称</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: filesystem"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>命令</Label>
                  <Input
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="例: npx"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>参数（空格分隔）</Label>
                  <Input
                    value={newArgs}
                    onChange={(e) => setNewArgs(e.target.value)}
                    placeholder="例: @anthropic/mcp-server-filesystem /tmp"
                    className="mt-2"
                  />
                </div>
                <Button onClick={handleAdd} className="w-full">
                  添加
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <PageLoading />
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
              <Plug className="h-10 w-10 opacity-40" />
            </div>
            <p className="text-lg font-medium">暂无 MCP 服务器</p>
            <p className="text-base mt-1">添加 MCP 服务器以扩展 AI 能力</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {servers.map((srv) => (
              <div key={srv.name} className="rounded-2xl border bg-white dark:bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/40">
                      <Plug className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-base text-foreground">{srv.name}</p>
                      <Badge variant="secondary" className="mt-1.5">{srv.status}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemove(srv.name)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm space-y-1.5 text-muted-foreground">
                  <p>
                    <span className="text-foreground/60">命令:</span>{" "}
                    <code className="bg-muted px-2 py-1 rounded-lg text-foreground">{srv.command}</code>
                  </p>
                  {srv.args.length > 0 && (
                    <p>
                      <span className="text-foreground/60">参数:</span>{" "}
                      <code className="bg-muted px-2 py-1 rounded-lg text-foreground">{srv.args.join(" ")}</code>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
