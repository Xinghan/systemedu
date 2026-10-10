import { notFound } from "next/navigation"
import LearnPage from "@/components/learning/learn-page"
import { isCurrentMoleculeId, MOLECULE_PROJECT } from "@/lib/course-numbering"

export default async function Page({ params }: { params: Promise<{ slug: string; moduleId: string }> }) {
  const { slug, moduleId } = await params
  if (slug !== MOLECULE_PROJECT || !isCurrentMoleculeId(moduleId)) notFound()
  return <LearnPage />
}
