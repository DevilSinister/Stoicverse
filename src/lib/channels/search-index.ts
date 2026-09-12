/**
 * Ranking the things the browser already knows about.
 *
 * Channels, categories and members are all in `CommunityProvider` before
 * anybody types a character — they are what the sidebar and the member list
 * are drawn from. So searching them is a filter over an array, not a request,
 * and the results can land on the keystroke rather than after it.
 *
 * Messages are the exception and stay on the server: there is no local copy of
 * a channel's history, and there never should be.
 *
 * Zero imports, so the unit test loads this file directly.
 */

export type SearchKind = "channel" | "category" | "member";

export type SearchCandidate = {
  kind: SearchKind;
  id: string;
  name: string;
  /** Shown under the name: a category for a channel, a role for a member. */
  detail?: string | null;
};

export type RankedResult = SearchCandidate & { score: number };

/** Enough to be useful, few enough that messages are still on the screen. */
export const LOCAL_RESULTS_PER_KIND = 5;

/**
 * How well a name answers a query.
 *
 * Three tiers rather than a fuzzy distance: exact, starts-with, contains. A
 * fuzzy matcher earns its keep over thousands of candidates, and over a few
 * dozen channels it mostly produces surprising orderings nobody asked for —
 * `general` should not lose to `gel` because the letters are closer together.
 *
 * Returns null when the name does not answer the query at all.
 */
export function scoreName(name: string, query: string): number | null {
  const haystack = name.toLowerCase();
  const needle = query.toLowerCase();
  if (needle === "") return null;

  if (haystack === needle) return 300;
  if (haystack.startsWith(needle)) return 200 - haystack.length;

  const at = haystack.indexOf(needle);
  if (at === -1) {
    // A word boundary inside a longer name still counts: "notes" should find
    // "release notes", which neither of the tests above does.
    const words = haystack.split(/[\s_-]+/);
    return words.some((word) => word.startsWith(needle)) ? 100 - haystack.length : null;
  }
  return 50 - at;
}

/**
 * The best local matches, grouped by kind, highest first.
 *
 * Each kind is capped separately rather than the list as a whole: a query that
 * matches nine channels must not push the one member who matches off the end,
 * because the person who typed it may well have meant the member.
 */
export function rankLocal(
  candidates: readonly SearchCandidate[],
  query: string,
  perKind = LOCAL_RESULTS_PER_KIND,
): RankedResult[] {
  const trimmed = query.trim();
  if (trimmed === "") return [];

  const scored: RankedResult[] = [];
  for (const candidate of candidates) {
    const score = scoreName(candidate.name, trimmed);
    if (score !== null) scored.push({ ...candidate, score });
  }

  scored.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  const taken = new Map<SearchKind, number>();
  return scored.filter((result) => {
    const used = taken.get(result.kind) ?? 0;
    if (used >= perKind) return false;
    taken.set(result.kind, used + 1);
    return true;
  });
}

/**
 * Everything searchable that the provider already holds.
 *
 * Categories are derived from the channels rather than carried separately,
 * because that is where they come from — a category with no channel the viewer
 * can see is a category they cannot open, and should not be offered.
 */
export function localCandidates(
  channels: readonly { id: string; name: string; categoryId: string; categoryName: string }[],
  members: readonly { id: string; fullName: string; topRoleName: string | null }[],
): SearchCandidate[] {
  const candidates: SearchCandidate[] = [];
  const seenCategories = new Set<string>();

  for (const channel of channels) {
    candidates.push({ kind: "channel", id: channel.id, name: channel.name, detail: channel.categoryName });
    if (!seenCategories.has(channel.categoryId)) {
      seenCategories.add(channel.categoryId);
      candidates.push({ kind: "category", id: channel.categoryId, name: channel.categoryName, detail: null });
    }
  }

  for (const member of members) {
    candidates.push({ kind: "member", id: member.id, name: member.fullName, detail: member.topRoleName });
  }

  return candidates;
}
