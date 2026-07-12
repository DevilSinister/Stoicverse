# Security integration fixtures

Run `npm run test:security` against an isolated Supabase project after applying all migrations. Create the eight accounts represented by the `RLS_*_JWT` variables and seed a high-tier event/lesson plus a notification owned by a different member.

Never point these tests at production: they issue real mutation attempts to verify that RLS and grants reject them.
