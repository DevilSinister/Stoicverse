import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260814084330_creator_member_operations.sql";

test("migration enforces gifting, moderation, turnover, grants, and RLS contracts", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /source text not null default 'stripe'/);
  assert.match(sql, /duration_months in \(1, 3, 6, 12\)/);
  assert.match(sql, /source = 'gifted'[\s\S]*amount = 0[\s\S]*status = 'succeeded'/);
  assert.match(sql, /create trigger apply_gifted_membership/);
  assert.match(sql, /access_source = 'gifted'/);
  assert.match(sql, /greatest\(now\(\), coalesce\(existing_membership\.expires_at, now\(\)\)\)/);
  assert.match(sql, /Lifetime memberships cannot be extended/);
  assert.match(sql, /create table public\.member_moderation_events/);
  assert.match(sql, /create trigger apply_member_moderation/);
  assert.match(sql, /char_length\(trim\(reason\)\) between 3 and 500/);
  assert.match(sql, /alter table public\.member_weekly_turnover enable row level security/);
  assert.match(sql, /grant select, insert, update on public\.member_weekly_turnover to authenticated/);
  assert.match(sql, /revoke all on function private\.apply_gifted_membership\(\) from public, anon, authenticated/);
});

test("directory is indexed, cursor-paginated, filterable, and duplicate-safe", async () => {
  const [sql, route, server] = await Promise.all([read(migrationPath), read("src/app/api/creator/members/route.ts"), read("src/lib/member-operations/server.ts")]);
  assert.match(sql, /profiles_member_directory_cursor_idx/);
  assert.match(sql, /\(normalized_name, id\) > \(after_name, after_id\)/);
  assert.match(sql, /order by paged\.normalized_name, paged\.id/);
  assert.match(sql, /from paged/);
  assert.match(sql, /cosmetic_role_filter/);
  assert.match(sql, /jsonb_agg/);
  assert.match(sql, /limit least\(greatest\(page_size, 1\), 51\)/);
  assert.match(route, /authorizeInfluencerApi/);
  assert.match(server, /rows\.slice\(0, 50\)/);
  assert.match(server, /encodeMemberCursor/);
  assert.match(await read("src/app/api/creator/members/[id]/route.ts"), /get_creator_member_summary/);
});

test("member actions re-authorize and target protected database contracts", async () => {
  const actions = await read("src/app/creator/members/actions.ts");
  assert.ok((actions.match(/requireInfluencer\(\)/g) ?? []).length >= 7);
  assert.match(actions, /gift_member_subscription/);
  assert.match(actions, /record_member_moderation/);
  assert.match(actions, /set_member_platform_role/);
  assert.match(actions, /"\/creator\/members\/turnover"/);
  assert.match(actions, /"\/dashboard"/);
});

test("registry and turnover workspace expose required operational states", async () => {
  const [registry, details, roles, turnover] = await Promise.all([
    read("src/components/creator/members/MemberRegistry.tsx"), read("src/components/creator/members/MemberDetailModal.tsx"), read("src/components/creator/members/RoleManagerModal.tsx"), read("src/components/creator/members/TurnoverWorkspace.tsx"),
  ]);
  assert.match(registry, /Search by full name or exact member ID/);
  assert.match(registry, /Manage roles/);
  assert.match(registry, /No members match this search/);
  assert.match(details, /Gift access/);
  assert.match(details, /Confirm \{member\.isSuspended \? "reinstatement" : "suspension"\}/);
  assert.match(roles, /Confirm delete/);
  assert.match(turnover, /unsaved/);
  assert.match(turnover, /Save changes/);
});
