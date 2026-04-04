# Design System: Genetic Synthesis & Mapping

## 1. Overview & Creative North Star
### The Creative North Star: "The Bioluminescent Laboratory"
This design system rejects the cold, sterile tropes of traditional medical software. Instead, it embraces **The Bioluminescent Laboratory**—a concept where high-fidelity data visualization meets the fluid, organic movement of life itself. We are creating a digital environment that feels like a high-tech HUD projected onto a petri dish.

To break the "template" look, we utilize **Intentional Asymmetry**. DNA isn't perfectly symmetrical, and neither is our layout. Elements should overlap, labels should feel like "probes" tethered to data points, and the transition between deep obsidian (`surface`) and emerald glows (`primary`) should feel like light catching a microscopic specimen.

---

## 2. Colors & Atmospheric Depth
Our palette is a high-contrast interplay between the void of `surface` and the radioactive energy of our primary accents.

### The "No-Line" Rule
**Borders are a failure of hierarchy.** Within this system, 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through:
- **Tonal Shifts:** Placing a `surface-container-low` component on a `surface` background.
- **Luminous Transitions:** Using a soft `primary` glow to indicate the start of a new data cluster.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked biological slides. 
- **Base Layer:** `surface` (#0c0e12) for the deep obsidian "void."
- **Data Layers:** Use `surface-container-low` for large secondary modules.
- **Active Focus:** Use `surface-container-high` or `highest` for the most critical interactive panels, creating a "lift" toward the user.

### The "Glass & Gradient" Rule
To capture the "bio-tech futuristic" vibe, use **Glassmorphism** for all floating HUD elements. 
- **Formula:** `surface-container` color at 60% opacity + `backdrop-filter: blur(20px)`.
- **Signature Texture:** Primary CTAs should never be flat. Use a linear gradient from `primary` (#50ffb0) to `primary-container` (#17df93) at a 135-degree angle to simulate the depth of a glowing enzyme.

---

## 3. Typography: Space Grotesk
We use **Space Grotesk** for its mathematical precision and slightly "off-beat" futuristic geometry. It bridges the gap between a high-tech lab and a specialized editorial piece.

*   **Display (Display-LG/MD):** Used for genomic sequence headers. Set with tight letter-spacing (-0.02em) to feel like a dense, authoritative data block.
*   **Headlines:** Reserved for major section titles. These should feel like "specimen labels."
*   **Body (Body-MD):** The workhorse for metadata. Use `on-surface-variant` (#aaabb0) to ensure the background remains the dominant visual force.
*   **Labels (Label-SM):** The "HUD" text. Use these for technical readouts (e.g., base pair counts). These should often be all-caps with increased letter-spacing (+0.1em) to mimic telemetry data.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows feel "architectural"; we need "atmospheric."

### The Layering Principle
Avoid shadows on nested components. If a card sits inside a section, differentiate it by moving from `surface-container-low` to `surface-container-lowest`. This "recessed" look suggests a specialized viewing chamber.

### Ambient Shadows
For floating modal HUDs, use an **Emerald Ambient Shadow**:
- **Color:** `primary` at 8% opacity.
- **Spread:** 40px to 60px blur. 
- This mimics the glow of a luminescent DNA strand reflecting off the dark obsidian background.

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use the **Ghost Border**: `outline-variant` (#46484d) at 15% opacity. It should be felt, not seen.

---

## 5. Components & Interface Primitives

### Buttons
*   **Primary:** Gradient of `primary` to `primary-container`. `Rounded-full` (pill shape) to mimic organic cells. No border.
*   **Secondary:** Ghost style. No background, `outline` color for text, and a 10% `primary` background on hover.
*   **Tertiary:** `Label-MD` text with a small `secondary` (#acf900) dot to the left, acting as a "pulse" indicator.

### Genomic Cards
**Prohibit divider lines.** Use `1.75rem` (Spacing 8) of vertical whitespace to separate data clusters. Content within cards should be grouped using `surface-container-highest` backgrounds for specific data-cells.

### HUD Chips
Use `secondary` (Acid Green) for status indicators. These should have a subtle "pulse" animation (opacity 1.0 to 0.6) to suggest live biological monitoring.

### Specialized Component: The Sequence "Probe"
A custom component consisting of a thin `primary` line (0.5px) connecting a data point in a 3D DNA model to a `surface-container` data card. This creates the "Laboratory HUD" aesthetic.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Asymmetry:** Let a genome sequence bleed off the edge of the screen.
*   **Layer with Purpose:** Use the full spectrum of `surface-container` tiers to create depth.
*   **Organic Curves:** Use `xl` (3rem) or `full` roundedness for interactive elements to mimic cellular structures.

### Don’t:
*   **Don't use 100% white:** Use `on-surface` (#f6f6fc). Pure white breaks the "bioluminescent" immersion.
*   **Don't use Grids for everything:** Allow floating HUD elements to "break" the vertical rhythm.
*   **Don't use standard Dividers:** If you need to separate content, use a background color shift or a `0.1rem` (Spacing 0.5) gap that reveals the `surface` (obsidian) beneath.

### Accessibility Note:
While we lean into deep obsidian and glows, ensure all "Body" and "Title" text maintains a contrast ratio of at least 4.5:1 against their respective `surface-container` backgrounds using the `on-surface` tokens.