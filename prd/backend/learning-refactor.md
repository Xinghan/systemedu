What I would build for your product

I would not make it SVG-only.

I would build a hybrid stack:

SVG + HTML for diagrams, anatomy, architecture plans, network flows, labeled explainers, drag/drop exercises, charts, and step-by-step process animations.
Canvas or Phaser for motion-heavy simulations and simple games: rocket launch, collision, gravity, traffic flow, surgical tool timing, packet movement, factory systems.
Optional SVG/Lottie generation for decorative or reusable vector assets.

The architecture I recommend is:

User prompt
-> pedagogy planner
-> domain grounder
-> engine router
-> JSON lesson/game manifest
-> deterministic compiler
-> sandbox preview
-> smoke tests
-> repair loop
-> publish/share

The key is the JSON lesson/game manifest. Do not ask the model to emit a whole free-form web app first. Ask it to emit a typed spec like:

{
  "audience": { "age": 10, "readingLevel": "simple" },
  "learningGoal": "Understand the basics of rocket launch",
  "interactionType": "parameter_game",
  "engine": "phaser_with_svg_hud",
  "worldModel": {
    "variables": ["thrust", "fuel", "mass", "drag"],
    "constraints": ["fuel decreases over time", "higher mass needs more thrust"],
    "misconceptions": ["more fuel is always better"]
  },
  "ui": {
    "controls": ["thrust slider", "fuel slider", "mass slider", "launch", "reset"],
    "outputs": ["altitude", "speed", "result message"]
  },
  "pedagogy": {
    "hook": "Predict before launching",
    "feedbackStyle": "kid-friendly",
    "successCondition": "reach target altitude"
  }
}

Then compile that manifest into one of a small number of engines.

The engine set I would start with

You do not need a universal engine on day one. You need a small reusable engine family.

A good first set is:

Diagram explorer for labeled SVG explainers.
Parameter simulator for “change sliders and observe outcome.”
Process stepper for sequences like blood circulation, compiler stages, building construction phases.
Drag/drop labeling for anatomy, system components, architecture parts.
Chart/data explorer for statistics, medical vitals, performance graphs.
Mini-game engine for simple 2D educational games with a loop and win/lose states.
State-machine / network-flow visualizer for CS and systems topics.

That engine set can cover a surprising amount of medicine, computer science, architecture, physics, chemistry, business, and civics. The trick is that the runtime stays small while the domain pack changes.

How to cover “all topics”

You will not get good quality across medicine, computer science, and architecture by using one giant unstructured prompt.

You will get much better results by combining three layers:

1. Generic interaction engines.
These are the reusable runtimes above.

2. Domain packs.
Each domain pack provides variables, formulas, process stages, safe constraints, common misconceptions, glossary, and age-adapted wording. For medicine, keep the scope educational and explanatory unless a validated knowledge base and human review are in the loop.

3. Codegen fallback.
When a request does not fit your standard engines, generate a one-off HTML/JS app in a stronger sandbox. That is how you preserve breadth without making every request expensive.

This is the real answer to “cover all topics in real time”: most requests should hit a fast manifest-to-template compiler, and only unusual requests should go to full code generation.

Your rocket example

For the prompt, “I’m 10 years old kid, and I want to learn how the rocket launched,” I would route it to a parameter mini-game.

The generated experience should look like this:

A simple 2D rocket scene.
Sliders for thrust, fuel, and mass.
A big Launch button and Reset button.
A short “predict first” prompt before launch.
During flight: altitude, speed, and fuel indicators.
After flight: a friendly explanation such as “Too heavy,” “Not enough thrust,” or “Great balance.”
A one-question follow-up like “Which variable helped the rocket most this time?”

For the renderer, I would use Canvas/Phaser for flight motion and an SVG/HTML overlay for labels and controls. That gives you smooth animation without losing the clarity and editability of SVG-based UI.

A practical product plan

Phase 1: ship the core generator.
Build the prompt intake, planner, router, manifest schema, 5–7 engines, sandboxed preview, and a teacher-facing edit screen. Keep generation mostly deterministic.

Phase 2: make it educationally strong.
Add age adaptation, domain packs, misconception handling, explanation quality rules, quick assessments, and analytics on whether users actually manipulate the controls and learn the target concept.

Phase 3: expand breadth.
Add one-off code generation for novel requests, remote sandboxes for heavier builds, asset generation for better visuals, and remix/share features.

The tech stack I would choose

For the web product itself:

Next.js/React for the main app and editor.
SVG + HTML as the default renderer.
Phaser for game-like scenes.
Sandboxed iframe for any generated client-only experience.
Remote sandbox infrastructure for codegen fallback or heavier builds. The infrastructure category to study includes CodeSandbox SDK, Cloudflare Dynamic Workers, E2B, and Daytona.

A useful warning: if you study bolt.diy as a reference, check the production implications of the WebContainers path carefully, because StackBlitz documents commercial licensing requirements for production use of that API.

The most important skills to copy from these systems

The best “tech and skill” pattern is not flashy animation. It is disciplined generation:

classify the prompt first,
extract pedagogy and domain constraints,
choose the right engine,
generate a typed manifest,
compile deterministically when possible,
sandbox everything,
test and repair before showing the result.

That is the shared idea behind the strongest public research, the stronger open-source repos, and the commercial prompt-to-app tools.

The six references I would study first are OpenGenerativeUI for routing and iframe rendering, OpenMAIC for education-oriented planning, <generate-html> for security, Renderify for runtime contracts, Text2GameAI for prompt-to-preview plumbing, and Cloudflare/CodeSandbox for sandbox execution.

A strong next step is to draft the JSON manifest schema and the engine router for your SVG/Phaser hybrid.