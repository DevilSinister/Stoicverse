/**
 * Database error text that is safe to return to a client.
 *
 * Returning `error.message` verbatim leaks column, constraint and policy names
 * (AUDIT_2026-09-06 M2). Every `raise exception` in this project's triggers and
 * RPCs carries plpgsql's default SQLSTATE `P0001`, which PostgreSQL itself
 * essentially never emits — so `P0001` is a safe passthrough channel for
 * messages we wrote for the member, and every other code is a diagnostic that
 * stays in the server log.
 */
type DatabaseError = { code?: string | null; message?: string | null };

export function postgresMessage(error: DatabaseError, fallback: string, scope = "community"): string {
  console.error(`[${scope}]`, { code: error.code ?? null });
  return error.code === "P0001" && error.message ? error.message : fallback;
}
