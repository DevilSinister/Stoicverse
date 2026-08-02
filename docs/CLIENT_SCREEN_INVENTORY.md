# Client screen inventory

This is the implementation queue for the client-facing experience. Creator and administrator workspaces are intentionally excluded and will be handled separately.

| Priority | Client web route | Current product screen | Stitch reference | Status |
| --- | --- | --- | --- | --- |
| 1 | `/dashboard` | Member dashboard | Dashboard desktop, dashboard mobile, dashboard desktop with Discord sidebar | In progress |
| 2 | `/dashboard/courses` and `/courses` | Course catalogue | Learning path desktop, mobile, and desktop with Discord sidebar | Pending |
| 3 | `/dashboard/courses/[id]` and `/courses/[id]` | Course detail | Learning path desktop, mobile, and desktop with Discord sidebar | Pending |
| 4 | `/dashboard/courses/[id]/video/[videoId]`, `/courses/[id]/video/[videoId]`, and `/courses/lesson/[id]` | Lesson and video player | Lesson page desktop, mobile, desktop with Discord sidebar, and video lesson player | Pending |
| 5 | `/dashboard/events` and `/events` | Events directory | Events directory and live sessions desktop/mobile variants | Pending |
| 6 | `/dashboard/community` and `/community` | Community feed | Community feed | Pending |
| 7 | `/mentorship` | Mentorship | Mentors and team desktop/mobile variants, including Discord sidebar | Pending |
| 8 | `/master` | Master Zone community | Master Zone dashboard | Pending |
| 9 | `/dashboard/messages` | Member messages | No dedicated Stitch screen | Pending |
| 10 | `/dashboard/notifications` | Member notifications | No dedicated Stitch screen | Pending |
| 11 | `/dashboard/settings` | Account settings | No dedicated Stitch screen | Pending |
| 12 | `/subscription` | Subscription plans | Subscription annual vs. monthly | Pending |
| 13 | `/subscription/commitment` | Subscription commitment | Subscription commitment | Pending |
| 14 | `/checkout` | Checkout | Checkout desktop, mobile, and general variants | Pending |
| 15 | `/login` and `/log-in` | Sign in | Log in, login page, and mobile login variants | Pending |
| 16 | `/signup` and `/sign-up` | Sign up | Sign up, registration desktop/mobile variants | Pending |
| 17 | `/signup/community` | Community selection during sign up | Sign up community selection | Pending |
| 18 | `/` | Public landing page | Landing page desktop and mobile, plus trading education platform | Pending |
| 19 | `/privacy` and `/terms` | Legal pages | No dedicated Stitch screen | Pending |

## Notes

- The source of truth for the visual direction is `stitch_screens/design_md.md`: terminal-dark surfaces, Inter headings, JetBrains Mono metadata, restrained emerald accents, and dense desktop grids that collapse to a single-column mobile layout.
- `ask_stoic___super_admin_dashboard.html` and `ask_stoic___influencer_cm_dashboard.html` are staff references, not client screens.
- Several routes have both legacy/public and dashboard-prefixed URLs. They should share a redesign where they render the same client feature.
