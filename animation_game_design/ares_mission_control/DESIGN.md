```markdown
# Design System Documentation: Mission Control Specification

## 1. Overview & Creative North Star

### The Creative North Star: "Kinetic Brutalism"
This design system is engineered for high-stakes remote operations where clarity is survival. We are moving away from the "consumer app" aesthetic and toward a **Kinetic Brutalist** approach. This means the UI should feel like a piece of heavy machinery: industrial, rugged, and unapologetically functional.

We break the "template" look by rejecting soft edges and standard grids. Instead, we embrace **Intentional Asymmetry**. Mission-critical telemetry should feel "docked" into the interface, using overlapping modules and high-contrast typography scales to create a sense of topographical depth. This isn't just a dashboard; it’s a tactical glass cockpit for a multi-billion dollar asset on another planet.

---

## 2. Colors

### The Martian Palette
The color strategy relies on the high-visibility contrast between `primary` (Martian Orange) and the deep `surface` (Space Black).

*   **Primary (#FF7F50 / #ffb59c):** Used for critical action paths, rover status indicators, and mission-essential highlights.
*   **Secondary (#c6c6c6):** Used for structural metadata and inactive industrial components.
*   **Tertiary (#00daf3):** Reserved exclusively for "Data Overlays"—terrain scanning, LIDAR pulses, and atmospheric readings.

### The Rules of Engagement
*   **The "No-Line" Rule:** 1px solid borders for sectioning are strictly prohibited. You must define boundaries through background color shifts. A `surface-container-low` module should sit on a `surface` background to create a "recessed" industrial look.
*   **Surface Hierarchy & Nesting:** Treat the UI as a series of physical plates. Use the `surface-container` tiers (Lowest to Highest) to "stack" importance. For example, the main camera feed sits on `surface-container-lowest`, while the control toggles sit on a `surface-container-high` plate to suggest they are closer to the operator.
*   **The "Glass & Gradient" Rule:** To simulate a HUD (Heads-Up Display), use Glassmorphism for floating telemetry. Use `surface-variant` at 40% opacity with a `backdrop-filter: blur(12px)`. 
*   **Signature Textures:** Main mission CTAs should utilize a subtle linear gradient from `primary` to `primary-container` at a 45-degree angle to provide a "metallic sheen" that flat color cannot replicate.

---

## 3. Typography

The typography strategy pairs the mechanical precision of **Space Grotesk** with the neutral, utilitarian legibility of **Inter**.

*   **Display & Headlines (Space Grotesk):** These are your "Gauges." Use `display-lg` for mission clocks and `headline-md` for section titles. The wide apertures of Space Grotesk convey a futuristic, NASA-inspired authority.
*   **Body & Titles (Inter):** Used for technical logs and coordinate data. Inter provides the necessary "quietness" to balance the aggressive headlines.
*   **Labels (Space Grotesk):** Use `label-sm` in ALL CAPS for telemetry labels (e.g., LATITUDE, BATTERY TEMP). This mimics industrial stencil marking.

---

## 4. Elevation & Depth

In a 0px radius environment, depth is achieved through **Tonal Layering**, not shadows.

*   **The Layering Principle:** Avoid "Drop Shadows" which feel like soft consumer software. If a module needs to "pop," elevate its color to `surface-bright`.
*   **Ambient Shadows:** If a floating HUD element (like a terrain map) requires a shadow for legibility, it must be an **Ambient Tint**. Use a 16px blur with 8% opacity using the `on-surface` color.
*   **The "Ghost Border" Fallback:** For accessibility in high-glare environments, use a "Ghost Border." This is a 1px stroke using the `outline-variant` token at 15% opacity. Never use 100% opaque borders.
*   **Hard Edges:** The `roundedness` scale is set to `0px` globally. Do not deviate. Every corner must be a sharp, industrial 90-degree angle.

---

## 5. Components

### Buttons (Tactile Actuators)
*   **Primary:** Solid `primary` background with `on-primary` text. Use for "INIIATE SCAN" or "DEPLOY."
*   **Secondary:** `surface-container-highest` background with `on-surface` text. Use for non-critical toggles.
*   **State:** On hover, shift the background to `primary-fixed-dim`. No transitions longer than 150ms; interactions should feel "instant" like a mechanical relay.

### Chips (Data Tags)
*   Used for status indicators (e.g., "STABLE," "SIGNAL LAG"). Use `0px` corners and `label-sm` typography. Surround text with a `ghost-border` to maintain a "scientific" look.

### Input Fields (Command Entry)
*   Use `surface-container-low` for the field background. Labels should be `label-md` and placed *above* the field, never inside as placeholders. Use a 2px `primary` bottom-border only when the field is focused to indicate an "active circuit."

### Cards & Modules (The "No Divider" Rule)
*   Forbid the use of divider lines. Separate content blocks using `spacing-8` or `spacing-10` intervals. Change the background from `surface-container` to `surface-container-low` to define a new content area.

### Specialized Component: The Telemetry Strip
*   A horizontal or vertical bar using `surface-container-highest` that houses real-time stream data. It should overlap the main viewport by `spacing-4` to create a "bolted-on" aesthetic.

---

## 6. Do's and Don'ts

### Do:
*   **DO** use intentional asymmetry. Place a heavy `display-lg` readout in the top left and balance it with a small, high-density data grid in the bottom right.
*   **DO** use `tertiary` (Cyan) for anything that represents "invisible" data (radio waves, LIDAR, oxygen levels).
*   **DO** treat white space as "clearance." In industrial design, clearance is functional.

### Don't:
*   **DON'T** use rounded corners. Even a 2px radius breaks the industrial "rugged" vibe.
*   **DON'T** use standard "Blue" for links or info. We are on Mars; use `primary-fixed` or `secondary`.
*   **DON'T** use 100% opaque borders to separate content. Let the surfaces do the work.
*   **DON'T** center-align technical data. Left-align for speed of scanning, or right-align for numerical values.

---

**Director’s Note:** Remember, you are designing for a mission controller who has been awake for 18 hours. The interface should not be "pretty"—it should be authoritative, indestructible, and precise. Every pixel must earn its place on the screen.**```