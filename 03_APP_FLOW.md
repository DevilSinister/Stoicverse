# App Flow
## Community Learning Platform

**Version:** 1.0  
**Last Updated:** July 2026

---

> **Scope update (July 11, 2026):** The only community is Stoicverse. Remove community discovery, influencer-specific pages, and community selection from implementation. Signup leads to checkout when no active global membership exists; an active membership leads to the Stoicverse dashboard.

## 1. Public / Unauthenticated Flow

```
User visits yoursite.com
        |
        ├── Sees public landing page
        │     ├── Hero: value proposition
        │     ├── Influencer profiles + communities listed
        │     ├── Course curriculum preview
        │     ├── Pricing ($10 membership)
        │     ├── Mentorship offer ($1,000)
        │     ├── Testimonials + FAQs
        │     └── CTA → Join Now
        |
        ├── Clicks influencer-specific page: /community/[slug]
        │     ├── Influencer profile
        │     ├── This community's curriculum
        │     ├── Upcoming events preview
        │     └── Join button → Signup
        |
        └── Clicks Join → /signup
```

---

## 2. Signup & Onboarding Flow

```
/signup
    |
    ├── Enter: name, email, password
    ├── Select community (influencer) to join
    ├── hCaptcha verification
    ├── Submit
    |
    ├── Account created in Supabase Auth
    ├── Verification email sent via Resend
    |
/verify-email
    |
    ├── User clicks link in email
    ├── Email verified
    └── Redirect → /checkout?community=[slug]

/checkout
    |
    ├── Summary: Community name, $10 membership fee
    ├── Stripe payment form (card)
    ├── Pay $10
    |
    ├── Stripe processes payment
    ├── Stripe fires webhook → POST /api/webhooks/stripe
    ├── Server verifies signature
    ├── membership record created (status: active)
    ├── Tier 1 unlocked
    ├── Welcome email sent via Resend
    |
    └── Redirect → /dashboard
```

---

## 3. Member Dashboard Flow

```
/dashboard
    |
    ├── Welcome message + current community
    ├── Progress card: current tier, lessons completed
    ├── Next lesson shortcut
    ├── Latest channel post preview
    ├── Upcoming event card
    ├── Notification bell (unread count)
    └── Sidebar navigation:
          ├── Dashboard (home)
          ├── Community (channels)
          ├── Courses
          ├── Events
          ├── Master Zone (locked until Tier 4 complete)
          └── Mentorship (locked until purchased)
```

---

## 4. Community (Channel) Flow

```
/community/[slug]
    |
    ├── Left sidebar: channel list
    │     ├── Shows only channels member's tier can access
    │     ├── Locked channels hidden entirely
    │     └── [+ New Channel] button → visible to influencer only
    |
    ├── Main area: selected channel feed
    │     ├── Posts shown newest to oldest (or pinned first)
    │     ├── Each post: avatar, name, role badge, content, image, reactions
    │     ├── React button → member can react with emoji
    │     |
    │     ├── [MEMBER VIEW] — no input box, read only
    │     |
    │     └── [INFLUENCER / MOD VIEW] — toolbar appears at bottom:
    │               ├── Text input box
    │               ├── 🖼 Image upload button
    │               ├── 📅 Create Event button (influencer only)
    │               ├── 📌 Pin toggle (on each post)
    │               └── 🗑 Delete button (on each post)
    |
    └── [INFLUENCER ONLY] — channel settings panel:
              ├── Rename channel
              ├── Set channel type (text / announcements / events)
              ├── Set minimum tier required
              ├── Set role visibility
              ├── Delete channel
              └── Manage moderators for this community
```

---

## 5. Course Flow

