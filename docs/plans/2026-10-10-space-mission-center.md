# Space Mission Center Implementation Plan

**Goal:** Add a separate engineering task center for the space mission, preserving the current mission homepage except for a new entry link.

**Architecture:** A task catalog references all 85 existing lesson nodes and three micro experiences. The 62 main steps remain the required route; support/optional/replaced nodes retain their roles. A versioned operations record uses the existing learning-record API for personal task state, checks, blockers, schedule and tracked work. Existing lesson records and the mission dossier remain authoritative and unchanged.

**Tech Stack:** Next.js / React / TypeScript, CSS modules, existing learning records/CAS, existing campus map, Playwright and temporary SQLite tests.

## Product decisions
- New `/mission/space/control` route. Home adds only a navigation entry. Classrooms add a small task-center/work-session strip.
- Recommended design: an engineering workbench (task directory + active task order + timing/constraints). Map-only expansion would hide actions; replacing the homepage violates the requested boundary.
- Center sections: workbench, mission map, schedule, work log, dossier. These are mission management views; no new lesson/media tabs.
- Every task order: stable ID, category, purpose, actions, output, source classroom/resources, checks, prior materials, preparation, evidence/next action, self-reported status and blocker.
- Completion means “self-check complete”; existing submissions/marks are displayed separately, never inferred as assessed mastery.
- Explicit foreground work sessions, pause on hidden/unmount, bounded heartbeat to exclude sleep, 20-minute maximum work block. No retroactive historical time. Same scope across center and classroom, identity isolation and cross-tab timer lock. CAS conflicts stop timing and preserve local data for recovery.
- Planned milestone dates and weekly budget are learner choices; course estimates are labeled, incomplete estimates do not produce a promised completion date. Physical preparation and printing wait are distinct from measured browser work. Offline work may be noted but is not fabricated as tracked time.
- Compact running totals, daily aggregates and recent work log, with a clear recent-history limit. Keep source artifacts separate; no full image copy into operations.

## Implementation steps
1. Extract task-specific goals/actions/outputs/resources from guided trees and the audited full-course tree, with explicit overrides for known hardware/old wording differences. Validate unique coverage and retained curriculum roles.
2. Add typed operations model and time reducer; test validation, elapsed-time bounds, history aggregation and self-check state constraints.
3. Add a reusable work-session hook/strip backed by the existing record session. Test pauses, identity changes, retries and conflicts.
4. Build responsive mission center using existing imagery and design tokens, with map, task filters, milestones, dossier and honest progress.
5. Add only an entry on the current homepage; add return/timing controls to original classrooms and micro shells. Preserve original routes, records, media and downloads.
6. Browser QA at desktop/390px/320px; test source links, self-check state, planning, timing save/reload, account separation, two-tab lock and failures. Verify original home remains identical apart from entry. Build/type/lint baseline comparison; commit and push only this batch.

## Limits
No production deployment or hardware verification. Time reflects explicit recorded browser work, not total past study or automatic proof of learning. No new course generation or media generation.
