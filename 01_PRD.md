# Product Requirements Document (PRD)
## Community Learning Platform

**Version:** 1.0  
**Owner:** Super Admin (Sinister)  
**Last Updated:** July 2026

---

> **Scope update (July 11, 2026):** Stoicverse is one paid Stoic community, not a multi-community platform. The active database model has no community owners, community selection, community slugs, `communities` table, or `community_roles` table. Any earlier wording about multiple influencer communities is obsolete. There may be one global influencer role, plus moderators and a super admin.

## 1. Overview

A Discord-style community platform with a paywall, course system, and tier progression. Members pay to join influencer-run communities, consume gated video content, and progress through tiers. Influencers and moderators manage the community directly from the same UI as regular members — no separate panel needed.

---

## 2. Goals

- Let influencers run paid communities with full content and channel control
- Gate content behind membership and tier progression
- Keep the UI simple: one interface, role-based controls shown/hidden conditionally
- Avoid expensive managed infrastructure — Hostinger VPS + Google Drive for video
- Scale to ~30,000 members across multiple influencer communities

---

## 3. User Roles

### 3.1 Super Admin (you)
- Single account, full platform control
- Dedicated admin panel at `/admin`
- Can add/remove influencers
- Can view stats across all communities
- Can suspend any user, any community
- Can manage billing and platform settings

### 3.2 Influencer
- Owns one or more communities
- No separate dashboard — extra UI controls appear inline on the same pages members see
- Can create and delete channels
- Can post text, images, and events in any channel
- Can pin and delete any message in their community
- Can assign and remove moderators
- Can upload course videos (via Google Drive link)
- Can view their own community stats (member count, tier breakdown, active users)
- Cannot access other influencers' communities or data

### 3.3 Moderator
- Assigned by influencer, scoped to that community only
- Same page as members, but extra controls appear inline
- Can post text and images
- Can delete any message
- Can pin messages
- Can kick or warn members
- Can view the member list and basic stats
- Cannot create or delete channels
- Cannot assign other moderators

### 3.4 Member
- Pays $10 to join a community
- Read-only in most channels (can react to posts)
- Watches course videos and progresses through tiers
- Locked channels are hidden (not just greyed out) based on tier
- Can apply for mentorship ($1,000) independently of tier
- Can apply for review call after reaching Master tier
- Cannot post, DM, or create channels

---

## 4. Core Features

### 4.1 Communities & Channels

- Each influencer runs one community
- Communities contain channels (Discord-style)
- Influencer can create channels of these types:
  - **Text channel** — posts, images
  - **Announcements channel** — influencer/mod only can post
  - **Events channel** — influencer creates event cards with Zoom links
  - **Tier-locked channel** — only visible to members at or above a set tier
  - **Master channel** — only visible to Master members
- Channels are ordered and renameable
- Members only see channels their tier/role allows

### 4.2 Posting & Reactions

- Influencers and mods can post text (rich text, basic formatting)
- Influencers and mods can attach images to posts
- Influencers can embed video links (Google Drive) in posts
- Members can react to posts with emojis
- Members cannot reply or post
- Influencer can pin posts (pinned shown at top of channel)
- Influencer and mods can delete any post

### 4.3 Events

- Influencer creates event cards in the events channel
- Event card contains: title, description, date/time, Zoom link, tier requirement
- Zoom link only visible to members who meet the tier requirement
- Members below the required tier see the event card but not the link

### 4.4 Course System

- Each community has a course with 4 tiers
- Each tier has 8 required lessons (videos)
- Tier names: Basic → Beginner → Intermediate → Advanced → Master
- Lessons are unlocked in order within a tier
- A member must complete all 8 lessons in a tier to progress
- Completion is tracked by watch percentage (85% minimum)
- Two new videos are uploaded weekly by mods (via Google Drive link)
- Videos are embedded via Google Drive embed — viewers cannot see the source

### 4.5 Tier Progression

- Automatic: system checks completion after each lesson
- When all 8 lessons in a tier are complete → next tier unlocks instantly
- Member receives an in-app notification
- Tier status visible on member's dashboard and profile

### 4.6 Master Zone

- Unlocked after all 4 tiers are completed
- Contains:
  - Master-only channel
  - Review call application form
  - Investment opportunity notices (posted by influencer)
  - Special live sessions

### 4.7 Review Call Flow

1. Master member submits review application (form with questions)
2. Influencer/reviewer sees application in their review queue
3. Application accepted → Zoom call scheduled, link sent via email + in-app notification
4. Call completed → outcome recorded
5. If approved → team application unlocked

### 4.8 Mentorship

- Available to any active member (not tier-locked)
- Member pays $1,000
- After payment confirmed → mentorship section unlocks
- Contains: start/end dates, assigned mentor, schedule, resources
- Influencer assigns mentor from their mod/team list

### 4.9 Payments

- $10 one-time membership fee per community
- $1,000 mentorship fee
- Payments handled via Stripe
- Stripe webhook confirms payment → Supabase updates membership/mentorship record
- No manual payment handling

### 4.10 Video Embedding (Google Drive)

- Mods upload video to Google Drive, get shareable embed link
- Paste link into the lesson editor
- Frontend converts the Drive link to an embed URL and renders it in an iframe
- The original Google Drive URL is never exposed in the page source
- Members see a clean embedded video player with no Drive branding visible
- No download button shown

### 4.11 Admin Panel (Super Admin only)

- Accessible at `/admin`, protected route
- Features:
  - Add new influencer (creates account, assigns role, creates community)
  - View all communities: member count, active users, revenue
  - Suspend or ban any user
  - View payment logs
  - Platform-wide announcements
  - Manage platform settings

---

## 5. Notifications

- In-app notifications (bell icon)
- Email notifications via Resend for:
  - Welcome email on signup
  - Email verification
  - Payment confirmation
  - Tier unlock
  - Review call status update
  - Mentorship confirmation
  - Password reset

---

## 6. What Members Cannot Do

- Post messages or comments
- Send direct messages
- Create channels
- See other members' profiles or progress
- Download videos
- See the Google Drive source URL of any video
- Access tier-locked content before earning it

---

## 7. Out of Scope for MVP

- Native mobile app
- Push notifications
- Social login (Google/Apple)
- Member-to-member interaction
- Referral system
- Certificate generation
- AI assistant
- Downloadable resources (Phase 2)
- Multiple mentors per member

---

## 8. Success Metrics

- Members onboarded in first 30 days
- Tier completion rate per community
- Video watch completion rate
- Mentorship conversion rate
- Review call conversion rate
- Monthly active members
- Churn rate

---

## 9. Constraints

- Hosting: Hostinger VPS (no AWS, no managed cloud)
- Video: Google Drive embeds only (no paid video hosting)
- Budget: Keep infrastructure under $50–100/month
- Development: Vibe coding via Codex — no deep manual backend work
- Must work for multiple influencer communities from day one
