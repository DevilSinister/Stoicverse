import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readCode = async (path) =>
  (await read(path)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
  Password reset, added in phase 4. Before it, a forgotten password was a lost
  account: there was no reset route in the product at all.

  Everything below is a property somebody could remove without any screen
  looking wrong, which is why it is pinned rather than left to review.
*/

test("a reset request cannot be used to test whether an address is registered", async () => {
  const actions = await readCode("src/app/auth/actions.ts");

  // One exit for every path. A branch that redirected differently for a known
  // address would answer "is this person a member here" to anyone who asked.
  const redirects = actions.match(/redirect\("\/auth\/reset\?sent=1"\)/g) ?? [];
  assert.equal(redirects.length, 1, "one acknowledgement, taken unconditionally");

  // Including the rate-limited path: the limiter skips the send, not the reply.
  assert.match(actions, /if \(!limited\) \{/);

  // And the result of the send is deliberately never read.
  assert.doesNotMatch(actions, /const \{ error[^}]*\} = await supabase\.auth\.resetPasswordForEmail/);
});

test("the reset link goes through the callback that already handles a dead link", async () => {
  const actions = await readCode("src/app/auth/actions.ts");
  assert.match(actions, /redirectTo: `\$\{origin\}\/auth\/callback\?next=/);

  // /auth/callback sends a failed exchange to the login form with a notice, so
  // an expired reset link fails the way an expired confirmation link does.
  const callback = await readCode("src/app/auth/callback/route.ts");
  assert.match(callback, /\/login\?error=link_expired/);
  const form = await read("src/components/auth/AuthForm.tsx");
  assert.match(form, /link_expired:/, "and the form explains that arrival");
});

test("setting a new password requires the session the link established", async () => {
  const actions = await readCode("src/app/auth/actions.ts");
  assert.match(actions, /if \(!\(await currentViewer\(\)\)\) \{/);
  assert.match(actions, /updateUser\(\{ password \}\)/);

  // The screen answers the expired case itself rather than bouncing to /login,
  // where a generic notice reads as "your account is gone".
  const page = await readCode("src/app/auth/reset/confirm/page.tsx");
  assert.match(page, /if \(!viewer\)/);
});

test("the confirmation screen never puts an address in the URL", async () => {
  const actions = await readCode("src/app/auth/actions.ts");
  // A cookie, not a query parameter: ?email= writes somebody's address into
  // their history and into every log between here and them.
  assert.match(actions, /httpOnly: true/);
  assert.match(actions, /redirect\("\/signup\/confirm"\)/);
  assert.doesNotMatch(actions, /signup\/confirm\?/);

  const page = await readCode("src/app/signup/confirm/page.tsx");
  assert.match(page, /await takePendingEmail\(\)/);
  assert.doesNotMatch(page, /searchParams/);
});

test("auth constants that are not server actions live outside the server module", async () => {
  /*
    A "use server" module may only export async functions. Exporting the signup
    acknowledgement string from `auth/actions.ts` compiled to a module with no
    exports at all - every action in it reported as missing, at runtime, with a
    clean typecheck. Caught in a browser, not by tsc.
  */
  const actions = await read("src/app/auth/actions.ts");
  const exported = actions.match(/^export (?!async function)/gm) ?? [];
  assert.deepEqual(exported, [], "every export in a use-server file is an async function");
  assert.match(await read("src/lib/auth/policy.ts"), /export const SIGNUP_ACK/);
});
