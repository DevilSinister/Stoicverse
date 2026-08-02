import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("member messages are retired without changing creator navigation", async () => {
  const [nav, retiredPage] = await Promise.all([
    read("src/lib/navigation/app-nav.ts"),
    read("src/app/dashboard/messages/page.tsx"),
  ]);
  assert.doesNotMatch(nav, /Messages|\/dashboard\/messages/);
  assert.match(nav, /href: "\/creator\/channels", label: "Channels"/);
  assert.match(nav, /href: "\/creator\/members", label: "Members"/);
  assert.match(retiredPage, /permanentRedirect\("\/dashboard\/community"\)/);
});

test("notification feed uses owned stable pagination and explicit read mutations", async () => {
  const [route, center, shell, migration] = await Promise.all([
    read("src/app/api/dashboard/notifications/route.ts"),
    read("src/components/notifications/NotificationCenter.tsx"),
    read("src/components/layout/AppShell.tsx"),
    read("supabase/migrations/20260802010000_member_notifications_account_settings.sql"),
  ]);
  assert.match(route, /\.eq\("user_id", user\.id\)/);
  assert.match(route, /\.order\("created_at"[\s\S]*\.order\("id"/);
  assert.match(route, /requestedLimit === 5 \? 5 : 30/);
  assert.match(route, /action === "mark_all_read"/);
  assert.match(route, /\.in\("id", ids\)/);
  assert.match(center, /Today/);
  assert.match(center, /Yesterday/);
  assert.match(center, /Load older/);
  assert.match(center, /event: "INSERT"/);
  assert.match(center, /event: "UPDATE"/);
  assert.doesNotMatch(center, /supabase\.auth\.getUser\(\)\.then/);
  assert.match(shell, /event: "INSERT"/);
  assert.match(shell, /event: "UPDATE"/);
  assert.doesNotMatch(shell, /supabase\.auth\.getUser\(\)\.then/);
  assert.match(shell, /preview\.filter\(\(item\) => !item\.is_read\)/);
  assert.match(shell, /View all/);
  assert.match(migration, /grant update \(is_read, read_at\) on public\.notifications to authenticated/);
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/);
});

test("optional notification categories are preference-aware and mandatory categories remain", async () => {
  const migration = await read("supabase/migrations/20260802010000_member_notifications_account_settings.sql");
  const filter = migration.match(/create or replace function public\.filter_notification_by_preference[\s\S]*?revoke all/)?.[0] ?? "";
  assert.match(filter, /community_mention/);
  assert.match(filter, /role_assigned/);
  assert.match(filter, /new_event/);
  assert.match(filter, /new_course/);
  assert.match(filter, /else\s+return new/);
});

test("settings actions validate identity, avatars, sessions, deletion, and accessible transitions", async () => {
  const [actions, workspace, shell, center, styles, proxy, edge] = await Promise.all([
    read("src/app/dashboard/settings/actions.ts"),
    read("src/components/settings/AccountSettingsWorkspace.tsx"),
    read("src/components/layout/AppShell.tsx"),
    read("src/components/notifications/NotificationCenter.tsx"),
    read("src/app/globals.css"),
    read("proxy.ts"),
    read("supabase/functions/finalize-account-deletions/index.ts"),
  ]);
  assert.match(actions, /current_password: currentPassword/);
  assert.match(actions, /image\/jpeg/);
  assert.match(actions, /5 \* 1024 \* 1024/);
  assert.match(actions, /scope: "others"/);
  assert.match(actions, /confirmation !== "DELETE"/);
  assert.match(actions, /30 \* 86_400_000/);
  assert.match(workspace, /Cosmetic roles express community identity/);
  assert.doesNotMatch(workspace, /upgrade|locked content|access tier/i);
  assert.match(workspace, /<form action=\{removeAction\}>/);
  assert.match(workspace, /mobileBackButton\.current\?\.focus/);
  assert.match(shell, /notificationPanel\.current\?\.querySelector/);
  assert.match(shell, /notificationTrigger\.current\?\.focus/);
  assert.match(shell, /mobileMenuOpen && <aside/);
  assert.match(center, /tabIndex=\{view === tab\.id \? 0 : -1\}/);
  assert.match(center, /ArrowLeft/);
  assert.match(center, /role="tabpanel"/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms/);
  assert.match(proxy, /account\/deletion-pending/);
  assert.match(edge, /claim_due_account_deletions/);
  assert.match(edge, /member-avatars/);
  assert.match(edge, /auth\.admin\.deleteUser/);
  assert.match(edge, /maximumAttempts = 5/);
});

test("deletion schema preserves discussions and payments without identity", async () => {
  const migration = await read("supabase/migrations/20260802010000_member_notifications_account_settings.sql");
  assert.match(migration, /posts[\s\S]*author_id drop not null/);
  assert.match(migration, /posts_author_id_fkey[\s\S]*on delete set null/);
  assert.match(migration, /payments[\s\S]*user_id drop not null/);
  assert.match(migration, /payments_user_id_fkey[\s\S]*on delete set null/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /status in \('pending', 'processing', 'cancelled', 'completed', 'failed'\)/);
});
