# Database Schema

## Stoicverse single-community model

**Last updated:** July 12, 2026

## Scope

All application data belongs to one single global Stoicverse community. The schema must not add `communities`, `community_roles`, a community slug, a tenant identifier, or `community_id` unless the product scope changes explicitly.

## Identity and access

Supabase Auth owns `auth.users`. `profiles` adds `full_name`, `avatar_url`, `is_suspended`, and global `platform_role` (`member`, `moderator`, `influencer`, `super_admin`). A partial unique index limits the platform to one influencer.

`platform_settings` is a singleton configuration record. `memberships` stores the global paid-access lifecycle; `member_tiers` stores a member’s tier and Master state.

## Core records

- Content: `channels`, `posts`, `reactions`, `events`, and the named curriculum tables `courses`, `course_prerequisites`, `course_videos`, and protected `course_video_assets`. Legacy lesson tables remain for migration safety.
- Learning state: `course_enrollments`, `course_video_progress`, and `course_completion_grants`.
- Applications and fulfilment: `review_applications`, `team_applications`, and `mentorships`.
- Operations: `payments`, `notifications`, and `stripe_webhook_events`.

`course_video_assets.video_file_id` stores a provider identifier only and is exposed solely by an authorized database function. `events.zoom_url` is sensitive, tier-gated content rather than public event metadata.

## Required RLS invariants

- Users read or update only their own profile fields; staff controls role and suspension state.
- Active, non-suspended membership is required for protected Stoicverse data.
- Database policies enforce minimum tier for all gated channels, posts, lessons, event links, and Master content.
- Staff may perform only the operations granted by their global role; policies and UI must agree.
- Payment, webhook, membership activation, mentorship activation, and system notifications use trusted server-side access only.
- Stripe event ids remain unique to prevent duplicate webhook effects.

## Automation

Membership activation creates a Tier 1 record if absent. Course-video completion, sequential access, course completion, and tier advancement run atomically. Required post-finish additions invalidate prerequisite completion without lowering an already-earned tier.

The active schema originates in `supabase/migrations/20260711000005_single_stoicverse_schema.sql`; later migrations may refine it but must preserve these invariants.
