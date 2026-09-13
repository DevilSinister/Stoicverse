import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("membership access expires without changing tier or progress records", () => {
  const migration = read("supabase/migrations/20260717100000_membership_expiry_and_staff_event_override.sql");
  const webhook = read("src/app/api/stripe/webhook/route.ts");

  assert.match(migration, /membership\.expires_at > now\(\)/);
  assert.doesNotMatch(migration, /member_tiers.*update|lesson_progress.*update/i);
  assert.match(webhook, /expires_at: expiresAt\.toISOString\(\)/);
  assert.match(webhook, /renewalStart/);
});

test("staff can enroll in events without the member tier gate", () => {
  const migration = read("supabase/migrations/20260717100000_membership_expiry_and_staff_event_override.sql");
  const access = read("src/lib/supabase/access.ts");
  const events = read("src/components/events/EventsView.tsx");

  assert.match(migration, /public\.is_staff\(\)/);
  // `platformRole`, camelCase, since the guards read the request-cached
  // profile rather than a raw PostgREST row. The staff override is the same
  // rule; only the spelling of the field moved.
  assert.match(access, /platformRole === "moderator"/);
  assert.match(events, /isStaff \|\| isMaster \|\| currentTier >= event\.minTier/);
});
