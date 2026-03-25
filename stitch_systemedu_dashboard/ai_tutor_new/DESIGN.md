# Design System Document: High-End Editorial AI Experience

## 1. Overview & Creative North Star
The design system for this AI-powered education platform is anchored by the Creative North Star: **"The Cognitive Sanctuary."** 

Unlike generic ed-tech platforms that rely on heavy borders and cluttered grids, this system treats the interface as a sophisticated, breathable environment for deep learning. We break the "template" look by utilizing intentional asymmetry, expansive negative space, and a high-contrast editorial typography scale. The goal is to make the user feel like they are interacting with an intelligent, living curator rather than a static database. 

We achieve a "premium tech" feel by layering surfaces like fine sheets of frosted glass, ensuring that every transition and element feels intentional and weightless.

## 2. Colors
Our palette balances the authority of deep slate with the kinetic energy of AI innovation.

*   **Primary Logic (`primary` #6a1cf6):** Reserved for high-intent actions and the "pulse" of AI. 
*   **Secondary Innovation (`secondary` #006859):** A sophisticated teal used for progress indicators and success states, grounding the purple with a sense of stability.
*   **Neutral Structure:** We use a cool-toned foundation (`background` #f8f5ff) to keep the experience feeling fresh and expansive.

### The "No-Line" Rule
To maintain an editorial, high-end aesthetic, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined solely through:
1.  **Tonal Shifts:** Placing a `surface-container-low` component on a `surface` background.
2.  **Soft Shadows:** Utilizing ambient light to define edges.
3.  **Vertical Space:** Using the Spacing Scale to let content breathe.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. Use the `surface-container` tiers to create depth:
*   **Level 0 (Base):** `surface` #f8f5ff.
*   **Level 1 (Sections):** `surface-container-low` #f1efff for large content areas.
*   **Level 2 (Cards):** `surface-container-lowest` #ffffff for interactive elements that need to "pop" off the page.

### The "Glass & Gradient" Rule
Floating elements (like sidebars or hovering modals) should use a Glassmorphism effect:
*   **Background:** Semi-transparent `surface` with a `backdrop-blur` of 12px to 20px.
*   **Texture:** Apply a subtle linear gradient from `primary` to `primary-container` on major CTAs to add "soul" and professional polish.

## 3. Typography
The system uses a tri-font strategy to balance character with readability.

*   **Display & Headlines (Plus Jakarta Sans):** Used for large, expressive moments. This font’s modern geometry conveys "Intelligent & Futuristic."
*   **Titles & Body (Inter):** The workhorse. High legibility for complex educational content.
*   **Labels (Manrope):** A tech-forward sans used for data points, chips, and micro-copy.

**Hierarchy Strategy:** Use `display-lg` for hero welcome messages to create a sense of scale. Use `body-md` for standard instructional text to ensure the interface doesn't feel "loud."

## 4. Elevation & Depth
Depth is a functional tool, not just a decoration.

*   **The Layering Principle:** Instead of shadows, prioritize tonal layering. A `surface-container-highest` navigation item against a `surface-container` sidebar creates a clear, sophisticated active state without visual noise.
*   **Ambient Shadows:** For floating action buttons or high-level modals, use a shadow with a 24px-32px blur and 6% opacity. The shadow color should be tinted with `on-surface` (#19227d) to avoid a "dirty" grey look.
*   **The "Ghost Border" Fallback:** If a container sits on a background of the same color, use a "Ghost Border": `outline-variant` (#9ea6ff) at **15% opacity**.
*   **Interaction Depth:** Upon hover, a card should transition from `surface-container-lowest` to a slightly lifted state using a soft ambient shadow, rather than changing its border color.

## 5. Components

### Navigation (The Sleek Sidebar)
The desktop sidebar uses a "curated list" style. 
*   **Active State:** Use a soft-pill background (`surface-container-highest`) with a `primary` left-accent bar (4px width).
*   **Glassmorphism:** The sidebar should utilize a subtle `backdrop-blur` when over content.

### Buttons
*   **Primary:** Gradient-fill (`primary` to `primary-container`), `rounded-md` (0.75rem), white text. No shadow.
*   **Secondary:** Ghost style. No background, `primary` text, and a Ghost Border on hover.
*   **Tertiary:** Text-only with an icon.

### Cards & Lists
*   **Rule:** Forbid divider lines. 
*   **Separation:** Use `spacing-8` (2rem) between cards. Content within cards should use `surface-container-low` for internal grouping (e.g., a metadata footer).
*   **Corner Radius:** Use `rounded-lg` (1rem) for main cards to emphasize the "soft tech" personality.

### Chips
*   **Contextual:** Use `secondary-container` for AI-generated tags.
*   **Filtering:** Use `surface-container-highest` with `label-md` typography.

### Input Fields
*   **Style:** Minimalist. A simple `surface-container-low` background with a bottom-only `primary` focus line (2px). Forbid the "four-sided box" look.

## 6. Do's and Don'ts

### Do
*   **Do** embrace asymmetry. Allow images or AI visualizations to bleed off the grid to create a bespoke, editorial feel.
*   **Do** use `on-surface-variant` for secondary text to maintain a high-contrast but readable hierarchy.
*   **Do** use white space as a structural element. If a layout feels cluttered, increase the spacing scale rather than adding a line.

### Don't
*   **Don't** use 100% black for shadows or text. Always use the navy-tinted `on-surface` or `inverse-surface`.
*   **Don't** use "default" system transitions. All hover and entry animations should be slightly slower (300ms-400ms) with a `cubic-bezier(0.2, 0.8, 0.2, 1)` easing for a premium, weighted feel.
*   **Don't** crowd the AI accents. The `electric purple` and `teal` are seasonings, not the main course. Use them sparingly to highlight intelligence and progress.