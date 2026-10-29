import { notFound } from "next/navigation"
import { LightkurvePublishedLesson } from "@/components/learning/lightkurve-published-lesson"

export default async function Page({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params
  if (!/^M\d{2}$/.test(moduleId) || Number(moduleId.slice(1)) < 1 || Number(moduleId.slice(1)) > 32) notFound()
  return <LightkurvePublishedLesson key={moduleId} moduleId={moduleId} />
}
