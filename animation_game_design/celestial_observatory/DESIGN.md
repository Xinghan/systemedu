# Design System Document

## 1. Overview & Creative North Star: The Infinite Horizon
This design system is anchored by a Creative North Star we call **"The Infinite Horizon."** In a domain as vast as cosmology, the interface must feel less like a software application and more like a high-end lens into the universe. We move beyond the "boxed-in" nature of standard web design by embracing the vastness of space—prioritizing immense breathing room, deep atmospheric layering, and a sense of weightlessness.

The system breaks the "template" look through:
*   **Intentional Asymmetry:** Grid layouts should occasionally break, allowing "stellar" elements (featured imagery or data points) to float across column boundaries.
*   **Atmospheric Depth:** The UI is not a flat plane; it is a three-dimensional volume where information sits within "nebular" clouds of light.
*   **High-Contrast Scale:** Dramatically oversized Display type paired with generous letter-spacing creates a sense of cosmic scale and editorial prestige.

---

## 2. Colors & Atmospheric Layering
The palette is a journey through the electromagnetic spectrum, moving from the cold depths of the vacuum to the intense heat of a dying star.

### Color Tokens
*   **Deep Space (Neutral):** `background: #111220` (The void).
*   **Stellar White (Primary):** `primary: #c9bfff` (The glow of distant stars).
*   **Supernova Gold (Secondary):** `secondary: #fff9ef` / `secondary_container: #ffdb3c` (The accent of high-energy phenomena).
*   **Nebular Tones:** Utilizing `primary_container: #1e006e` and `surface_container_highest: #333343` for deep violet depth.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. In the vacuum of space, there are no hard edges. Define boundaries solely through:
1.  **Background Shifts:** Place a `surface_container_low` section atop the `background` to create a soft "plateau" of information.
2.  **Luminous Transitions:** Use soft, radial gradients of `primary_container` (at 10-15% opacity) to suggest the edge of a container.

### The Glass & Gradient Rule
To achieve "The Infinite Horizon" look, all floating containers must utilize Glassmorphism.
*   **The Signature Surface:** Use `surface_variant` at 40% opacity with a `backdrop-blur` of 20px. 
*   **Signature Textures:** Apply a subtle noise texture (2% opacity) over backgrounds to simulate star-field grain. Main CTAs should use a linear gradient: `primary` (#c9bfff) to `on_primary_container` (#8771ff) at a 135-degree angle.

---

## 3. Typography: The Editorial Star-Chart
Typography is our primary tool for conveying elegance. We utilize two distinct families: **Space Grotesk** for structural authority and **Manrope** for legibility and data-density.

*   **Display & Headlines (Space Grotesk):** These should always feel expansive. For `display-lg` (3.5rem) and `headline-lg` (2rem), increase `letter-spacing` to `0.05em` to mimic the "spaced out" nature of the stars.
*   **Body & Titles (Manrope):** The workhorse of the system. `body-lg` (1rem) provides a grounded contrast to the airy headlines.
*   **Labels (Space Grotesk):** Small caps or wide-tracked labels (`label-md`) should be used for metadata like "Light Years" or "Magnitude," treated as if they were coordinates on a star chart.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows have no place in a system without a single sun. Instead, we use **Luminous Stacking.**

*   **The Layering Principle:** 
    *   **Base:** `background` (#111220).
    *   **Level 1 (Subtle zones):** `surface_container_low`.
    *   **Level 2 (Cards/Interactives):** `surface_container_high`.
    *   **Level 3 (Modals/Pop-overs):** `surface_bright` with Glassmorphism.
*   **Ambient Shadows:** If a "lift" is required for a floating module, use a shadow color derived from `primary_container` (#1e006e) at 20% opacity with a 40px blur. This creates a "glow" rather than a shadow.
*   **The Ghost Border:** For high-density data, use `outline_variant` at 15% opacity. It should be barely visible, felt rather than seen.

---

## 5. Components

### Buttons: Celestial Pulsars
*   **Primary:** High-energy. Use the Signature Gradient (Primary to Primary-Container). Roundedness: `full`.
*   **Secondary:** The "Stellar White" variant. `outline_variant` Ghost Border with `on_surface` text.
*   **State:** On hover, primary buttons should increase their "outer glow" (box-shadow) using the `primary` color at 30% opacity.

### Navigation: The Constellation List
*   **Lists:** Forbid divider lines. Separate items using `Spacing 4` (1.4rem) and a background shift to `surface_container_low` on hover.
*   **Selection:** Use a `supernova gold` (#ffdb3c) dot (4px) to the left of the active list item, mimicking a focused star.

### Cards: Nebular Modules
*   **Styling:** No borders. Use `surface_container` with a `xl` (1.5rem) corner radius. 
*   **Interactive:** On hover, the card should scale slightly (1.02x) and the backdrop-blur should increase, making the background "nebula" feel more intense.

### Data Inputs: The Observatory Console
*   **Fields:** Background should be `surface_container_lowest`. The active state is indicated by a "glow" on the bottom edge using the `primary` token.
*   **Checkboxes/Radios:** Use `secondary` (#fff9ef) for the checked state to provide a "brilliant" pop against the dark backgrounds.

### Additional Component: The Light-Speed Progress Bar
A custom progress bar for data loading or orbital cycles. It uses a `primary` to `transparent` gradient that "pulses" or moves along the track, evoking long-exposure star trails.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Negative Space:** If a screen feels "busy," increase the spacing scale (use `Spacing 16` or `20`).
*   **Use Imagery as Architecture:** Let high-resolution photos of galaxies act as the "walls" of your layout, with UI elements floating over them using glassmorphism.
*   **Layer Transitions:** When an element appears, it should fade and scale from 95% to 100%, mimicking a lens coming into focus.

### Don’t:
*   **Don't use pure black:** Always use the deep indigo `background` (#111220) to maintain "visual soul."
*   **Don't use 100% opaque borders:** This breaks the illusion of a continuous, infinite space.
*   **Don't crowd the type:** Avoid tight line-heights. The universe is vast; your text should reflect that.
*   **Don't use "Flat" buttons:** Every interactive element should have a hint of luminosity or depth.