"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Typography from "@tiptap/extension-typography"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  Minus, LinkIcon, Quote, Code2, List, ListOrdered,
  CheckSquare, Undo, Redo,
} from "lucide-react"
import { gateway } from "@/lib/api"

export type NotePreviewMode = "edit" | "preview"

interface NotePanelProps {
  projectName: string
  nodeId: number
  previewMode?: NotePreviewMode
  onStatusChange?: (status: "idle" | "saving" | "saved") => void
}

// Convert plain text/markdown to HTML for TipTap
function mdToHtml(md: string): string {
  if (!md.trim()) return ""
  // Basic markdown → HTML conversion for initial load
  let html = md
    // headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // blockquote
    .replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>")
    // code block
    .replace(/```[\s\S]*?```/g, (m) => `<pre><code>${m.slice(3, -3).replace(/^\n/, "")}</code></pre>`)
    // inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // strikethrough
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    // task list
    .replace(/^- \[x\] (.+)$/gm, '<li data-type="taskItem" data-checked="true">$1</li>')
    .replace(/^- \[ \] (.+)$/gm, '<li data-type="taskItem" data-checked="false">$1</li>')
    // unordered list (group)
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // paragraphs (non-empty lines not already wrapped)
    .split("\n\n")
    .map((block) => {
      if (!block.trim()) return ""
      if (/^<(h[1-6]|blockquote|pre|ul|ol|li)/.test(block.trim())) return block
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`
    })
    .join("\n")
  return html
}

// Convert TipTap HTML back to markdown-ish text for storage
function htmlToMd(html: string): string {
  // Simple storage — store as-is for now, use full content
  return html
}

// Toolbar button
function ToolBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const url = window.prompt("URL")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }, [editor])

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 bg-white/60 dark:bg-white/5 border-b border-primary/8">
      {/* History */}
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="撤销" disabled={!editor.can().undo()}>
        <Undo className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="重做" disabled={!editor.can().redo()}>
        <Redo className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-primary/15 mx-1" />

      {/* Headings */}
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="H1">
        <Heading1 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="H2">
        <Heading2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="H3">
        <Heading3 className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-primary/15 mx-1" />

      {/* Inline marks */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="加粗">
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体">
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线">
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="高亮">
        <span className="text-[11px] font-bold leading-none px-0.5">A</span>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="行内代码">
        <Code2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={setLink} active={editor.isActive("link")} title="链接">
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-primary/15 mx-1" />

      {/* Block */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用">
        <Quote className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="代码块">
        <Code2 className="h-3.5 w-3.5 opacity-70" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线">
        <Minus className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-primary/15 mx-1" />

      {/* Lists */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">
        <List className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表">
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="任务列表">
        <CheckSquare className="h-3.5 w-3.5" />
      </ToolBtn>
    </div>
  )
}

export function NotePanel({ projectName, nodeId, onStatusChange }: NotePanelProps) {
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoad = useRef(true)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "not-prose" } },
      }),
      Placeholder.configure({
        placeholder: "开始记录你的学习洞见...",
        emptyEditorClass: "is-editor-empty",
      }),
      Typography,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline underline-offset-2" } }),
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none min-h-full",
      },
    },
    onUpdate: ({ editor }) => {
      if (initialLoad.current) return
      const html = editor.getHTML()
      onStatusChange?.("saving")
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        gateway
          .upsertNote(projectName, nodeId, html)
          .then(() => onStatusChange?.("saved"))
          .catch(() => onStatusChange?.("idle"))
      }, 1500)
    },
    immediatelyRender: false,
  })

  // Load note when nodeId/project changes
  useEffect(() => {
    if (!editor) return
    initialLoad.current = true
    setLoading(true)
    onStatusChange?.("idle")

    gateway
      .getNote(projectName, nodeId)
      .then((note) => {
        const content = note.content || ""
        // Detect if stored as HTML or plain/markdown
        const isHtml = content.trimStart().startsWith("<")
        const html = isHtml ? content : mdToHtml(content)
        editor.commands.setContent(html || "", false)
        // Mark initial load done after a tick so onUpdate doesn't fire
        setTimeout(() => { initialLoad.current = false }, 50)
      })
      .catch(() => {
        editor.commands.setContent("", false)
        setTimeout(() => { initialLoad.current = false }, 50)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, nodeId, editor])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        <div className="w-4 h-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin mr-2" />
        加载中...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {editor && <Toolbar editor={editor} />}

      {/* Editor canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-8 py-8 min-h-full">
          <EditorContent
            editor={editor}
            className="note-editor prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-extrabold prose-headings:text-foreground prose-headings:tracking-tight
              prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-6
              prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-5
              prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-4
              prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:my-2
              prose-strong:text-foreground prose-strong:font-bold
              prose-em:text-foreground/80
              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5
              prose-blockquote:rounded-r-xl prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-4
              prose-blockquote:not-italic prose-blockquote:text-primary/80
              prose-code:bg-primary/8 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5
              prose-code:rounded-md prose-code:text-[0.85em] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-foreground/5 prose-pre:border prose-pre:border-primary/10 prose-pre:rounded-xl
              prose-pre:p-4 prose-pre:overflow-x-auto
              prose-li:text-foreground/85 prose-li:my-0.5
              prose-hr:border-primary/15 prose-hr:my-6
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
          />
        </div>
      </div>
    </div>
  )
}
