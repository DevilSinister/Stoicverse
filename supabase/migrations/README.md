# Migrations — how this project actually deploys

**Do not run `supabase db push` against this project.** It will attempt to replay
every file here and abort on `42P07 relation already exists`.

## Why

The live ledger (`supabase_migrations.schema_migrations`) and the filenames in this
directory share **zero** version numbers. Verified 2026-09-10 against project
`Stoicverse`: 26 ledger rows, 31 files, no overlap. The schema was built by applying
SQL directly (dashboard / MCP `apply_migration`), which stamps its own timestamp.

These files are the **reviewable record** of each change. They have never been the
deployment mechanism, and the Supabase CLI is not installed on the maintainer's
machine.

## The workflow

1. Write the migration as a file here, using the existing `YYYYMMDDHHMMSS_name.sql`
   convention, so the change is reviewable in the diff.
2. Apply it with the Supabase MCP `apply_migration` tool (or the dashboard SQL
   editor). That writes the ledger row itself.
3. Run the security and performance advisors afterwards.

Every statement should be `if not exists` / `drop ... if exists` guarded, so a
re-apply is a no-op rather than an abort.

## Known ledger facts (2026-09-10)

- `revoke_public_execute_on_secdef_functions` is in the ledger with **no file here**.
- `20260714000000` is used by **two** files (`event_cancellation_timestamp` and
  `influencer_workspace`) — a collision that would break `db push` independently.
- `creator_overview_trends` was superseded by `flexible_overview_metrics`; its
  function definition never reached the database and does not need to.
- Everything else in this directory is present in the live schema.
