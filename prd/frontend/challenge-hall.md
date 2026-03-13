# Frontend — Challenge Hall (挑战大厅)

## Route
`/challenges`

## Purpose
Browse published projects available for learning. Entry point for users to discover and fork projects.

## Layout
- Stars background + AlienTeacher welcome message
- CategoryFilter: horizontal tag bar (All / AI / Biotech / Aerospace / Music / Climate / ...)
- 2-3 column ProjectCard grid (responsive)

## Components

### CategoryFilter
- Horizontal scrollable tag bar
- Client-side filtering (no API call per category)
- "All" selected by default

### ProjectCard
- Title, category badge, milestone count
- Estimated hours, fork count
- Link to `/project/{id}`
- Hover effect with scale

## API Calls
- `GET /api/projects/` — list published projects

## Navigation
- Landing page "Start Quest" → `/challenges`
- Each card → `/project/{id}`