```
/courses
    |
    ├── Shows current tier progress bar
    ├── 4 tier cards stacked:
    │     ├── Tier 1 — Basic (unlocked on join)
    │     ├── Tier 2 — Beginner (locked until Tier 1 complete)
    │     ├── Tier 3 — Intermediate (locked)
    │     ├── Tier 4 — Advanced (locked)
    │     └── Master (locked until all 4 tiers complete)
    |
    └── Click tier → expand to lesson list

/courses/[tierId]
    |
    ├── List of 8 lessons
    ├── Each lesson shows:
    │     ├── ✅ Completed
    │     ├── ▶ In progress
    │     ├── 🔒 Locked (previous lesson not complete)
    │     └── Release date (if not yet released)
    └── Click lesson → /courses/lesson/[id]

/courses/lesson/[id]
    |
    ├── Lesson title + description
    ├── Video embed (Google Drive iframe)
    │     ├── API route checks: authenticated + correct tier + active membership
    │     ├── Returns embed URL (FILE_ID only, constructed server-side)
    │     └── Rendered as sandboxed iframe
    ├── Progress bar below video (timer-based, updates every 15 seconds)
    ├── Resources section (optional PDF links)
    ├── Previous / Next lesson navigation
    |
    ├── [ON 85% WATCH TIME REACHED]
    │     ├── POST /api/lessons/[id]/progress → marked complete
    │     ├── Edge Function checks if all 8 lessons in tier complete
    │     ├── If yes → tier upgraded, next tier unlocked
    │     ├── In-app notification created
    │     └── Email sent: "You've unlocked Tier X!"
    |
    └── [ON TIER 4 COMPLETE]
              ├── Master tier unlocked
              ├── Master Zone unlocked in sidebar
              └── Review application becomes available
```

---

## 6. Events Flow

```
/events
    |
    ├── Upcoming events list (cards)
    │     ├── Event title, description, date/time
    │     ├── Hosted by: [influencer name]
    │     ├── Required tier badge
    │     ├── Countdown timer to event
    │     |
    │     ├── [IF MEMBER MEETS TIER REQUIREMENT]
    │     │     └── Join Zoom button (link revealed)
    │     |
    │     └── [IF MEMBER DOES NOT MEET TIER]
    │               └── "Unlock in Tier X" badge, link hidden
    |
    └── Past events (recordings posted as lessons or Drive embeds)

[INFLUENCER VIEW — inline on same page]
    |
    ├── [+ Create Event] button
    ├── Form modal:
    │     ├── Event title
    │     ├── Description
    │     ├── Date and time
    │     ├── Zoom link
    │     ├── Minimum tier required
    │     └── Target channel (events channel)
    └── Submit → event posted
```

---

## 7. Master Zone Flow

```
/master (locked until Tier 4 complete)
    |
    ├── Master-only channel feed (read-only for members)
    ├── Special live sessions (Master tier required)
    ├── Investment opportunity notices (posted by influencer)
    |
    ├── Review Application section:
    │     ├── [IF NOT YET APPLIED]
    │     │     └── Application form:
    │     │               ├── Question fields (set by influencer)
    │     │               └── Submit → status: pending
    │     |
    │     ├── [IF PENDING]
    │     │     └── "Application under review" status card
    │     |
    │     ├── [IF ACCEPTED]
    │     │     ├── Call date + Zoom link shown
    │     │     └── Countdown to call
    │     |
    │     ├── [IF REJECTED]
    │     │     └── Rejection message + option to reapply
    │     |
    │     └── [IF APPROVED AFTER CALL]
    │               └── Team application form unlocked

    └── Team Application (unlocked after review call approved):
              ├── Application form
              └── Submit → reviewed by influencer
```

---

## 8. Mentorship Flow

```
[ANY ACTIVE MEMBER]
    |
    └── Mentorship CTA in sidebar (or dashboard)
              ├── "Upgrade to Mentorship" page
              ├── What's included, duration (2 months), price ($1,000)
              ├── Stripe payment
              |
              ├── Stripe webhook → mentorship record created
              ├── Start/end dates set
              ├── Confirmation email sent
              └── /mentorship unlocked

/mentorship
    |
    ├── Start date / end date
    ├── Assigned mentor name
    ├── Session schedule
    ├── Private resources (mentor uploads via Drive link)
    ├── Booking link (Calendly or manual)
    └── Mentorship-only announcements
```

---

## 9. Moderator Flow (Inline UI)

