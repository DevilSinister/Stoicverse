/**
 * Validates a caller-supplied `?next=` value before it is used in a redirect.
 *
 * A prefix check like `startsWith("/") && !startsWith("//")` is NOT sufficient.
 * The WHATWG URL parser treats a backslash as a slash for http(s) URLs, and it
 * strips ASCII tab/CR/LF anywhere in the input *before* parsing. Both turn an
 * apparently-relative path into a protocol-relative authority:
 *
 *   new URL("/\\evil.com",  "https://app.test") -> https://evil.com/
 *   new URL("/\t/evil.com", "https://app.test") -> https://evil.com/
 *
 * (`%09` in a query string is percent-decoded by `searchParams.get()` into a
 * raw tab before it ever reaches this function, so the decoded form is what
 * must be rejected.)
 *
 * This function rejects those characters outright AND re-parses the candidate
 * against a sentinel origin, returning only a normalized same-origin path. No
 * import may pull in server-only modules: this runs in the proxy, in server
 * actions, in route handlers, and in the browser.
 */

const SENTINEL_ORIGIN = "https://safe-path.invalid";
const MAX_LENGTH = 512;

export const DEFAULT_NEXT_PATH = "/dashboard";

export function safeNextPath(candidate: unknown, fallback: string = DEFAULT_NEXT_PATH): string {
  if (typeof candidate !== "string") return fallback;
  if (candidate.length === 0 || candidate.length > MAX_LENGTH) return fallback;

  // Must be a root-relative path, never a scheme, authority, or bare segment.
  if (!candidate.startsWith("/")) return fallback;

  // Stripped by the URL parser; would smuggle an authority past the prefix check.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(candidate)) return fallback;

  // Equivalent to "/" for special schemes.
  if (candidate.includes("\\")) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(candidate, SENTINEL_ORIGIN);
  } catch {
    return fallback;
  }

  // If the candidate escaped to any other host, the origin will have changed.
  if (resolved.origin !== SENTINEL_ORIGIN) return fallback;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
