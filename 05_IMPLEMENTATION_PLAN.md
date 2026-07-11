# Implementation Plan
## Community Learning Platform

**Version:** 1.0  
**Last Updated:** July 2026  
**Method:** Vibe coding via Codex — no manual backend work

---

> **Scope update (July 11, 2026):** This plan originally described a multi-community product. The active implementation is a single Stoicverse community. Do not create `communities`, `community_roles`, per-community data, community onboarding, or community owner workflows. Use global memberships and platform roles instead.

## Overview

Build in 6 phases. Each phase produces something usable before moving to the next. Do not skip ahead — each phase depends on the last.

**Estimated total timeline:** 6–10 weeks depending on pace

---

## Before You Start: One-Time Setup

### 1. Create Accounts (free or cheap tiers)
- [ ] Supabase — supabase.com (free tier is fine to start)
- [ ] Stripe — stripe.com (test mode, no cost)
- [ ] Resend — resend.com (free tier: 100 emails/day)
- [ ] Sentry — sentry.io (free tier)
- [ ] UptimeRobot — uptimerobot.com (free)
- [ ] GitHub — github.com (free)
- [ ] Hostinger VPS — already have this

### 2. VPS Initial Setup (do this once via SSH)
```bash
# Connect to VPS
ssh root@your-vps-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install Nginx
apt-get install -y nginx

# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Create app directory
mkdir -p /var/www/platform
```

### 3. Create Supabase Project
- Create new project at supabase.com
- Note down: Project URL, anon key, service role key
- Go to SQL editor — you will paste schema here in Phase 1

### 4. Point Domain to VPS
- In your domain registrar (or Cloudflare), point DNS A record to your VPS IP
- Recommended: use Cloudflare as DNS (free WAF + DDoS protection on top)

---

## Phase 1 — Foundation & Auth
**Goal:** Working signup, login, email verification, and protected dashboard shell  
**Time:** 3–5 days

### Step 1.1 — Run Database Schema
Go to Supabase SQL editor, paste and run the full schema from `04_DATABASE_SCHEMA.md`.

Run in this order:
1. `profiles` table + trigger
2. `communities` table
3. `community_roles` table
4. `memberships` table
5. `payments` table
6. `channels` table
7. `posts` table
8. `reactions` table
9. `events` table
10. `tiers` table
11. `lessons` table
12. `lesson_progress` table
13. `member_tiers` table
14. `review_applications` table
15. `team_applications` table
16. `mentorships` table
17. `notifications` table
18. `stripe_webhook_events` table
19. All functions and triggers

### Step 1.2 — Scaffold Next.js App

**Codex prompt:**
```
Create a new Next.js 14 app with TypeScript, Tailwind CSS, and shadcn/ui.
Set up Supabase client using @supabase/ssr package.
Create the following pages:
- / (public landing, just a placeholder for now)
- /signup (email + password + full name fields, hCaptcha placeholder)
- /login (email + password)
- /verify-email (message saying check your email)
- /forgot-password
- /reset-password
- /dashboard (protected, redirect to /login if not authenticated)

Use Supabase Auth for all authentication.
On signup: create auth user, then INSERT into profiles table.
On login: use supabase.auth.signInWithPassword().
Use HTTP-only cookies via @supabase/ssr createServerClient.
Protected routes: use middleware.ts to check session.

Environment variables needed:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Step 1.3 — Deploy to VPS

```bash
# On VPS
cd /var/www/platform
git clone [your-github-repo] .
npm install
cp .env.example .env.local
# Fill in env vars
npm run build
pm2 start npm --name "platform" -- start
pm2 save
pm2 startup

# Configure Nginx
nano /etc/nginx/sites-available/platform
```

Nginx config:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/platform /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Phase 1 Done When:
- [ ] User can sign up with email + password
- [ ] Verification email arrives via Resend
- [ ] User can log in after verifying
- [ ] /dashboard is protected (redirects if not logged in)
- [ ] Site is live on your domain with HTTPS

---

## Phase 2 — Payments & Membership
**Goal:** Member pays $10, membership activates, tier 1 unlocks  
**Time:** 3–4 days

### Step 2.1 — Stripe Setup
- Create products in Stripe dashboard:
  - "Community Membership" — $10 one-time
  - "Mentorship" — $1,000 one-time
- Note down Price IDs for each

### Step 2.2 — Checkout Flow

**Codex prompt:**
```
Add Stripe payment integration to the Next.js app.

