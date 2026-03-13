# Frontend — Project Detail + Fork

## Route
`/project/[id]`

## Purpose
Show project details (milestones, knowledge nodes, XP) and allow users to fork the project.

## Fork Button Area (below AlienTeacher, above Milestones)
| State | Display | Action |
|-------|---------|--------|
| Not logged in | "Sign in to Start" | → `/login?redirect=/project/{id}` |
| Already forked | "Go to My Copy →" | → `/my-projects/{forkedId}` |
| Not yet forked | "Fork this Project" | POST fork → redirect to `/my-projects/{forkedId}` |

## API Calls
- `GET /api/projects/{id}/` — project detail
- `GET /api/projects/{id}/check-fork/` — check if user already forked (on mount, logged in only)
- `POST /api/projects/{id}/fork/` — fork the project

## Navigation
- "← Back to Challenge Hall" → `/challenges`
