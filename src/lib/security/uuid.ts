/**
 * Strict RFC-4122 shape check for identifiers arriving from a client.
 *
 * Several action modules previously carried the loose `/^[0-9a-f]{8}-[0-9a-f-]{27}$/i`,
 * which accepts hyphens in place of hex digits and so lets malformed values reach
 * the database (AUDIT_2026-09-06 L8). This is the single strict definition.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(candidate: unknown): candidate is string {
  return typeof candidate === "string" && UUID_PATTERN.test(candidate);
}
