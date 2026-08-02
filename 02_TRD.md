# Technical Requirements Document

## Stoicverse

**Version:** 2.0
**Last updated:** July 12, 2026

## Architecture

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, and shadcn/Base UI components.
- **Platform:** Supabase Auth, PostgreSQL, Row Level Security, and Storage for non-video assets.
- **Payments and email:** Stripe Checkout/webhooks and Resend.
- **Video:** Google Drive preview embeds. The server validates access and constructs the preview URL from a stored file identifier.
- **Hosting:** Hostinger VPS behind Nginx and PM2; Cloudflare provides DNS and edge protection.

## Data and authorization model

Stoicverse has one global community. There are no community ids, community slugs, tenants, community owners, or `community_roles` records.

`profiles.platform_role` is one of `member`, `moderator`, `influencer`, or `super_admin`. At most one influencer exists. `memberships` represents one global paid membership per user. `member_tiers` represents the user’s current tier and Master state.

Every protected request must validate authentication, suspension state, active membership, role, and tier where applicable. Row Level Security must enforce the same boundary for direct Supabase access:

- Tier-gated channels, posts, courses, course videos, event records, and Zoom links are returned only to qualified members or authorized staff.
- Lesson video identifiers and embed URLs are never selected for unauthorized users.
- Staff writes are restricted to the correct global roles; moderator and influencer capabilities must match the UI.
- Payments, membership activation, mentorship activation, and notification writes occur only in trusted server-side webhook/service code.

## Required service interfaces

- Supabase auth callback, sign-up, sign-in, sign-out, password reset, and profile update.
- Stripe Checkout session creation for membership and mentorship; a signature-verified, idempotent Stripe webhook.
- Authorized mutation endpoints/server actions for posts, reactions, channels, events, lessons, progress, review applications, mentorship management, notifications, and admin operations.
- Course-video endpoints authorize enrolment, tier, prerequisites, and preceding-video completion before returning a Drive preview; bounded progress completes at 80% and awards course/tier completion atomically.

## Security and operational requirements

- Sessions use secure HTTP-only cookies. Application code must not treat a client-writable convenience cookie as proof of membership.
- Validate input, enforce rate limits for auth and APIs, and use HTTPS in production.
- Verify Stripe signatures and record Stripe event ids before processing to make webhooks idempotent.
- Use server-side secrets only for Supabase service access, Stripe, and Resend.
- Required environment variables: Supabase URL/anon key/service-role key, Stripe secret/publishable/webhook keys, Resend key, app URL, and super-admin bootstrap email.

## Explicitly absent today

The repository has no Stripe or Resend integration, webhook endpoint, Edge Function, Google Drive player/progress implementation, realtime notifications, automated tests, or production verification command available in the current environment. These remain implementation work, not completed requirements.
