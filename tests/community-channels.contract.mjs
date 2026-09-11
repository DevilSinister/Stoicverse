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
  // The community surface was split into ChannelSidebar / MessageStream /
  // MessageComposer, and structure editing then moved again into
  // components/community/structure/. The invariants below are unchanged; only
  // their homes are.
  const [actions, surface, sidebar, composer, workspace, reactions, editor, form, list, order] = await Promise.all([
    read("src/app/creator/channels/actions.ts"),
    read("src/components/community/CommunitySurface.tsx"),
    read("src/components/community/ChannelSidebar.tsx"),
    read("src/components/community/MessageComposer.tsx"),
    read("src/components/community/CommunityWorkspace.tsx"),
    read("src/app/community/actions.ts"),
    read("src/components/community/structure/StructureEditor.tsx"),
    read("src/components/community/structure/StructureForm.tsx"),
    read("src/components/community/structure/StructureList.tsx"),
    read("src/components/community/structure/useStructureOrder.ts"),
  ]);
  assert.match(actions, /saveCategory/);
  assert.match(actions, /saveChannel/);
  assert.match(actions, /setCommunityStructureArchived/);
  assert.match(actions, /deleteCommunityStructure/);
  assert.match(actions, /reorderCommunityStructure/);
  assert.match(actions, /Channels with posts can only be archived/);
  assert.match(sidebar, /Reach .* to unlock/);
  assert.match(sidebar, /Manage structure/);
  // Structure editing has exactly one implementation. The modal on
  // /creator/channels and the inline pane on /creator/settings are the same
  // component with different chrome, so a field added to one cannot go missing
  // from the other.
  assert.match(surface, /StructureEditor/);
  assert.match(editor, /variant: "modal"/);
  assert.match(editor, /variant: "inline"/);
  assert.doesNotMatch(surface, /function StructureForm|function AccessFields/);
  // Every structure write still goes through the creator channel actions.
  assert.match(form, /saveCategory/);
  assert.match(form, /saveChannel/);
  assert.match(form, /setCommunityStructureArchived/);
  assert.match(form, /deleteCommunityStructure/);
  // reorderCommunityStructure shipped with no caller for a while. These keep it
  // wired: a reachable keyboard control on every row, and a real write behind it.
  assert.match(order, /reorderCommunityStructure/);
  assert.match(list, /aria-label=\{`Move \$\{label\} up`\}/);
  assert.match(list, /aria-label=\{`Move \$\{label\} down`\}/);
  assert.match(list, /role="group"/);
  assert.match(composer, /sendMessage/);
  assert.match(workspace, /community_channel_directory/);
  assert.match(workspace, /selectedChannelId/);
  assert.match(reactions, /toggleReaction/);
  // Phase 3 replaced the platform-role copy with the permission the database
  // actually asks for. A message action that still said "moderator access is
  // required" would be describing a rule that no longer exists.
  assert.doesNotMatch(reactions, /Moderator or influencer access is required/);
  assert.match(reactions, /community_has/);
  assert.match(reactions, /You do not have permission to post in this channel\./);
});

