import { redirect } from "next/navigation"
import { LINES_HREF } from "@/lib/project-lines/catalog"

export default function ProjectLinesPage() {
  redirect(LINES_HREF)
}
