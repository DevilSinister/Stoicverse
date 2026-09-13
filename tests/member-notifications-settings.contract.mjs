import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("member messages are retired without changing creator navigation", async () => {
  const [nav, retiredPage] = await Promise.all([
    read("src/lib/navigation/rail.ts"),
    read("src/app/dashboard/messages/page.tsx"),
  ]);
  assert.doesNotMatch(nav, /Messages|\/dashboard\/messages/);
  // One label for /channels now: it is the same route for everyone, so calling
  // it "Channels" for a creator and "Communities" for a member described a
  // split that does not exist.
  assert.match(nav, /href: "\/channels", label: "Community"/);
  assert.match(nav, /href: "\/creator\/members", label: "Members"/);
  assert.match(retiredPage, /permanentRedirect\("\/channels"\)/);
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
  /*
    These three pinned hand-written behaviour that P2a deleted rather than
    changed: `notificationPanel.current?.querySelector` moved focus into the
    preview, `notificationTrigger.current?.focus` restored it on close, and
    `mobileMenuOpen && <aside` was the drawer. All three are Base UI's job now —
    the popover and the overlay own focus move, focus restore, Escape and scroll
    lock. The behaviour is what mattered, so the assertions follow it to where
    it lives instead of being deleted with the code that used to provide it.
  */
  assert.match(shell, /from "@\/components\/ui\/popover"/, "the preview is a portalled popover");
  assert.match(shell, /<PopoverTrigger/, "the bell is its trigger, so focus returns to the bell");
  assert.match(shell, /placement="sheet-left"/, "the drawer is the overlay primitive");
  assert.doesNotMatch(shell, /"Tab"/, "no hand-rolled Tab cycle survives in the chrome");
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
