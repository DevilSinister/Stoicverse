import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("course availability ignores tiers, prerequisites, enrollment, and sequence", async () => {
  const [migration, catalog, detail, video, player] = await Promise.all([
    read("supabase/migrations/20260802000000_open_courses_and_cosmetic_roles.sql"),
    read("src/components/courses/LearningPathCatalog.tsx"),
    read("src/app/courses/[id]/CourseDetailPage.tsx"),
    read("src/app/courses/[id]/video/[videoId]/VideoPage.tsx"),
    read("src/components/courses/LessonWorkspacePlayer.tsx"),
  ]);
  assert.match(migration, /course_record\.status = 'published'/);
  assert.doesNotMatch(migration.match(/create or replace function public\.course_is_available[\s\S]*?\$\$;/)?.[0] ?? "", /has_tier_access|course_prerequisites/);
  assert.doesNotMatch(migration.match(/create or replace function public\.course_video_is_unlocked[\s\S]*?\$\$;/)?.[0] ?? "", /course_enrollments|previous_video/);
  assert.match(migration, /video\.release_at is null or video\.release_at <= now\(\)/);
  assert.match(migration, /insert into public\.course_enrollments\(course_id, user_id\)/);
  assert.doesNotMatch(catalog, /Locked|Prerequisites required|Available from/);
  assert.match(detail, /Watch any released lesson in the order that works for you/);
  assert.match(video, /isUnlocked: true/);
  assert.match(player, /isUnlocked: true/);
  assert.doesNotMatch(player, /videos\.slice\(0, index\)|unlock the next session/);
});

test("creator course controls keep achievements but remove access tiers and prerequisites", async () => {
  const [actions, manager] = await Promise.all([
    read("src/app/courses/actions.ts"),
    read("src/components/creator/CreatorCourseManagerV2.tsx"),
  ]);
  assert.match(actions, /min_tier: 1/);
  assert.doesNotMatch(actions, /formData\.getAll\("prerequisiteIds"\)/);
  assert.doesNotMatch(manager, /Min Access Tier|Required Prerequisites/);
  assert.match(manager, /Completion Achievement/);
  assert.match(manager, /Open to All Members/);
});

test("cosmetic roles are creator-managed, member-readable, and display-only", async () => {
  const [migration, page, actions, surface] = await Promise.all([
    read("supabase/migrations/20260802000000_open_courses_and_cosmetic_roles.sql"),
    read("src/app/creator/members/page.tsx"),
    read("src/app/creator/members/actions.ts"),
    read("src/components/community/CommunitySurface.tsx"),
  ]);
  assert.match(migration, /create table public\.cosmetic_roles/);
  assert.match(migration, /permission_config jsonb not null default '\{\}'::jsonb/);
  assert.match(migration, /create table public\.cosmetic_role_assignments/);
  assert.match(migration, /public\.is_influencer\(\) and assigned_by = \(select auth\.uid\(\)\)/);
  assert.match(page, /requireInfluencerWorkspace\("\/creator\/members"\)/);
  assert.match(actions, /requireInfluencer\(\)/);
  assert.match(surface, /post\.authorRoles\?\.map/);
  assert.doesNotMatch(migration, /permission_config.*allowed_roles|permission_config.*min_tier/);
});
