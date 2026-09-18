import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the development login bypass cannot exist in a production build", async () => {
  const gate = await read("src/lib/dev/login-bypass.ts");
  const route = await read("src/app/api/dev/login/route.ts");
  const panel = await read("src/components/auth/DevLoginPanel.tsx");

  // Build-time guard: Next inlines NODE_ENV, so the branch is compiled out.
  assert.match(gate, /process\.env\.NODE_ENV !== "development"/);
  assert.match(panel, /process\.env\.NODE_ENV !== "development"/);
  // Opt-in server variable, host allow-list, and a secret of real length.
  assert.match(gate, /DEV_LOGIN_BYPASS/);
  assert.match(gate, /DEV_LOGIN_ALLOWED_SUPABASE_HOSTS/);
  assert.match(gate, /DEV_LOGIN_SECRET/);
  assert.match(gate, /SUPABASE_SERVICE_ROLE_KEY/);
  // Nothing about this feature is ever public.
  for (const source of [gate, route, panel]) {
    assert.doesNotMatch(source, /NEXT_PUBLIC_DEV/);
  }
  // The route hides rather than refuses, and only answers a local POST.
  assert.match(route, /notFound\(\)/);
  assert.match(route, /export async function GET\(\)\s*\{\s*notFound\(\);/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /isLocalRequest\(request\)/);
});

test("the prospect persona has no membership, which is the only reason it exists", async () => {
  /*
    Every other seeded persona is handed an active membership, so `proxy.ts`
    redirects all of them away from `/checkout` and `/checkout/success` can only
    be reached in its granted state. Phase 5 shipped both screens without either
    being rendered once, and this persona is what closed that gap.

    The membership row is deleted rather than merely skipped: the account is
    re-seeded on every sign-in, so a row left behind by an earlier run would
    turn the prospect back into a member and the redirect would return with
    nothing in the diff to explain it.
  */
  const gate = await read("src/lib/dev/login-bypass.ts");
  const route = await read("src/app/api/dev/login/route.ts");

  assert.match(gate, /"prospect"/, "the persona is declared");
  assert.match(route, /persona === "prospect"/, "the route branches on it");
  assert.match(
    route,
    /from\("memberships"\)\s*\.delete\(\)/,
    "the prospect's membership is cleared, not just left unwritten",
  );
  // The upsert that grants a membership must stay out of the prospect's path.
  const grant = route.slice(route.indexOf('persona === "prospect"'));
  assert.match(grant, /else if \(persona !== "creator"\)/, "the grant is an else-branch, not a fall-through");
});

test("the deletion persona arrives with an open request, and re-seeding does not collide", async () => {
  /*
    `/account/deletion-pending` needs an `account_deletion_requests` row to
    render, and the only control that writes one verifies the account password -
    which a seeded persona does not have. The screen was redesigned in phase 5
    and never rendered; this persona is what closed that gap.

    The delete-before-insert is load-bearing rather than tidiness:
    `account_deletion_requests_active_user_idx` is unique per user across
    pending/processing/failed, so signing in twice would fail on the second, and
    a tester who pressed Cancel on the screen would never get the state back.
  */
  const gate = await read("src/lib/dev/login-bypass.ts");
  const route = await read("src/app/api/dev/login/route.ts");

  assert.match(gate, /"deleting"/, "the persona is declared");
  assert.match(route, /persona === "deleting"/, "the route branches on it");
  assert.match(
    route,
    /from\("account_deletion_requests"\)\s*\.delete\(\)/,
    "an earlier request is cleared before a new one is written",
  );
  assert.match(route, /status: "pending"/, "the seeded request is one the screen will show");
  // The table's CHECK demands scheduled_at >= created_at + 29 days, and the
  // real action uses 30. A shorter constant here would fail on insert.
  assert.match(route, /30 \* 86_400_000/, "the term matches requestAccountDeletion");
  assert.match(route, /requested_role: platformRole/, "requested_role is NOT NULL");
});

test("the example env file documents the bypass without enabling it", async () => {
  const example = await read(".env.example");
  assert.match(example, /# DEV_LOGIN_BYPASS=1/);
  assert.doesNotMatch(example, /^DEV_LOGIN_BYPASS=1/m);
  assert.doesNotMatch(example, /^SUPABASE_SERVICE_ROLE_KEY=.+/m);
});

test("the proxy never treats /api/dev as a protected surface it might redirect into", async () => {
  const proxy = await read("proxy.ts");
  // /api is excluded from the matcher, so the route is reached directly and
  // its own 404 gate is the only thing between a request and a session.
  assert.match(proxy, /matcher: \["\/\(\(\?!api/);
  assert.doesNotMatch(proxy, /\/api\/dev/);
});
