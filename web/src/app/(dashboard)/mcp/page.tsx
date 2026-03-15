"use client"

import { useEffect, useState, useCallback } from "react"
import { Plug, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

  const refresh = useCallback(() => {
    gateway
      .mcpServers()
      .then(setServers)
      .catch(() => {})
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
      refresh()
    } catch {}
  }

  const handleRemove = async (name: string) => {
    try {
      await gateway.removeMCPServer(name)
      refresh()
    } catch {}
  }

  return (
    <>
      <AppHeader title="MCP 服务" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-muted-foreground">
            管理 MCP（Model Context Protocol）服务器
          </p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                添加服务器
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加 MCP 服务器</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>名称</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: filesystem"
                  />
                </div>
                <div>
                  <Label>命令</Label>
                  <Input
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="例: npx"
                  />
                </div>
                <div>
                  <Label>参数（空格分隔）</Label>
                  <Input
                    value={newArgs}
                    onChange={(e) => setNewArgs(e.target.value)}
                    placeholder="例: @anthropic/mcp-server-filesystem /tmp"
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            加载中...
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Plug className="h-12 w-12 mb-4" />
            <p>暂无 MCP 服务器</p>
            <p className="text-sm">添加 MCP 服务器以扩展 AI 能力</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {servers.map((srv) => (
              <Card key={srv.name}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plug className="h-4 w-4" />
                    {srv.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(srv.name)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">命令:</span>{" "}
                      <code className="bg-muted px-1 rounded">{srv.command}</code>
                    </p>
                    {srv.args.length > 0 && (
                      <p>
                        <span className="text-muted-foreground">参数:</span>{" "}
                        <code className="bg-muted px-1 rounded">
                          {srv.args.join(" ")}
                        </code>
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    {srv.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
