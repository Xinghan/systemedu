"use client"

import { library } from "@/lib/api"

/** Published course images resolve relative to their node, as lesson assets do. */
export function CourseSlideImages({ images, projectName, knodeDir, title }: {
  images?: { src: string; caption?: string; source_url?: string }[]
  projectName: string
  knodeDir: string
  title: string
}) {
  if (!images?.length) return null
  return <div className="my-4 space-y-4">
    {images.map((image, index) => {
      const external = /^(https?:|data:|\/)/.test(image.src)
      const src = external ? image.src : library.fileUrl(projectName, `${knodeDir}/${image.src}`)
      return <figure key={`${image.src}-${index}`} className="mx-auto max-w-4xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={image.caption || title} className="h-auto w-full rounded-lg object-contain" />
        {image.caption && <figcaption className="mt-2 text-sm text-[var(--sub)]">{image.caption}</figcaption>}
        {image.source_url && <a href={image.source_url} target="_blank" rel="noreferrer" className="text-sm underline">来源 / Source</a>}
      </figure>
    })}
  </div>
}
