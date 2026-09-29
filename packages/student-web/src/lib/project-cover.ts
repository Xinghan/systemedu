import covers from "./project-lines/project-cover-variants.json"

type Cover = { variants: { src: string; width: number }[] }

/** Static WebP variants keep original course artwork intact and avoid large API PNG downloads. */
export function projectCoverProps(slug: string, fallback: string, placement: "card" | "hero") {
  const cover = (covers as Record<string, Cover>)[slug]
  if (!cover?.variants.length) return { src: fallback }
  const target = placement === "card" ? 800 : 1280
  const preferred = cover.variants.find(item => item.width >= target) ?? cover.variants.at(-1)!
  return {
    src: preferred.src,
    srcSet: cover.variants.map(item => `${item.src} ${item.width}w`).join(", "),
    sizes: placement === "card"
      ? "(max-width: 600px) calc(100vw - 32px), (max-width: 1000px) 45vw, 400px"
      : "(max-width: 1100px) calc(100vw - 48px), 1050px",
  }
}
