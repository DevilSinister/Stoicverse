# App Flow

## Stoicverse single-community flow

**Last updated:** July 12, 2026

## Public and onboarding

1. A visitor opens `/` and sees Stoicverse’s curriculum, membership offer, mentorship offer, and FAQ.
2. `Join` opens `/signup`; the user creates and verifies an email/password account.
3. A verified user without active membership reaches `/checkout`.
4. Stripe confirms the $10 membership through a webhook. The system creates/activates the global membership, creates Tier 1 progress, sends confirmation, and redirects to `/dashboard`.

There is no community selection, influencer page, community slug, or tenant-specific checkout.

## Member journey

- `/dashboard` shows current tier, next eligible lesson, progress, relevant upcoming event, and notifications.
- `/community` shows only channels and posts accessible to the member. Members can react but cannot publish.
- `/courses` shows eligible tiers and sequential lessons. `/courses/lesson/[id]` authorizes access before returning a Google Drive preview. Watch progress is recorded every 15 seconds; 85% completion unlocks the next lesson or tier.
- `/events` shows eligible events. Members may enrol when eligible; the Zoom link is returned only when their tier permits it.
- `/master` is available only after Advanced is complete. It contains Master content and the review-application state.
- `/mentorship` explains the offer until payment succeeds, then shows the assigned mentor, dates, resources, and booking link.

## Staff journey

- Moderators publish, pin, delete, and moderate posts; they create and manage events.
- The influencer signs into `/creator`, which initially mirrors the community surface and keeps the same shared shell, navigation, and inline staff controls.
- The super admin manages members, roles, billing records, platform settings, and platform-wide moderation at `/admin`.

Moderators stay on the member routes. The influencer uses the protected `/creator/*` route family, which is the approved workspace namespace built from the same shared screens.

## Notifications

Tier unlocks, payments, event updates, warnings, review decisions, and mentorship updates create in-app notifications. Events that need email also send transactional messages through Resend.
