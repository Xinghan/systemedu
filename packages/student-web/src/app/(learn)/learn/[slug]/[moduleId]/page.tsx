import { notFound, redirect } from "next/navigation"
import LearnPage from "@/components/learning/learn-page"
import { legacyLessonPath, MOLECULE_PROJECT } from "@/lib/course-numbering"

export default async function Page({ params }: { params: Promise<{ slug: string; moduleId: string }> }) {
  const { slug, moduleId } = await params
  if (slug === MOLECULE_PROJECT) {
    const target = legacyLessonPath(slug, moduleId)
    if (!target) notFound()
    // An unversioned M23 always means legacy M23, never current M23.
    redirect(target)
  }
  return <LearnPage />
}
