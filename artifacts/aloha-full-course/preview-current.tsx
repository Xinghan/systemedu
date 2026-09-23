import fs from 'node:fs/promises'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { SlideDeckPlayer } from '@/components/learning/teacher-scene-view'

export default async function Page({ searchParams }: { searchParams: Promise<{ node?: string; media?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { node = 'M19', media = 'diagram' } = await searchParams
  if (!/^M\d{2}$/.test(node)) notFound()
  const root = '/Users/xinghan/Dev/systemeduidea/projects_data/aloha-bimanual-apprentice'
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'))
  const entry = manifest.knodes.find((k: { module_id: string }) => k.module_id === node)
  if (!entry) notFound()
  const base = path.join(root, entry.knode_dir)
  const sections = JSON.parse(await fs.readFile(path.join(base, 'sections.json'), 'utf8'))
  const slides = JSON.parse(await fs.readFile(path.join(base, 'slides.json'), 'utf8')).slides.filter((s: { kind: string; payload: { idea_id?: string; diagram_html_id?: string } }) => media === 'canvas' ? sections.rendered_sections[s.payload.idea_id || s.payload.diagram_html_id || '']?.html?.includes('<canvas') : s.kind === 'diagram')
  return <main className="p-6"><SlideDeckPlayer autoPlay={false} layout="content" projectName="aloha-bimanual-apprentice" moduleId={node} deck={{ slides, ideas: sections.ideas, renderedSections: sections.rendered_sections, knodeDir: entry.knode_dir }} /></main>
}
