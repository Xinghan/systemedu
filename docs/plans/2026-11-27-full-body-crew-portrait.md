# Full-body crew portrait implementation plan

**Goal:** Generate a complete head-to-shoes cartoon portrait from the learner's photo and display it in the iPad crew profile without losing the recognizable small face avatar.

**Scope:** The user cancelled animated 3D on 2026-11-27. No Meshy integration, model generation, rigging or motion controls are included. Reuse the existing image-edit service.

**Architecture:** Store the accepted full illustration and a separate face thumbnail in the existing crew profile, with optional framing metadata for backward compatibility. Existing photographs are not stored or automatically uploaded. An existing accepted cartoon can be explicitly expanded into a full-body portrait.

**Tech stack:** Existing Wan image-edit adapter, SwiftUI, UIKit/ImageIO/Vision, existing SQLite profile document.

## Work

1. Update the fixed image prompt and portrait canvas. Return a framing revision and retain enough image resolution for an iPad profile.
2. Preserve old profiles and receipts; add optional thumbnail/framing fields. Derive the thumbnail once when an illustration is accepted.
3. Show a complete illustration in the crew profile and project home. Keep compact navigation/classroom portraits using the face thumbnail.
4. Expose an explicit full-body regeneration action for existing cartoons; preserve the previous accepted profile until confirmation.
5. Verify photo sanitation, full-body output, face crop, old-record decoding, editing cancellation, portrait/landscape fit and profile re-entry. Use synthetic artwork for provider tests, never student photographs.
6. Install on the existing iPad Air 11-inch (M4), restore normal records, review the exact diff, commit and push.

## Acceptance

- Generated illustration includes hair, hands, legs and both shoes, with margins.
- Profile keeps the complete illustration visible; compact avatars remain face-centered.
- Changing the image does not change lesson completion or signed work.
- Generation is explicit, cancellable and retryable. No 3D capability is claimed.

## Completed verification

Implemented the native profile, full-body generation and existing-avatar upgrade, with a separate face thumbnail. Debug build, 11 Python service checks, 4 native unit checks, 2 UI tests and 1 opt-in live provider integration passed. Synthetic screenshots and exact limitations are recorded in `artifacts/space-expedition-20261127/full-body-profile/README.md`. The app is installed on the specified iPad simulator; the existing user's avatar still awaits explicit regeneration and confirmation in the editor.
