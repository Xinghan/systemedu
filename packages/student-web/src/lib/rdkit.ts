import type { RDKitLoader, RDKitModule } from "@rdkit/rdkit"

const RDKIT_BASE_URL = "/vendor/rdkit"
const RDKIT_SCRIPT_URL = `${RDKIT_BASE_URL}/RDKit_minimal.js`

let modulePromise: Promise<RDKitModule> | null = null

/**
 * Loads the pinned RDKit.js build from this application, never a CDN. The
 * JavaScript and its matching WebAssembly binary are served from the same
 * versioned directory as required by RDKit.js.
 */
export function getRDKitModule(): Promise<RDKitModule> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("RDKit can only render in the browser."))
  }

  if (modulePromise) return modulePromise

  modulePromise = new Promise<void>((resolve, reject) => {
    const existingLoader = window.initRDKitModule as RDKitLoader | undefined
    if (existingLoader) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = RDKIT_SCRIPT_URL
    script.async = true
    script.dataset.technicalRenderer = "rdkit"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("RDKit.js failed to load."))
    document.head.appendChild(script)
  }).then(() => {
    const loader = window.initRDKitModule as RDKitLoader | undefined
    if (!loader) {
      throw new Error("RDKit.js did not expose its module loader.")
    }
    return loader({
      // The browser script is already loaded from this directory. The only
      // follow-up file requested by RDKit.js is its matching WASM binary.
      locateFile: () => `${RDKIT_BASE_URL}/RDKit_minimal.wasm`,
    })
  })

  return modulePromise
}

export type SmilesDrawingOptions = {
  width?: number
  height?: number
  highlightAtoms?: number[]
  explicitHydrogens?: boolean
}

/**
 * Produces RDKit's deterministic molecule SVG. RDKit owns bond placement,
 * aromaticity and atom labels; course content supplies only a validated SMILES
 * string and optional source-grounded atom indices to highlight.
 */
export async function drawSmilesSvg(
  smiles: string,
  { width = 430, height = 260, highlightAtoms = [], explicitHydrogens = false }: SmilesDrawingOptions = {},
) {
  const rdkit = await getRDKitModule()
  const original = rdkit.get_mol(smiles)
  if (!original) throw new Error(`Invalid SMILES: ${smiles}`)
  let molecule = original

  try {
    if (explicitHydrogens) {
      const expanded = rdkit.get_mol(original.add_hs())
      if (!expanded) throw new Error("Could not build the explicit-H graph")
      molecule = expanded
      // RDKit produces a fresh 2D depiction; these are not the source 3D coordinates.
      molecule.set_new_coords()
    }
    return molecule.get_svg_with_highlights(JSON.stringify({
      width,
      height,
      // Skeletal notation is correct but a lone two-carbon line is too terse
      // for this first instructional comparison. Keep the real RDKit layout
      // while showing its terminal methyl groups explicitly.
      explicitMethyl: true,
      ...(highlightAtoms.length > 0 ? {
        atoms: highlightAtoms,
        highlightAtomColors: Object.fromEntries(
          highlightAtoms.map((atomIndex) => [atomIndex, [1, 0.75, 0.2]]),
        ),
      } : {}),
    }))
  } finally {
    // RDKit.js owns a WebAssembly-backed C++ object. Explicit deletion avoids
    // retaining a molecule each time a learner changes slides.
    molecule.delete()
    if (molecule !== original) original.delete()
  }
}
