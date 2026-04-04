# Design System Document: The Hyper-Precision HUD

## 1. Overview & Creative North Star
**Creative North Star: The Clinical Sentinel**
This design system moves away from "friendly" consumer tech and toward the uncompromising precision of a high-end medical diagnostic terminal. It is built to feel like a "Med-Pod" interface—sterile, authoritative, and hyper-functional. 

To break the "standard template" look, we employ **Organic Brutalism**. By combining razor-sharp 0px corners with fluid, holographic overlays and pulse-monitoring motion, we create a tension between the rigid data and the living biological matter it monitors. Layouts should favor intentional asymmetry, where data clusters are balanced by "sterile" negative space, mimicking the specialized readouts of a surgical heads-up display (HUD).

## 2. Colors & Surface Logic
The palette is rooted in deep obsidian tones with high-frequency "Diagnostic Blue" highlights to draw the eye to critical data points.

### Surface Hierarchy & Nesting
We reject the flat grid. Instead, we use a tiered layering system to define importance.
- **Base Layer:** `surface` (#111318) for the primary "Pod" environment.
- **Sectional Shift:** Use `surface_container_low` (#1a1c20) to define broad functional areas.
- **Interactive Units:** Use `surface_container_high` (#282a2e) for active modules or diagnostic cards.
- **The "No-Line" Rule:** Under no circumstances should 1px solid borders be used to section content. Boundaries are created exclusively through background shifts (e.g., a `surface_container_lowest` card nested within a `surface_container_low` section).

### The "Glass & Gradient" Rule
To achieve the "holographic" aesthetic, floating diagnostic panels should utilize **Glassmorphism**.
- **Execution:** Use `surface_variant` at 40% opacity with a `backdrop-filter: blur(12px)`. This allows anatomical overlays to "glow" through the interface, creating depth.
- **Signature Textures:** Apply a subtle linear gradient from `primary` (#98cbff) to `primary_container` (#00a3ff) on primary action states and pulse-monitoring lines to give the UI a "powered-on" energy.

## 3. Typography
The system utilizes a dual-font strategy to balance technical precision with clinical legibility.

- **Technical Display:** **Space Grotesk** is used for all `display`, `headline`, and `label` tokens. Its monospaced-esque rhythm conveys the feeling of a real-time data feed.
- **Clinical Reading:** **Inter** is reserved for `body` and `title` tokens. It provides the necessary neutral clarity for patient notes and complex diagnostic descriptions.

**The Scale of Authority:**
- **Display-LG (3.5rem):** Reserved for singular, critical metrics (e.g., Heart Rate, Oxygen Saturation).
- **Label-SM (0.6875rem):** Used for "metadata" annotations around anatomical diagrams, mimicking the tiny precise text on a microscope slide.

## 4. Elevation & Depth
In a sterile HUD, traditional drop shadows feel "dirty" and dated. We achieve lift through light and tone.

- **The Layering Principle:** "Elevation" is the act of stepping up through the surface-container tiers. A "Level 2" element isn't shadowed; it is simply rendered in `surface_container_highest` against a `surface_dim` background.
- **Ambient Shadows:** If a floating element (like a critical alert) requires a shadow, use a "Diagnostic Glow." The shadow color must be `surface_tint` (#98cbff) at 8% opacity with a 32px blur—mimicking light refracting through a glass screen.
- **The "Ghost Border" Fallback:** For high-density data tables where separation is mandatory, use a "Ghost Border": `outline_variant` at 15% opacity.

## 5. Components

### Buttons (The "Actuators")
- **Primary:** `primary_container` background, `on_primary_container` text. Sharp 0px corners. High-contrast hover state using `primary`.
- **Secondary:** Ghost style. No background, `outline` border at 20% opacity. Text in `primary`.
- **States:** On "Active" or "Pressed," add a 2px outer glow using `primary_fixed_dim`.

### Chips (The "Data Tags")
- Used for status (e.g., "STABLE," "CRITICAL"). 
- **Style:** `surface_container_highest` background, `label-md` typography.
- For "Critical" states, use `error_container` with a pulsing opacity animation (0.6 to 1.0).

### Input Fields (The "Data Entry")
- **Visuals:** Forgo the 4-sided box. Use a bottom-only border (`outline`) that glows `primary` when focused.
- **Helper Text:** Must use `label-sm` in `on_surface_variant`.

### Cards & Lists (The "Modules")
- **Rule:** Absolute prohibition of divider lines. 
- Use the **Spacing Scale (16/3.5rem)** to create "sterile zones" between modules. Use subtle background shifts (`surface_container_low` vs `surface_container_lowest`) to distinguish list items.

### Specialist Components
- **Pulse-Monitor Visuals:** Use the `primary` color for polyline graphs. Apply a `drop-shadow` glow to the line itself to simulate a CRT phosphor effect.
- **Anatomical Overlays:** SVG-based skeletal or organ views rendered in `outline` color, with `primary` highlights for "detected anomalies."

## 6. Do's and Don'ts

### Do:
- **Maintain 0px Radii:** Every corner must be a perfect 90-degree angle to maintain the clinical, high-tech vibe.
- **Use Intentional Asymmetry:** Align primary data to the left and secondary "monitor" visuals to the right with varying vertical offsets.
- **Embrace "Data Density":** This system is for professionals. Don't be afraid of small, precise labels and high information density.

### Don't:
- **Don't use Rounded Corners:** Softness kills the "sterile" aesthetic. Even a 2px radius is prohibited.
- **Don't use Solid Dividers:** Lines clutter the HUD. Use space and tonal shifts to organize the eye.
- **Don't use Pure Black (#000000):** Use the `surface` (#111318) to allow for depth and "on-surface" contrast that feels premium, not "crushed."