import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("channel categories and access rules are enforced by the database", async () => {
  const migration = await read("supabase/migrations/20260717120000_discord_style_community_channels.sql");
  assert.match(migration, /create table public\.channel_categories/);
  assert.match(migration, /category_id uuid/);
  assert.match(migration, /unique \(name\)/);
  assert.match(migration, /allowed_roles text\[\]/);
  assert.match(migration, /visibility_mode/);
  assert.match(migration, /create or replace function public\.can_view_channel/);
  assert.match(migration, /create or replace function public\.community_channel_directory/);
  assert.match(migration, /channel\.visibility_mode = 'locked'/);
  assert.match(migration, /create policy posts_staff_insert/);
  assert.match(migration, /create policy posts_read/);
  assert.match(migration, /create policy reactions_own_write/);
  assert.doesNotMatch(migration, /community_id/);
});

test("creator management and member channel browsing use the shared secure surface", async () => {
  const [actions, surface, workspace, reactions] = await Promise.all([
    read("src/app/creator/channels/actions.ts"),
    read("src/components/community/CommunitySurface.tsx"),
    read("src/components/community/CommunityWorkspace.tsx"),
    read("src/app/community/actions.ts"),
  ]);
  assert.match(actions, /saveCategory/);
  assert.match(actions, /saveChannel/);
  assert.match(actions, /setCommunityStructureArchived/);
  assert.match(actions, /deleteCommunityStructure/);
  assert.match(actions, /reorderCommunityStructure/);
  assert.match(actions, /Channels with posts can only be archived/);
  assert.match(surface, /Reach .* to unlock/);
  assert.match(surface, /draggable=\{creator\}/);
  assert.match(surface, /Manage categories and channels/);
  assert.match(surface, /createStaffPost/);
  assert.match(workspace, /community_channel_directory/);
  assert.match(workspace, /selectedChannelId/);
  assert.match(reactions, /toggleReaction/);
  assert.match(reactions, /Moderator or influencer access is required/);
});
