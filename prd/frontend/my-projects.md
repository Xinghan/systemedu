# Frontend — My Projects (我的项目)

## Routes
| Route | Component | Auth |
|-------|-----------|------|
| `/my-projects` | MyProjectsPage | Required |
| `/my-projects/[id]` | MyProjectDetail | Required |
| `/learn/[projectId]/[knodeId]` | LearnPage (placeholder) | Required |

## My Projects List (`/my-projects`)
- Stars background
- Empty state: AlienTeacher "Start your first quest!" + CTA → `/challenges`
- Card grid: title, original project name, progress bar, status badge
- Card click → `/my-projects/{id}`

## My Project Detail (`/my-projects/[id]`)
- Similar to ProjectContent but with real progress
- Milestone accordion with knode status coloring:
  - locked → gray + lock icon
  - available → blue + "Start" button
  - in_progress → yellow + "Continue" button
  - passed → green + checkmark
  - failed → red + "Retry" button
- "Start/Continue" → `/learn/{projectId}/{knodeId}`
- Real progress bar percentage

## Learn Placeholder (`/learn/[projectId]/[knodeId]`)
- Knode title + summary
- AlienTeacher "Learning module coming soon!"
- Back link → `/my-projects/{projectId}`

## API Calls
- `GET /api/projects/my/` — list forked projects with progress
- `GET /api/projects/{id}/` — project detail (owner can access own forks)
- `GET /api/progress/projects/{id}/` — node progress for project
- `GET /api/projects/{id}/progress-summary/` — progress summary