```
Mod logs in → sees same community UI as members
    |
    └── Extra controls visible:
              ├── Text input box in channels (can post)
              ├── 🗑 Delete button on every post
              ├── 📌 Pin button on every post
              ├── 👤 Member list button in sidebar
              │     ├── View all members
              │     ├── See tier, join date, last active
              │     ├── Warn member (sends notification)
              │     └── Kick member (suspends from community)
              └── Basic stats view (member count, active today)

[CANNOT DO]
    ├── Create or delete channels
    ├── Add other moderators
    ├── Access review applications
    └── See payment info
```

---

## 10. Influencer Flow (Inline UI)

```
Influencer logs in → same UI as members + mods + more controls
    |
    ├── All mod controls (post, delete, pin, manage members)
    |
    ├── Channel management (sidebar gear icon):
    │     ├── Create new channel (name, type, tier requirement)
    │     ├── Reorder channels (drag)
    │     ├── Rename channel
    │     └── Delete channel
    |
    ├── Moderator management (sidebar):
    │     ├── View mod list
    │     ├── Search members by email → assign as mod
    │     └── Remove mod
    |
    ├── Course management (/courses/manage):
    │     ├── View all tiers and lessons
    │     ├── Add new lesson:
    │     │     ├── Enter title, description
    │     │     ├── Paste Google Drive video link
    │     │     ├── Enter duration (minutes)
    │     │     ├── Set release date (optional)
    │     │     └── Save lesson
    │     ├── Reorder lessons
    │     └── Delete lesson
    |
    ├── Community stats (/stats):
    │     ├── Total members
    │     ├── Members per tier
    │     ├── Active members (last 7 days)
    │     ├── Lesson completion rates
    │     ├── Mentorship count
    │     └── Review applications pending
    |
    └── Review queue (/review-queue):
              ├── List of pending applications
              ├── View application answers
              ├── Accept → schedule call, add Zoom link
              └── Reject → send reason
```

---

## 11. Super Admin Flow

```
/admin (super admin only, separate protected area)
    |
    ├── Platform overview:
    │     ├── Total members across all communities
    │     ├── Total revenue (Stripe data)
    │     ├── Active members per community
    │     └── New signups today / this week
    |
    ├── Influencer management:
    │     ├── List of all influencers + community slugs
    │     ├── Add new influencer:
    │     │     ├── Create account (email + temp password)
    │     │     ├── Set platform_role = influencer
    │     │     ├── Create community record
    │     │     └── Set community slug
    │     ├── Suspend influencer (suspends their community)
    │     └── View influencer's community stats
    |
    ├── User management:
    │     ├── Search by email
    │     ├── View membership status
    │     ├── Suspend or ban user
    │     └── Reset password
    |
    ├── Payment logs:
    │     ├── All payments (Stripe data)
    │     ├── Filter by community, date, amount
    │     └── View refunds
    |
    └── Platform settings:
              ├── Platform name, logo
              └── Maintenance mode toggle
```

---

## 12. Notification Flow

```
Trigger event occurs (tier unlock, payment, etc.)
    |
    ├── Supabase Edge Function creates notification record
    ├── Realtime subscription pushes to client (bell icon updates)
    |
    └── If email notification:
              Edge Function calls Resend API
              └── Email sent to user

Notification types:
    ├── 🎉 Tier unlocked
    ├── ✅ Payment confirmed
    ├── 📹 New lesson available
    ├── 📅 New event created
    ├── 📋 Review application status updated
    ├── 💬 Mentorship assigned
    └── ⚠️  Account warning (from mod)
```

---

## 13. Page Map

```
Public
├── / (landing)
├── /community/[slug] (influencer page)
├── /signup
├── /login
├── /verify-email
├── /forgot-password
└── /reset-password

Member (auth required + active membership)
├── /dashboard
├── /community/[slug] (channel feed)
├── /courses
├── /courses/[tierId]
├── /courses/lesson/[id]
├── /events
├── /master (locked until Tier 4)
├── /mentorship (locked until purchased)
└── /notifications

Influencer (auth + influencer role)
├── /courses/manage
├── /community/[slug]/settings
├── /community/[slug]/moderators
├── /community/[slug]/stats
└── /review-queue

Super Admin (auth + super_admin role)
└── /admin
    ├── /admin/dashboard
    ├── /admin/influencers
    ├── /admin/users
    └── /admin/payments
```
