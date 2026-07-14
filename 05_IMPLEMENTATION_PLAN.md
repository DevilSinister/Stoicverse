# Implementation Plan and Delivery Status

## Stoicverse

**Last updated:** July 12, 2026
**Authoritative scope:** One global Stoicverse community.

## Implemented foundation

- Next.js 16 / React 19 application shell, Tailwind design tokens, public landing/auth/legal pages, and protected member routes.
- Supabase SSR clients, authentication callback, route proxy, active-membership, Master, and super-admin guards.
- Single-community Supabase schema with profiles, memberships, tiers, lessons, posts, events, applications, mentorships, payments, notifications, and RLS scaffolding.
- Read views for dashboard, community, courses, events, Master, mentorship, checkout, and admin; search and notification display UI.
- Event UI plus server actions for enrolment, influencer event drafts/manual publishing, lifecycle management, in-app notifications, attendee metrics, and publishing an event Zoom link.
- Account profile/password UI and basic role-aware screen controls.

## Must complete before MVP launch

### Access and data safety

- Remove client-controlled membership-cookie trust from server authorization.
- Enforce suspension, membership, role, sequential lesson, Master, and minimum-tier rules in RLS and server queries.
- Do not select or expose Zoom URLs, Drive identifiers, or gated content before authorization.
- Align event policies with the approved moderator/influencer permission model.

### Payments and account lifecycle

- Add Stripe dependencies, checkout session creation, signature-verified webhook handling, idempotency, and payment/membership/mentorship persistence.
- Add Resend email delivery for verification, payment, tier, review, mentorship, and password-reset events.

### Community and curriculum

- Implement channel, post, reaction, pin, deletion, image-upload, moderator-management, and lesson-management mutations.
- Maintain the authenticated course-video Drive preview endpoint/player, 15-second progress recording, 80% sequential unlocks, prerequisite-aware enrolment, influencer finalization/revisions, and atomic tier rewards.
- Create notifications and realtime updates rather than only rendering stored notification rows.

### Workflows and operations

- Implement review and team application submission, staff review/scheduling/decision flow, mentorship purchase/assignment/fulfilment, and functional admin operations.
- Add automated unit, integration, and RLS tests; restore a Node/npm toolchain and enough system disk space to run lint, type checks, and a production build.

## Existing extra or unapproved behaviour

| Behaviour | Status | Required disposition |
| --- | --- | --- |
| Annual membership and recurring `$10/mo` presentation | Not in approved product scope | Remove UI and checkout query handling until separately approved. |
| `/creator` route | Approved influencer-only workspace namespace | Retain it as the canonical influencer destination; build it from the same shared member UI and redirect influencer sessions there. |
| `/subscription`, `/subscription/commitment`, `/log-in`, and `/sign-up` routes | Legacy or duplicate surface area | Redirect or remove after confirming no live inbound links. |
| Event enrolment and optional delayed Zoom publication | Useful extension, not previously specified | Retain and document as approved event behaviour; secure it with tier-aware policies. |
| Search, profile settings, and notification display | Useful extension | Retain; complete their backend lifecycle and tests. |

## Documentation maintenance rule

The PRD, TRD, app flow, schema, product context, and design system use the same single-community terminology. Do not reintroduce community selection, slugs, owners, or tenant-scoped roles without an explicit product decision.
