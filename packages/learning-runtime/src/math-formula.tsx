import katex from "katex"
import "katex/dist/katex.min.css"

export function MathFormula({ tex, label }: { tex: string; label: string }) {
  return <span role="math" aria-label={label} dangerouslySetInnerHTML={{ __html: katex.renderToString(tex, { throwOnError: false, trust: false, output: "htmlAndMathml" }) }}/>
}
