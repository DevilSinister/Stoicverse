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
    const created = sql.match(/create or replace function\s+([a-z_.]+)\s*\(/gi) ?? [];
    const pinned = sql.match(/set search_path (to|=) /gi) ?? [];
    assert.equal(pinned.length, created.length, `${name}: ${created.length} functions, ${pinned.length} search_path pins`);

    const definers = [
      ...sql.matchAll(/create or replace function\s+([a-z_.]+)\s*\(([^)]*)\)[\s\S]*?security definer/gi),
    ];
    for (const [, fn] of definers) {
      assert.match(
        sql,
        new RegExp(`revoke execute on function ${fn.replace(".", "\\.")}\\([^)]*\\) from public;`),
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
