import { notFound } from "next/navigation"
import { PvlibPublishedLesson } from "@/components/learning/pvlib-published-lesson"

export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params
  if (!/^M\d{2}$/.test(moduleId) || Number(moduleId.slice(1)) < 1 || Number(moduleId.slice(1)) > 58) notFound()
  return <PvlibPublishedLesson key={moduleId} moduleId={moduleId} />
}