test("post edits are author-only, moderation is audited, and the soft-deleted row still passes RLS", async () => {
  // 20260722000000 introduced the soft-delete escape hatch. 20260910000000
  // supersedes its policy and its single-argument function, so the current
  // state must be asserted against the newer migration or this test passes
  // while describing a database that no longer exists.
  const [legacy, current] = await Promise.all([
    read("supabase/migrations/20260722000000_allow_staff_soft_delete_posts.sql"),
    read("supabase/migrations/20260910000000_community_moderation_audit.sql"),
  ]);
  assert.match(legacy, /with check \(public\.is_staff\(\) and \(is_deleted or public\.can_view_channel\(channel_id\)\)\)/);

  assert.match(current, /drop policy if exists posts_staff_update on public\.posts/);
  assert.match(current, /create policy posts_author_or_staff_update on public\.posts/);
  assert.match(current, /author_id = \(select auth\.uid\(\)\) or public\.is_staff\(\)/);
  // The escape hatch survives the rewrite.
  assert.match(current, /is_deleted or public\.can_view_channel\(channel_id\)/);
  assert.match(current, /Only the author can edit this message/);

  // The defaulted parameter requires a DROP first, or soft_delete_post(uuid)
  // becomes ambiguous (42725).
  assert.match(current, /drop function if exists public\.soft_delete_post\(uuid\);/);
  assert.match(current, /create or replace function public\.soft_delete_post\(/);
  assert.match(current, /delete_reason  text default null/);
  assert.match(current, /grant execute on function public\.soft_delete_post\(uuid, text\) to authenticated/);
});

test("the moderation audit log is append-only and written only by the database", async () => {
  const migration = await read("supabase/migrations/20260910000000_community_moderation_audit.sql");
  assert.match(migration, /create table if not exists public\.community_moderation_events/);
  assert.match(migration, /alter table public\.community_moderation_events enable row level security/);
  // Exactly one policy, and it is a read.
  assert.match(migration, /create policy community_moderation_events_staff_read[\s\S]*?for select to authenticated/);
  assert.doesNotMatch(migration, /create policy \w+ on public\.community_moderation_events\s+for (insert|update|delete|all)/);
  // Table grants are not a boundary in this project, so the revoke is explicit.
  assert.match(migration, /revoke insert, update, delete, truncate\s+on public\.community_moderation_events from anon, authenticated/);
  // Only the trigger writes audit rows, so a direct UPDATE cannot skip the log.
  assert.match(migration, /create trigger posts_guard_update\s+before update on public\.posts/);
  assert.match(migration, /revoke all on function public\.guard_post_update\(\) from public, anon, authenticated/);
});

test("database errors reach the client as fixed copy, never as raw Postgres text", async () => {
  const [helper, community, channels] = await Promise.all([
    read("src/lib/supabase/errors.ts"),
    read("src/app/community/actions.ts"),
    read("src/app/creator/channels/actions.ts"),
  ]);
  // P0001 is the only SQLSTATE our own RAISE statements use, so it is the only
  // message safe to pass through (AUDIT_2026-09-06 M2).
  assert.match(helper, /error\.code === "P0001"/);
  for (const source of [community, channels]) {
    assert.doesNotMatch(source, /error:\s*\w*[eE]rror\.message/);
    assert.match(source, /postgresMessage\(/);
  }
});

test("client identifiers are validated with the strict shared UUID pattern", async () => {
  const [shared, community, channels, members] = await Promise.all([
    read("src/lib/security/uuid.ts"),
    read("src/app/community/actions.ts"),
    read("src/app/creator/channels/actions.ts"),
    read("src/app/creator/members/actions.ts"),
  ]);
  assert.match(shared, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/);
  for (const source of [community, channels, members]) {
    // The loose pattern accepted hyphens in place of hex digits (L8).
    assert.doesNotMatch(source, /\[0-9a-f-\]\{27\}/);
    assert.match(source, /from "@\/lib\/security\/uuid"/);
  }
});

test("community mentions create notifications for all members or an exact tier", async () => {
  const migration = await read("supabase/migrations/20260722070000_community_mention_notifications.sql");
  assert.match(migration, /create or replace function public\.notify_community_mentions\(\)/);
  assert.match(migration, /@\(all\|tier-\[1-5\]\)/);
  assert.match(migration, /membership\.status = 'active'/);
  assert.match(migration, /case when tier\.is_master then 5 else tier\.current_tier end/);
  assert.match(migration, /create trigger posts_notify_mentions/);
});

test("pinned community messages keep chronological placement and can be filtered in-channel", async () => {
  const [workspace, surface] = await Promise.all([
    read("src/components/community/CommunityWorkspace.tsx"),
    read("src/components/community/CommunitySurface.tsx"),
  ]);
  assert.doesNotMatch(workspace, /order\("is_pinned"/);
  // The boolean showPinned became a three-way view after the redesign.
  assert.match(surface, /const \[view, setView\] = useState<"all" \| "pinned" \| "mentions">\("all"\)/);
  assert.match(surface, /posts\.filter\(\(post\) => post\.isPinned\)/);
});

test("community timeline keeps new messages at the bottom and signals unseen arrivals", async () => {
  const [workspace, surface] = await Promise.all([
    read("src/components/community/CommunityWorkspace.tsx"),
    read("src/components/community/CommunitySurface.tsx"),
  ]);
  assert.match(workspace, /order\("created_at", \{ ascending: true \}\)/);
  assert.match(surface, /const \[newCount, setNewCount\] = useState\(0\)/);
  assert.match(surface, /\{newCount\} new \{newCount === 1 \? "message" : "messages"\}/);
});
