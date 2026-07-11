# Technical Requirements Document (TRD)
## Community Learning Platform

**Version:** 1.0  
**Last Updated:** July 2026

---

## 1. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | File-based routing, server components, |
| Styling | Tailwind CSS + shadcn/ui | Fast UI, consistent components |
| Backend/API | Next.js API Routes + Supabase Edge Functions | No separate server needed |
| Database | Supabase (PostgreSQL) | Managed Postgres, auth, RLS, realtime — all in one |
| Auth | Supabase Auth | Email/password, session management, role metadata |
| File Storage | Supabase Storage | Profile images, post images (not video) |
| Video | Google Drive embed | Mods paste Drive link, frontend proxies as embed |
| Payments | Stripe | One-time payments + webhooks |
| Email | Resend | Transactional email |
| Hosting | Hostinger VPS | Self-hosted, low cost |
| Process Manager | PM2 | Keeps Next.js running on VPS |
| Reverse Proxy | Nginx | Routes traffic, handles HTTPS |
| SSL | Let's Encrypt (Certbot) | Free SSL |
| Realtime (optional) | Supabase Realtime | Live post updates in channels |

---

## 2. Hosting Architecture (Hostinger VPS)

```
Internet
    |
Cloudflare (DNS + free WAF/DDoS protection)
    |
Hostinger VPS
    ├── Nginx (port 80/443)
    │     ├── yoursite.com → Next.js app (port 3000)
    │     └── /api/* → Next.js API routes
    ├── PM2 → Next.js process
    └── Environment variables (.env.local)

External Services:
├── Supabase (cloud) — DB, Auth, Storage, Edge Functions
├── Stripe — Payments
├── Resend — Email
└── Google Drive — Video files
```

### VPS Minimum Specs for Launch
- RAM: 4GB minimum (8GB recommended)
- CPU: 2 vCPU
- Storage: 50GB SSD
- OS: Ubuntu 22.04 LTS

### VPS Setup Steps (one-time)
1. Install Node.js 20 LTS via nvm
2. Install PM2 globally
3. Install Nginx
4. Configure Nginx reverse proxy
5. Install Certbot, issue SSL certificate
6. Clone repo, install dependencies, build Next.js
7. Start with PM2, set PM2 to auto-start on reboot
8. Set environment variables

---

## 3. Supabase Configuration

### 3.1 Auth Settings
- Provider: Email + Password only (MVP)
- Email confirmation: Required
- Session duration: 7 days (refresh token auto-renews)
- Password minimum: 8 characters
- Rate limiting: Supabase handles by default

### 3.2 Row Level Security (RLS)
Every table has RLS enabled. Policies enforce:
- Users can only read their own membership records
- Members can only read channels their tier allows
- Only influencers/mods can INSERT into posts table for their community
- Only influencer can INSERT into channels table
- Super admin bypasses all RLS via service role key (used only in server-side API routes)

### 3.3 Storage Buckets
- `avatars` — public bucket, profile images
- `post-images` — public bucket, images in channel posts
- `community-covers` — public bucket, community banner/logo

No video stored in Supabase Storage.

### 3.4 Edge Functions
Used for server-side logic that needs to run securely:
- `on-lesson-complete` — triggered after watch threshold hit, recalculates tier
- `on-payment-confirmed` — Stripe webhook handler, activates membership/mentorship
- `send-notification` — creates in-app notification + triggers Resend email

---

## 4. Google Drive Video Integration

### 4.1 How It Works
1. Mod uploads MP4 to Google Drive
2. Sets sharing to "Anyone with the link can view"
3. Copies the share URL: `https://drive.google.com/file/d/FILE_ID/view`
4. Pastes into lesson editor in the admin/influencer UI
5. System extracts the `FILE_ID` and stores only that in the database
6. On the lesson page, the frontend constructs the embed URL:
   `https://drive.google.com/file/d/FILE_ID/preview`
7. Rendered inside an iframe with `allowfullscreen`

### 4.2 Hiding the Source
- The raw Google Drive URL is never stored or sent to the client
- Only the `FILE_ID` is stored in the database
- The embed URL is constructed server-side in a Next.js API route
- The API route checks the user's auth + tier before returning the embed URL
- The iframe `src` is set by React state after the API confirms access
- Browser devtools will show the iframe embed URL but not the original Drive file link
- Iframe has `sandbox` attributes to prevent right-click download

### 4.3 Iframe Attributes
```html
<iframe
  src="https://drive.google.com/file/d/{FILE_ID}/preview"
  allow="autoplay"
  allowFullScreen
  sandbox="allow-scripts allow-same-origin allow-presentation"
  style="width:100%; height:100%; border:none; pointer-events:auto;"
/>
```

### 4.4 Limitations
- Google Drive has per-day bandwidth limits on embedded files for heavy traffic
- If a video gets flagged by Google for "unusual traffic" it shows a warning screen
- Mitigation: keep videos unlisted (not public), use the `/preview` embed not `/view`
- For MVP this is acceptable — upgrade to Mux or Bunny Stream if traffic becomes an issue

### 4.5 Watch Progress Tracking
Since Google Drive embeds don't expose playback events:
- Use a timer-based approach: start a timer when the iframe loads
- Every 15 seconds, record "X seconds watched" to Supabase
- Lesson marked complete when timer reaches 85% of the lesson's `duration_seconds`
- `duration_seconds` is entered manually by the mod when pasting the link
- This is an approximation — not frame-perfect, but sufficient for tier gating

