import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_TEST_URL", "SUPABASE_TEST_ANON_KEY", "RLS_SUSPENDED_JWT", "RLS_INACTIVE_JWT",
  "RLS_TIER1_JWT", "RLS_QUALIFIED_JWT", "RLS_MODERATOR_JWT", "RLS_INFLUENCER_JWT",
  "RLS_SUPER_ADMIN_JWT", "RLS_HIGH_TIER_EVENT_ID", "RLS_HIGH_TIER_LESSON_ID",
  "RLS_OTHER_NOTIFICATION_ID",
];
const missing = required.filter((name) => !process.env[name]);
const skip = missing.length ? `Missing isolated Supabase RLS fixture variables: ${missing.join(", ")}` : false;

const client = (jwt) => createClient(process.env.SUPABASE_TEST_URL, process.env.SUPABASE_TEST_ANON_KEY, {
  global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {},
  auth: { autoRefreshToken: false, persistSession: false },
});

async function expectNoRows(result) {
  assert.equal(result.error, null, result.error?.message);
  assert.deepEqual(result.data, []);
}

test("anonymous, suspended, and inactive identities cannot read protected records", { skip }, async () => {
  for (const jwt of [undefined, process.env.RLS_SUSPENDED_JWT, process.env.RLS_INACTIVE_JWT]) {
    const db = client(jwt);
    await expectNoRows(await db.from("events").select("id").eq("id", process.env.RLS_HIGH_TIER_EVENT_ID));
    await expectNoRows(await db.from("lessons").select("id").eq("id", process.env.RLS_HIGH_TIER_LESSON_ID));
  }
});

test("tier gates apply to events, lessons, and provider identifiers", { skip }, async () => {
  const lowTier = client(process.env.RLS_TIER1_JWT);
  await expectNoRows(await lowTier.from("events").select("id").eq("id", process.env.RLS_HIGH_TIER_EVENT_ID));
  await expectNoRows(await lowTier.from("lessons").select("id").eq("id", process.env.RLS_HIGH_TIER_LESSON_ID));
  assert.notEqual((await lowTier.rpc("get_lesson_video_file_id", { target_lesson_id: process.env.RLS_HIGH_TIER_LESSON_ID })).error, null);

  const qualified = client(process.env.RLS_QUALIFIED_JWT);
  assert.equal((await qualified.from("events").select("id").eq("id", process.env.RLS_HIGH_TIER_EVENT_ID)).error, null);
  assert.equal((await qualified.rpc("get_lesson_video_file_id", { target_lesson_id: process.env.RLS_HIGH_TIER_LESSON_ID })).error, null);
  await expectNoRows(await qualified.from("event_rooms").select("zoom_url"));
  await expectNoRows(await qualified.from("lesson_assets").select("video_file_id"));
});

test("members cannot forge progress or mutate protected records", { skip }, async () => {
  const member = client(process.env.RLS_TIER1_JWT);
  const forgedProgress = await member.from("lesson_progress").insert({ lesson_id: process.env.RLS_HIGH_TIER_LESSON_ID, watched_seconds: 999999, completion_percentage: 100, is_completed: true });
  assert.notEqual(forgedProgress.error, null);
  assert.notEqual((await member.from("profiles").update({ platform_role: "super_admin" }).eq("id", "00000000-0000-4000-8000-000000000001")).error, null);
  assert.notEqual((await member.from("memberships").update({ status: "active" }).neq("user_id", "00000000-0000-4000-8000-000000000001")).error, null);
  assert.notEqual((await member.from("payments").insert({})).error, null);
});

test("notification updates remain scoped to the signed-in member", { skip }, async () => {
  const member = client(process.env.RLS_TIER1_JWT);
  const result = await member.from("notifications").update({ is_read: true }).eq("id", process.env.RLS_OTHER_NOTIFICATION_ID).select("id");
  assert.equal(result.error, null, result.error?.message);
  assert.deepEqual(result.data, []);
});

test("staff fixtures retain only their intended event-management access", { skip }, async () => {
  for (const jwt of [process.env.RLS_MODERATOR_JWT, process.env.RLS_INFLUENCER_JWT, process.env.RLS_SUPER_ADMIN_JWT]) {
    const db = client(jwt);
    assert.equal((await db.from("events").select("id").limit(1)).error, null);
    await expectNoRows(await db.from("event_rooms").select("zoom_url"));
  }
});
