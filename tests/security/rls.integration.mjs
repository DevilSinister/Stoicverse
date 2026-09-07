import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_TEST_URL", "SUPABASE_TEST_ANON_KEY", "RLS_SUSPENDED_JWT", "RLS_INACTIVE_JWT",
  "RLS_TIER1_JWT", "RLS_QUALIFIED_JWT", "RLS_MODERATOR_JWT", "RLS_INFLUENCER_JWT",
  "RLS_SUPER_ADMIN_JWT", "RLS_HIGH_TIER_EVENT_ID", "RLS_HIGH_TIER_LESSON_ID",
  "RLS_OTHER_NOTIFICATION_ID", "RLS_TIER1_USER_ID", "RLS_HIGH_TIER_COURSE_ID",
  "RLS_LOCKED_COURSE_VIDEO_ID", "RLS_OTHER_MEMBER_ID",
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

test("tier gates remain for events while course and lesson content is open", { skip }, async () => {
  const lowTier = client(process.env.RLS_TIER1_JWT);
  await expectNoRows(await lowTier.from("events").select("id").eq("id", process.env.RLS_HIGH_TIER_EVENT_ID));
  assert.equal((await lowTier.from("lessons").select("id").eq("id", process.env.RLS_HIGH_TIER_LESSON_ID)).error, null);
  assert.equal((await lowTier.rpc("get_lesson_video_file_id", { target_lesson_id: process.env.RLS_HIGH_TIER_LESSON_ID })).error, null);

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
  assert.notEqual((await member.rpc("gift_member_subscription", { target_user_id: process.env.RLS_OTHER_MEMBER_ID, gift_duration_months: 1 })).error, null);
  assert.notEqual((await member.rpc("record_member_moderation", { target_user_id: process.env.RLS_OTHER_MEMBER_ID, moderation_action: "suspend", moderation_reason: "forged" })).error, null);
  assert.notEqual((await member.rpc("set_member_platform_role", { target_user_id: process.env.RLS_OTHER_MEMBER_ID, desired_role: "moderator" })).error, null);
  assert.notEqual((await member.from("member_weekly_turnover").upsert({ user_id: process.env.RLS_OTHER_MEMBER_ID, week_start: "2026-08-10", amount_usd: 50, updated_by: process.env.RLS_TIER1_USER_ID })).error, null);
});

test("members see only their turnover while the influencer can search the directory", { skip }, async () => {
  const member = client(process.env.RLS_TIER1_JWT);
  const ownSummary = await member.from("member_turnover_summary").select("user_id,current_week_turnover,all_time_turnover");
  assert.equal(ownSummary.error, null, ownSummary.error?.message);
  assert.ok(ownSummary.data.every((row) => row.user_id === process.env.RLS_TIER1_USER_ID));
  assert.deepEqual((await member.rpc("search_creator_members", { page_size: 2 })).data, []);

  const influencer = client(process.env.RLS_INFLUENCER_JWT);
  const directory = await influencer.rpc("search_creator_members", { page_size: 2 });
  assert.equal(directory.error, null, directory.error?.message);
  assert.ok(Array.isArray(directory.data));
});

test("course writes and provider assets remain influencer-only", { skip }, async () => {
  const member = client(process.env.RLS_TIER1_JWT);
  assert.notEqual((await member.from("courses").insert({ title: "Forged course", min_tier: 1, completion_tier: 5, created_by: process.env.RLS_TIER1_USER_ID })).error, null);
  assert.notEqual((await member.from("course_video_assets").select("video_file_id")).error, null);
});

test("active members can enroll in and watch any released course", { skip }, async () => {
  const lowTier = client(process.env.RLS_TIER1_JWT);
  assert.equal((await lowTier.rpc("enroll_in_course", { target_course_id: process.env.RLS_HIGH_TIER_COURSE_ID })).error, null);
  assert.equal((await lowTier.rpc("get_course_video_file_id", { target_video_id: process.env.RLS_LOCKED_COURSE_VIDEO_ID })).error, null);
  assert.equal((await lowTier.rpc("record_course_video_progress", { target_video_id: process.env.RLS_LOCKED_COURSE_VIDEO_ID, elapsed_seconds: 15 })).error, null);
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