---

## 5. Role & Permission System

### 5.1 Role Storage
Roles are stored in two places:
- `auth.users` metadata (Supabase): `platform_role` → `super_admin | influencer | member`
- `community_roles` table: `user_id + community_id + role` → `influencer | moderator | member`

### 5.2 Role Checking Flow
```
User makes request
    |
Next.js API route
    |
Extract JWT from cookie
    |
Supabase verifyUser()
    |
Check auth.users metadata for platform_role
    |
Check community_roles for community-specific role
    |
Apply business logic
```

### 5.3 Frontend Role-Based UI
```typescript
// Same component, different controls
const isInfluencer = communityRole === 'influencer'
const isMod = communityRole === 'moderator' || isInfluencer
const canPost = isMod
const canManageChannels = isInfluencer
const canDeletePosts = isMod
```

No separate routes for influencer vs member — same URL, conditionally rendered controls.

---

## 6. API Routes Structure

```
/api
├── /auth
│   ├── POST /signup
│   ├── POST /login
│   └── POST /logout
├── /community
│   ├── GET  /[slug]              — community info + channels
│   ├── GET  /[slug]/channels     — list channels user can see
│   └── GET  /[slug]/stats        — influencer/admin only
├── /channels
│   ├── POST /                    — create channel (influencer only)
│   ├── PATCH /[id]               — rename/reorder (influencer only)
│   └── DELETE /[id]              — delete channel (influencer only)
├── /posts
│   ├── GET  /[channelId]         — paginated posts
│   ├── POST /                    — create post (mod/influencer only)
│   ├── DELETE /[id]              — delete post (mod/influencer only)
│   └── PATCH /[id]/pin           — pin post (influencer only)
├── /events
│   ├── GET  /[channelId]         — list events
│   └── POST /                    — create event (influencer only)
├── /courses
│   ├── GET  /[communityId]       — full course structure
│   └── GET  /[communityId]/progress — member's progress
├── /lessons
│   ├── GET  /[id]                — lesson detail + embed URL (auth + tier check)
│   └── POST /[id]/progress       — update watch progress
├── /memberships
│   ├── POST /join                — initiate Stripe payment
│   └── GET  /status              — check membership status
├── /mentorship
│   └── POST /purchase            — initiate mentorship payment
├── /review
│   ├── POST /apply               — submit review application
│   └── GET  /status              — check application status
├── /webhooks
│   └── POST /stripe              — Stripe payment webhook
├── /notifications
│   └── GET  /                    — user's notifications
└── /admin
    ├── GET  /stats               — platform-wide stats (super admin)
    ├── POST /influencers         — add new influencer
    └── POST /suspend             — suspend user
```

---

## 7. Security Requirements

### 7.1 Authentication
- HTTP-only cookies for session tokens (Supabase handles this)
- HTTPS enforced via Nginx + Let's Encrypt
- CAPTCHA on signup (hCaptcha free tier)
- Email verification required before access
- Password reset links expire in 1 hour

### 7.2 Authorization
Every API route must validate:
1. User is authenticated
2. User's membership is active (not suspended/expired)
3. User belongs to the requested community
4. User's tier meets the content requirement
5. User's community role permits the action

### 7.3 Video Access
- Embed URL only returned after server-side auth check
- `FILE_ID` never sent directly to client in API response
- Iframe sandboxed to prevent navigation outside embed
- No direct link to Drive file exposed anywhere in HTML source

### 7.4 Stripe Webhook
- Verify `stripe-signature` header on every webhook
- Idempotency: check `stripe_event_id` before processing
- Only update membership after `payment_intent.succeeded` event
- Never trust the client for payment confirmation

### 7.5 Rate Limiting
- Implement via Nginx: limit requests per IP
- Login endpoint: 5 attempts per minute per IP
- API routes: 100 requests per minute per user

---

## 8. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never exposed to client

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://yoursite.com
SUPER_ADMIN_EMAIL=               # used to seed initial super admin role
```

---

## 9. Deployment Process

### Initial Deploy
```bash
git clone [repo] /var/www/platform
cd /var/www/platform
npm install
npm run build
pm2 start npm --name "platform" -- start
pm2 save
pm2 startup
```

### Update Deploy
```bash
cd /var/www/platform
git pull origin main
npm install
npm run build
pm2 restart platform
```

Or set up a simple GitHub Action that SSHs into the VPS and runs the above.

---

## 10. Performance Targets

| Metric | Target |
|---|---|
| Page load (dashboard) | < 2 seconds |
| API response time | < 500ms |
| Concurrent users supported | 500–2,000 on 4GB VPS |
| Video load time | Depends on Google Drive (not in our control) |
| Database query time | < 100ms with proper indexes |

---

## 11. Monitoring (Free/Cheap)

- **Uptime:** UptimeRobot (free) — alerts if site goes down
- **Errors:** Sentry free tier — captures frontend/backend errors
- **Server:** Hostinger VPS dashboard or `htop` via SSH
- **DB:** Supabase dashboard — query performance, table sizes
- **Logs:** PM2 logs (`pm2 logs platform`) on VPS
