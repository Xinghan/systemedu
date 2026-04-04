```markdown
# Design System Document: STEM Digital Interface

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Laboratory"**

This design system is engineered to feel like a high-functioning tactical interface—the kind used by orbital engineers or bio-tech researchers. It moves beyond "standard" sci-fi tropes by embracing a "Kinetic Laboratory" aesthetic: a sophisticated blend of heavy data density and airy, translucent layering. 

We break the "template" look through **intentional architectural tension**. By utilizing a rigid `0px` radius (absolute hard edges) against fluid glassmorphism and pulsating neon accents, we create a UI that feels both mathematically precise and technologically alive. The system prioritizes "data-visualization" as a primary art form, treating every UI element as a piece of telemetry.

---

## 2. Colors
The palette is rooted in a deep-space `background` (#121318), punctuated by high-frequency neon phosphors.

### The "No-Line" Rule
Sectioning must never be achieved through 1px solid borders. Instead, define boundaries through:
*   **Tonal Shifts:** Transitioning from `surface_container_low` to `surface_container`.
*   **Negative Space:** Using the Spacing Scale (specifically `8` or `12`) to create "channels" of background color.
*   **The Glow Threshold:** Using subtle `primary` or `secondary` outer glows to define the edge of an active module.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical "data-slabs." 
*   **Base:** `surface_dim` (#121318).
*   **Secondary Modules:** `surface_container_low` (#1a1b21).
*   **Active Overlays:** `surface_container_highest` (#34343a).
Nesting an inner `surface_container_highest` element within a `surface_container_low` section creates a "lifted" sensor array effect without the need for traditional shadows.

### The "Glass & Gradient" Rule
For "Cyber-Cool" depth, floating panels should use a backdrop-blur (12px–20px) combined with 40% opacity on `surface_container_high`. 
*   **Signature Texture:** Use a linear gradient (45°) from `primary` (#dbfcff) to `on_primary_container` (#006970) at 15% opacity as a subtle "scanning" overlay on cards to provide professional polish.

---

## 3. Typography
The system employs a dual-font strategy to balance legibility with technical "read-out" aesthetics.

*   **Display & Headlines (Space Grotesk):** This font provides the geometric authority required for high-tech STEM branding. Use `display-lg` for heroic data points (e.g., "98.4% THRUST").
*   **Body & Titles (Manrope):** A clean sans-serif that ensures long-form research papers or technical specs remain readable.
*   **The Technical Readout (Labels):** Always use `label-md` or `label-sm` in `spaceGrotesk`. These should often be in ALL CAPS with 0.1rem letter spacing to mimic hardware terminal outputs.

---

## 4. Elevation & Depth
In a futuristic interface, depth is simulated through light and transparency, not physical weight.

*   **Tonal Layering:** Avoid shadows for static elements. Use `surface_container_lowest` (#0d0e13) for recessed "input wells" and `surface_container_highest` for elevated "control modules."
*   **Ambient Shadows:** For floating HUD elements, use a diffused glow: `shadow-color: rgba(0, 219, 233, 0.08)` (a tinted version of `surface_tint`). This mimics the light emitted from a holographic display.
*   **The "Ghost Border" Fallback:** If a separator is required for accessibility, use the `outline_variant` token at 15% opacity. This creates a "circuit trace" feel rather than a structural wall.
*   **Geometric Accents:** Use the `px` (1px) spacing token to create ultra-thin "circuit lines" using the `secondary` (circuit-green) or `tertiary` (pulsar-purple) colors to connect related data modules.

---

## 5. Components

### Buttons
*   **Primary:** Hard-edged (`0px`), `primary_container` background. Text in `on_primary`. 
*   **Secondary (Ghost):** No background. `outline` border at 20% opacity. On hover, the border glows with 100% `primary` opacity.
*   **Tertiary:** `tertiary_fixed_dim` text with no container. Used for low-priority "dismiss" actions.

### Data Visualization Cards
*   **The "No-Divider" Rule:** Never use lines to separate list items. Use `spacing-2` as a gap and alternate background colors between `surface_container` and `surface_container_high`.
*   **Circuit Header:** Every card should have a 2px top-border in `primary` or `secondary` that only extends 20% of the card’s width, suggesting an unfinished circuit.

### Input Fields
*   **States:** Default state uses `surface_container_lowest`. On focus, the field gains a "Ghost Border" in `primary` and a subtle 4px inner glow.
*   **Typography:** User input should be `body-md` in `manrope`, while the field label remains `label-sm` in `spaceGrotesk`.

### Tech Chips
*   Used for status indicators (e.g., "STABLE," "CRITICAL").
*   **Visual:** Small, rectangular (`0px` radius). Background uses 10% opacity of the status color (e.g., `error_container` for critical), with the text in the full-vibrancy `error` token.

---

## 6. Do's and Don'ts

### Do
*   **DO** use intentional asymmetry. Align a small data label to the far right while the main headline sits left.
*   **DO** use "Circuit Lines" (`px` thickness) to lead the eye between disconnected data points.
*   **DO** use `tertiary` (pulsar-purple) sparingly as a "high-energy" highlight for bio-tech or exotic energy data.

### Don't
*   **DON'T** use rounded corners (`0px` is the absolute rule). Roundedness breaks the "high-precision hardware" feel.
*   **DON'T** use standard grey shadows. If an element must float, it must "glow" or "blur."
*   **DON'T** overcrowd with neon. Let the `background` (#121318) do the heavy lifting to ensure the neon accents feel earned and high-contrast.
*   **DON'T** use 100% opaque dividers. If you cannot separate elements with space or color shifts, your layout is too cluttered for this system.