After email verification, redirect user to /checkout?community=[slug].

On /checkout page:
- Show community name and $10 price
- Use Stripe Payment Element (embedded form)
- Create PaymentIntent server-side via API route POST /api/payments/create-intent
- On success, redirect to /dashboard

Create webhook handler at POST /api/webhooks/stripe:
- Verify stripe-signature header using STRIPE_WEBHOOK_SECRET
- Check stripe_webhook_events table for duplicate event ID before processing
- On payment_intent.succeeded:
  - Find user by metadata.user_id
  - UPDATE memberships SET status='active', joined_at=NOW()
  - The database trigger will auto-create member_tiers and community_roles records
  - Create notification: 'payment_confirmed'
  - Send welcome email via Resend

Environment variables to add:
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
```

### Step 2.3 — Seed Community Data
In Supabase SQL editor, create your first influencer and community:
```sql
-- Create influencer profile (after they sign up)
UPDATE profiles SET platform_role = 'influencer' WHERE id = '[influencer-user-id]';

-- Create community
INSERT INTO communities (influencer_id, name, slug, membership_fee)
VALUES ('[influencer-user-id]', 'Community Name', 'community-slug', 10.00);

-- Create tiers for community
INSERT INTO tiers (community_id, level, title, required_lesson_count, sort_order)
VALUES
  ('[community-id]', 1, 'Basic', 8, 1),
  ('[community-id]', 2, 'Beginner', 8, 2),
  ('[community-id]', 3, 'Intermediate', 8, 3),
  ('[community-id]', 4, 'Advanced', 8, 4);

-- Create community role for influencer
INSERT INTO community_roles (user_id, community_id, role)
VALUES ('[influencer-user-id]', '[community-id]', 'influencer');
```

### Phase 2 Done When:
- [ ] User can pay $10 via Stripe
- [ ] Membership activates automatically after payment
- [ ] Tier 1 unlocks automatically
- [ ] Welcome email sent
- [ ] Dashboard shows active membership status

---

## Phase 3 — Community & Channels
**Goal:** Discord-style channel UI with role-based controls  
**Time:** 5–7 days

### Step 3.1 — Channel UI

**Codex prompt:**
```
Build the community page at /community/[slug].

Layout:
- Left sidebar: list of channels from the `channels` table
  - Only show channels where the user's current_tier >= channel.min_tier
  - Group by type (announcements at top, then text channels, then locked ones hidden)
  - [+ New Channel] button visible only to influencer role
- Main area: post feed for selected channel
  - Fetch posts from `posts` table for this channel
  - Each post shows: avatar, full_name, role badge (Mod/Influencer), body text, image, reaction bar
  - Pinned posts appear first
  - Soft-deleted posts (is_deleted=true) are not shown

Role-based UI logic:
- Check user's role from community_roles table for this community
- If role = 'influencer' or 'moderator':
  - Show text input box at bottom of feed
  - Show image upload button
  - Show delete button on each post
  - Show pin button on each post (influencer only)
- If role = 'member':
  - No input box
  - Only show reaction bar on posts

Post reactions:
- Row of emoji buttons below each post
- Click emoji → INSERT into reactions table (or DELETE if already reacted)
- Show count next to each emoji

Use Supabase Realtime to subscribe to new posts in the current channel so feed updates live without page refresh.
```

### Step 3.2 — Channel Management (Influencer)

**Codex prompt:**
```
Add channel management for influencer role only.

[+ New Channel] button opens a modal with:
- Channel name (text input)
- Channel type (select: text, announcements, events, master)
- Minimum tier (select: 0=all, 1, 2, 3, 4, 5=master only)
- Submit → POST /api/channels (inserts into channels table, influencer only)

On each channel in sidebar, influencer sees a gear icon:
- Opens settings modal:
  - Rename channel
  - Change type
  - Change min_tier
  - Delete channel (with confirmation)
  - Drag to reorder (update sort_order)

