import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/** The existing guided classroom and offline reader use the same Markdown pipeline. */
export function LessonMarkdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
}
