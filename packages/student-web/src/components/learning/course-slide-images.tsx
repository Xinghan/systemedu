"use client"

import { useEffect, useState } from "react"
import { myProjects } from "@/lib/api"
import { getToken } from "@/lib/auth"

function CourseImage({ src, alt, authenticated }: { src: string; alt: string; authenticated: boolean }) {
  const [loaded, setLoaded] = useState<{ source: string; url?: string; failed?: boolean } | null>(null)
  useEffect(() => {
    if (!authenticated) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    const token = getToken()
    fetch(src, { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(response => response.ok ? response.blob() : Promise.reject(new Error(`image ${response.status}`)))
      .then(blob => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ source: src, url: objectUrl })
      })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ source: src, failed: true }) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [src, authenticated])
  const current = loaded?.source === src ? loaded : null
  const imageSrc = authenticated ? current?.url : src
  if (!imageSrc) return <p role="status" className="text-sm text-[var(--sub)]">{current?.failed ? "图片未能加载 / Image unavailable" : "正在加载图片 / Loading image"}</p>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc} alt={alt} className="h-auto w-full rounded-lg object-contain" />
}

/** Course images use the same authenticated file endpoint as lesson narration. */
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
      const src = external ? image.src : myProjects.fileUrl(projectName, `${knodeDir}/${image.src}`)
      return <figure key={`${image.src}-${index}`} className="mx-auto max-w-4xl">
        <CourseImage src={src} alt={image.caption || title} authenticated={!external} />
        {image.caption && <figcaption className="mt-2 text-sm text-[var(--sub)]">{image.caption}</figcaption>}
        {image.source_url && <a href={image.source_url} target="_blank" rel="noreferrer" className="text-sm underline">来源 / Source</a>}
      </figure>
    })}
  </div>
}