Moderator management button in sidebar (influencer only):
- Lists current mods (from community_roles where role='moderator')
- Search box: search members by email
- Click member → set role to 'moderator' in community_roles
- Click mod → option to remove (set back to 'member')
```

### Phase 3 Done When:
- [ ] Members see correct channels based on tier
- [ ] Influencer can create/rename/delete channels
- [ ] Influencer and mods can post text + images
- [ ] Members can only react, not post
- [ ] Real-time updates work (new posts appear without refresh)
- [ ] Influencer can add/remove mods

---

## Phase 4 — Courses & Video
**Goal:** Course structure, Google Drive video embed, watch tracking, tier progression  
**Time:** 5–7 days

### Step 4.1 — Course UI

**Codex prompt:**
```
Build the courses section at /courses.

Main page /courses:
- Show 4 tier cards
- Each card shows: tier title, X/8 lessons complete, progress bar
- Locked tiers (user's current_tier < tier.level) show a lock icon
- Click unlocked tier → expand to lesson list

Lesson list:
- Shows all 8 lessons in the tier
- Each lesson: title, duration, status (completed ✅ / available ▶ / locked 🔒 / upcoming with release date)
- Click available lesson → /courses/lesson/[id]

Lesson page /courses/lesson/[id]:
- Check user's tier access server-side before rendering
- If access denied → redirect to /courses
- Fetch lesson from DB
- Call GET /api/lessons/[id]/embed to get the embed URL (server constructs Drive embed URL from FILE_ID)
- Render iframe with the embed URL
  - sandbox="allow-scripts allow-same-origin allow-presentation"
  - No download controls
  - Full width, 16:9 aspect ratio
- Show lesson title, description below video
- Progress bar below video (driven by timer, not iframe events)
- Previous / Next lesson navigation
```

### Step 4.2 — Watch Progress & Tier Progression

**Codex prompt:**
```
Implement watch progress tracking using a timer-based approach (Google Drive iframes don't emit playback events).

On lesson page:
- When iframe loads, start a JavaScript interval (every 15 seconds)
- Every 15 seconds: POST /api/lessons/[id]/progress with { watched_seconds: X }
- Accumulate seconds watched in React state
- Show completion percentage: (watched_seconds / lesson.duration_seconds) * 100
- When percentage reaches lesson.completion_threshold (default 85%):
  - POST /api/lessons/[id]/complete
  - Show "Lesson Complete!" toast
  - Stop the timer

API route POST /api/lessons/[id]/complete:
- Verify user auth + active membership + correct tier
- UPDATE lesson_progress SET is_completed=true, completed_at=NOW()
- Call Supabase Edge Function 'check-tier-progression' with user_id + community_id

Supabase Edge Function 'check-tier-progression':
- Count completed lessons in user's current tier
- If count >= tier.required_lesson_count:
  - UPDATE member_tiers SET current_tier = current_tier + 1
  - If current_tier was 4 → SET is_master=true, master_unlocked_at=NOW()
  - INSERT into notifications (tier_unlocked or master_unlocked)
  - Send email via Resend: "You've unlocked [next tier]!"
- Return updated tier info
```

### Step 4.3 — Lesson Management (Influencer)

**Codex prompt:**
```
Add lesson management at /courses/manage (influencer only).

Page shows all tiers and lessons in a table/list format.

Add Lesson button for each tier:
- Modal form:
  - Lesson title
  - Description
  - Google Drive video link (full URL pasted by mod)
    - Frontend extracts FILE_ID from URL using regex: /\/d\/([a-zA-Z0-9_-]+)/
    - Stores only FILE_ID in database, not the full URL
  - Duration (minutes and seconds input)
  - Release date (optional date picker)
  - Submit → POST /api/lessons (influencer only)

Edit lesson:
- Same form, prepopulated
- Can change title, description, release date
- Cannot change video without re-pasting link

Delete lesson:
- Confirmation modal
- Hard delete (lesson progress for that lesson also deleted)
```

### Phase 4 Done When:
- [ ] Course tiers and lessons visible and locked correctly
- [ ] Video plays in iframe with no visible Drive branding
- [ ] Watch timer tracks progress
- [ ] Lesson marks complete at 85% threshold
- [ ] Tier auto-upgrades after 8 lessons complete
- [ ] Master zone unlocks after Tier 4
- [ ] Influencer/mods can add lessons by pasting Drive link

---

## Phase 5 — Events, Master Zone & Applications
**Goal:** Events with Zoom links, Master Zone, review flow, mentorship  
**Time:** 4–5 days

### Step 5.1 — Events

**Codex prompt:**
```
Build events page at /events.

Show event cards from the events table for this community.
Each card: title, description, date/time, countdown timer, hosted by, tier required badge.

Zoom link logic:
- If user's current_tier >= event.min_tier → show Join Zoom button with zoom_url
- If user's tier is too low → show "Unlock in Tier X" badge, no link shown

Influencer inline controls (same page):
- [+ Create Event] button
- Modal: title, description, date/time picker, Zoom URL, minimum tier
- Submit → INSERT into events table + INSERT into posts table as event type in the events channel

Edit / Cancel event: gear icon on event card (influencer only)
```

### Step 5.2 — Master Zone

**Codex prompt:**
```
Build Master Zone at /master.

Server-side check: if member_tiers.is_master = false → show locked state with progress towards Master, not the full page.

If is_master = true, show:
1. Master channel feed (read-only for members, same channel UI)
2. Review Application section:
   - If no application: show form with influencer-defined questions (store questions in community settings JSON)
   - If pending: show status card "Application under review"
   - If accepted: show Zoom link + call date
   - If rejected: show rejection reason + reapply option
   - If approved_for_team: show Team Application form

Review application form submits to POST /api/review/apply
Team application submits to POST /api/review/team-apply

Influencer review queue at /review-queue:
- Table of all review applications with status filters
- Click application → view answers
- Buttons: Accept (+ add Zoom link + date), Reject (+ add reason)
- On accept: UPDATE review_applications, send email via Resend with Zoom link
```

### Step 5.3 — Mentorship

**Codex prompt:**
```
Build mentorship purchase and section.

Mentorship CTA:
- Banner on dashboard for members without active mentorship
- /mentorship/upgrade page: what's included, $1,000 price, Stripe payment

After Stripe webhook confirms mentorship payment:
- INSERT into mentorships (status: active, starts_at: NOW(), ends_at: NOW()+60days)
- INSERT into payments
- Send confirmation email via Resend
- Create notification

/mentorship page (locked until purchased):
- Show: start date, end date, assigned mentor name
- Booking link (URL stored in mentorship record)
- Resources section (Drive links posted by mentor/influencer)
- Mentorship-only announcements (filter posts by type='mentorship')

Influencer can assign mentor:
- From /community/[slug]/mentorships
- List of active mentorships
- Click → select mentor from mod/team list
- UPDATE mentorships SET assigned_mentor_id, booking_url
```

### Phase 5 Done When:
- [ ] Events visible with tier-gated Zoom links
- [ ] Master Zone locked until Tier 4 complete
- [ ] Review application flow works end to end
- [ ] Influencer can accept/reject with Zoom link
- [ ] Mentorship payment and activation works
- [ ] Mentorship section unlocks after payment

---

## Phase 6 — Admin Panel & Polish
**Goal:** Super admin panel, notifications, final UI polish, launch prep  
**Time:** 3–4 days

### Step 6.1 — Super Admin Panel

**Codex prompt:**
```
Build super admin panel at /admin (protected: platform_role must be 'super_admin').

Pages:
/admin — dashboard
  - Total members (COUNT from memberships WHERE status='active')
  - Total revenue (SUM from payments WHERE status='succeeded')
  - Members per community (grouped bar chart or table)
  - New signups today / this week

/admin/influencers
  - Table of all influencers + community name, slug, member count, revenue
  - [+ Add Influencer] button:
    - Enter email, name
    - System creates auth user (Supabase admin API), sets platform_role='influencer'
    - Creates community record with slug
    - Creates 4 default tiers
    - Sends invite email via Resend with temp password
  - Suspend influencer button: UPDATE communities SET is_active=false, UPDATE profiles SET is_suspended=true

/admin/users
  - Search by email
  - View user details: name, communities, tier, payment history
  - Suspend user: UPDATE profiles SET is_suspended=true
  - Reset password (trigger Supabase password reset email)

/admin/payments
  - Table of all payments from payments table
  - Filter by: community, date range, product type, status
  - Show refunds
```

### Step 6.2 — Notifications

**Codex prompt:**
```
Build notification system.

Bell icon in navbar with unread count badge (red dot).

GET /api/notifications → returns user's notifications ordered by created_at DESC, limit 20.

Dropdown panel on bell click:
- List of notifications: icon, title, body, time ago
- Click notification → navigate to action_url, mark as read
- "Mark all as read" button
- UPDATE notifications SET is_read=true, read_at=NOW()

Use Supabase Realtime to subscribe to new notifications for current user:
- supabase.channel('notifications').on('postgres_changes', ...).subscribe()
- When new notification inserted for current user → increment badge count, add to top of list

In all Supabase Edge Functions that create notifications, also call Resend if the notification type requires email.
```

### Step 6.3 — Landing Page

**Codex prompt:**
```
Build the public landing page at /.

Dark theme, professional, minimal design.

Sections:
1. Hero: platform name, tagline, "Join [Influencer Name]'s Community" CTA button
2. Features: 3-4 benefit cards (exclusive content, live sessions, tier progression, mentorship)
3. How it works: 3 steps (Sign up → Complete tiers → Join the team)
4. Pricing: $10/month membership card, $1,000 mentorship card
5. FAQ: 5-6 common questions as accordion
6. Footer: links, social

If multiple influencers: show a grid of community cards at top, each with its own Join button linking to /checkout?community=[slug].

Each community card shows: influencer name, avatar, community name, member count, price.
```

### Step 6.4 — Launch Checklist

Before going live:

**Security**
- [ ] All API routes check auth before anything else
- [ ] Supabase RLS enabled and tested on every table
- [ ] STRIPE_WEBHOOK_SECRET is set and signature verified
- [ ] SUPABASE_SERVICE_ROLE_KEY is never in client-side code
- [ ] Google Drive FILE_IDs never returned directly to client
- [ ] hCaptcha added to signup form
- [ ] Nginx rate limiting configured

**Testing**
- [ ] Complete signup → payment → membership activation flow
- [ ] Lesson completion → tier upgrade flow
- [ ] Tier 4 completion → Master Zone unlock
- [ ] Review application → acceptance → call scheduled
- [ ] Mentorship payment → section unlocks
- [ ] Influencer can add lesson, post, create event
- [ ] Mod can post and delete but not create channels
- [ ] Member cannot post, cannot see Drive source URL
- [ ] Admin can add influencer

**Stripe**
- [ ] Switch from test keys to live keys
- [ ] Webhook endpoint registered in Stripe dashboard
- [ ] Test payment with real card in production

**Monitoring**
- [ ] Sentry DSN added to environment variables
- [ ] UptimeRobot monitoring your domain
- [ ] PM2 set to auto-restart on crash
- [ ] PM2 set to start on VPS reboot (`pm2 startup`)

**Backup**
- [ ] Supabase automated backups enabled (Pro plan)
- [ ] VPS snapshot scheduled in Hostinger dashboard

---

## Deployment Update Process

Every time you push a code change:

```bash
# SSH into VPS
ssh root@your-vps-ip

# Pull latest code
cd /var/www/platform
git pull origin main

# Install any new packages
npm install

# Build
npm run build

# Restart (zero-downtime on PM2)
pm2 restart platform
```

Or automate this with a GitHub Action that runs on push to main branch.

---

## Cost Breakdown at Launch

| Service | Plan | Monthly Cost |
|---|---|---|
| Hostinger VPS | 4GB RAM | ~$10–20 |
| Supabase | Pro | $25 |
| Stripe | Pay-per-use | 2.9% + $0.30 per txn |
| Resend | Pro | $20 |
| Google Drive | Business Starter | $6 |
| Sentry | Free | $0 |
| UptimeRobot | Free | $0 |
| Cloudflare DNS + WAF | Free | $0 |
| **Total fixed** | | **~$55–65/month** |

Stripe fees on 100 memberships: ~$32. Not a fixed cost.

---

## If Google Drive Becomes a Problem

If Google Drive starts blocking embeds due to traffic (this happens at scale), migrate to:

1. **Bunny Stream** — ~$1 per 1,000 minutes streamed. Paste Bunny URL instead of Drive URL. Minimal code change needed since you're already storing FILE_IDs.
2. **Mux** — more features, slightly higher cost. Same swap.
3. **Cloudflare Stream** — $5/1,000 minutes stored + $1/1,000 minutes delivered.

The database schema is already designed for this swap — `video_file_id` column works for any provider ID.
