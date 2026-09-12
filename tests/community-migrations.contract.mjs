import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Hygiene every migration from the Discord rebuild onward must satisfy. The
 * rules come from the project's own recorded mistakes: a missing rollback, an
 * unpinned search_path, a definer function still executable by PUBLIC, and a
 * new table with row-level security left off have each happened once.
 */

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const ROLLBACKS = new URL("../supabase/rollback/", import.meta.url);
const FIRST_REBUILD_MIGRATION = "20260912000000";

async function rebuildMigrations() {
  const names = (await readdir(MIGRATIONS)).filter(
    (name) => name.endsWith(".sql") && name.slice(0, 14) >= FIRST_REBUILD_MIGRATION,
  );
  assert.ok(names.length >= 1, "at least the composer-constants migration exists");
  return Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(new URL(name, MIGRATIONS), "utf8") })),
  );
}

test("every rebuild migration ships a rollback and never names a tenant", async () => {
  for (const { name, sql } of await rebuildMigrations()) {
    const rollback = new URL(name.replace(/\.sql$/, ".down.sql"), ROLLBACKS);
    await access(rollback);
    assert.doesNotMatch(sql, /community_id/, `${name}: the schema is single-community`);
  }
});

test("every function pins search_path and every definer is revoked from PUBLIC", async () => {
  for (const { name, sql } of await rebuildMigrations()) {
    // `create function`, not only `create or replace`. Changing a function's
    // return type needs a drop and a plain create, and an assertion that only
    // knew the `or replace` spelling would have waved through an unpinned
    // definer every time a function's shape changed.
    const created = sql.match(/create (?:or replace )?function\s+([a-z_.]+)\s*\(/gi) ?? [];
    const pinned = sql.match(/set search_path (to|=) /gi) ?? [];
    assert.equal(pinned.length, created.length, `${name}: ${created.length} functions, ${pinned.length} search_path pins`);

    // Split at each `create function` and judge every definition inside its
    // own chunk. Scanning the whole file for "a create, then eventually
    // `security definer`" runs the lazy match out of one function and into the
    // next: a non-definer sitting above a definer was reported as a definer,
    // and — because matchAll resumes past the match it just made — the real
    // definer below it was never examined at all.
    const definers = sql
      .split(/(?=create (?:or replace )?function\s)/i)
      .filter((chunk) => /^create (?:or replace )?function\s/i.test(chunk) && /security definer/i.test(chunk))
      .map((chunk) => chunk.match(/^create (?:or replace )?function\s+([a-z_.]+)\s*\(/i)[1]);
    for (const fn of definers) {
      assert.match(
        sql,
        // `from public` may be followed by more roles. anon and authenticated
        // each hold their own EXECUTE grant from Supabase's default privileges,
        // and revoking PUBLIC does not touch either of them.
        new RegExp(`revoke execute on function ${fn.replace(".", "\\.")}\\([^)]*\\) from public\\b`),
        `${name}: ${fn} must be revoked from PUBLIC, not just anon`,
      );
    }
  }
});

test("every new table enables row-level security", async () => {
  for (const { name, sql } of await rebuildMigrations()) {
    const tables = [...sql.matchAll(/create table (?:if not exists )?([a-z_.]+)/gi)].map((match) => match[1]);
    for (const table of tables) {
      assert.match(
        sql,
        new RegExp(`alter table ${table.replace(".", "\\.")} enable row level security`),
        `${name}: ${table} must enable RLS`,
      );
    }
  }
});
