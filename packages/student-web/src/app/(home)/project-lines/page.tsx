import { redirect } from "next/navigation"
import { SPACE_LINE } from "@/lib/project-lines/catalog"

export default function ProjectLinesPage() {
  redirect(SPACE_LINE.href)
}
