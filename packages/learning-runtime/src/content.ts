export interface Resource { media_url?: string; poster_url?: string; title?: string; url?: string; purpose?: string; focus?: string; detail?: string; publisher?: string }
export interface Exercise { id?: string; question?: string; prompt?: string; type?: string; options?: string[]; correct?: number | string; answer?: string; explanation?: string }
export interface Interaction { id: string; title: string; mode: string; path?: string; exercises: Exercise[] }
export interface Theory { theory_id: string; title: string; body_markdown?: string; level_bodies?: { level: string; body_markdown: string }[] }
export interface Slide { slide_id?: string; title: string; kind?: string; body_markdown?: string; audio_script?: string; audio_path?: string; payload?: Record<string, unknown> }
export interface CourseLesson {
  course_id: string; content_version: string; module_id: string; title: string; core_question?: string; lesson: string; assignment: string; asset_base: string
  resources: Resource[]; theories: Theory[]; slides: Slide[]; interactions: Interaction[]; external_resources?: Record<string, Resource[]>
  foundations?: {id: string; title: string; body_markdown: string}[]; assessments?: {id: string; title: string; questions: Exercise[]}[]; downloads?: Resource[]
  lab_url?: string; response_prompts?: { title: string; hint?: string; example?: string; fields: {id: string; label: string; type: string; options?: string[]; placeholder?: string}[] }[]
}
export interface CatalogNode { id: string; moduleId: string; title: string; path: string }
export interface Catalog { schemaVersion: number; courses: { id: string; modules: CatalogNode[] }[] }
export async function loadLesson(activity: string): Promise<CourseLesson> {
  const response = await fetch('content/catalog.json')
  if (!response.ok) throw new Error('课程目录无法读取，请重新安装课程包。')
  const catalog = await response.json() as Catalog
  const node = catalog.courses.flatMap(course => course.modules).find(node => node.id === activity)
  if (!node) throw new Error('这份记录对应的课程版本尚未安装。原记录仍可在“我的”中导出。')
  if (!/^\/content\/modules\/[a-f0-9]+\.json$/.test(node.path)) throw new Error('课程路径不正确。')
  const file = await fetch(node.path)
  if (!file.ok) throw new Error('本节内容缺失，请重新安装课程包。')
  return file.json()
}
export function assetURL(value: string, base: string): string {
  const preview = value.match(/^\/preview\/(lightkurve|pvlib|teachopencadd)\/media\?path=(.+)$/)
  if (preview) return '/content/assets/'+({lightkurve:'lightkurve-transit-detective',pvlib:'pvlib-solar-forecast-station',teachopencadd:'teachopencadd-candidate-research'}[preview[1]])+'/'+decodeURIComponent(preview[2])
  const file = value.match(/^\/api\/(?:my|library)\/projects\/([A-Za-z0-9_-]+)\/files\/(.+)$/)
  if (file) return '/content/assets/'+file[1]+'/'+file[2]
  if (/^(knodes|downloads|practice)\//.test(value) && base.startsWith('/content/assets/')) return base.split('/').slice(0,4).join('/')+'/'+value
  if (/^https?:\/\//.test(value) || value.startsWith('/')) return value
  return new URL(value, new URL(base, location.href)).href
}
