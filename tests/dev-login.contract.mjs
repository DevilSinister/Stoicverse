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
