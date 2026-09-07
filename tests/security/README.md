# Security integration fixtures

Run `npm run test:security` against an isolated Supabase project after applying all migrations. Create the accounts represented by the `RLS_*_JWT` variables and seed a high-tier event/lesson, a notification owned by a different member, and `RLS_OTHER_MEMBER_ID` as a mutation target.

Never point these tests at production: they issue real mutation attempts to verify that RLS and grants reject them.
