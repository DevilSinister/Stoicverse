# Production security checklist

Apply `supabase/migrations/20260712000000_security_access_boundaries.sql` to the production project before deploying the matching application build. It moves Zoom URLs and Drive IDs out of member-readable tables, so deploying the application first will break event-room and lesson playback.

Configure these server-only environment variables in the deployment host, never with a `NEXT_PUBLIC_` prefix:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MEMBERSHIP_PRICE_ID`, and `STRIPE_MENTORSHIP_PRICE_ID`
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (a stable base64-encoded 32-byte value)

Set the Stripe webhook endpoint to `https://<production-host>/api/stripe/webhook` and subscribe to `checkout.session.completed`. Do not activate memberships from a Stripe redirect; activation is webhook-only.

At Cloudflare, force HTTPS, enable HSTS, and proxy the origin. At Nginx, redirect port 80 to HTTPS, pass the original `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers to Next.js, and retain the application HSTS/CSP headers rather than overwriting them.

Use Supabase Auth's dashboard rate-limit settings for sign-up, sign-in, and password-reset traffic. The in-app limiter protects authenticated mutation endpoints on the current single-process VPS; replace it with Redis or a database-backed limiter before running multiple PM2 instances.

Run `npm audit --omit=dev`, `npm run lint`, `npm run test:security`, and `npm run build` in CI. Configure the RLS fixture variables listed in `tests/security/README.md` against a non-production Supabase project.
