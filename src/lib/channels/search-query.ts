/**
 * `from: in: has: before: after:` — the search box's little language.
 *
 * The whole point is that a filter is *resolved*, not passed through. `from:`
 * has to become a user id before it reaches the database, and a name matching
 * nobody has to be reported rather than quietly searched for as text: a search
 * for `from:Adam` that returns everybody's messages looks like it worked and
 * is wrong.
 *
 * Zero imports, so the unit test loads this directly.
 */

export type HasFilter = "link" | "image" | "file";

export type SearchFilters = {
  /** What is left after the filters are taken out. May be empty. */
  text: string;
  channelId: string | null;
  authorId: string | null;
  has: HasFilter | null;
  /** ISO 8601, the start of the named day in the reader's own timezone. */
  before: string | null;
  after: string | null;
};

export type ParsedSearch = {
  filters: SearchFilters;
  /** Sentences to show the reader. A parse with problems must not be run. */
  problems: string[];
  /** False when there is nothing to search for at all. */
  runnable: boolean;
};

export type SearchDictionary = {
  users: readonly { id: string; name: string }[];
  channels: readonly { id: string; name: string }[];
};

const HAS_VALUES: readonly string[] = ["link", "image", "file"];
const KEYS: readonly string[] = ["from", "in", "has", "before", "after"];

/** Minimum free text the database accepts when no filter narrows the search. */
export const MIN_TEXT = 2;

/**
 * The longest dictionary name matching at `index`, or null.
 *
 * Longest first, and the match has to end on a word boundary — the same rule
 * `encodeMentions` follows, and for the same reason: `from:Ada` must not claim
 * a member called `Adam`, and `from:Ada Lovelace` must not be cut short by a
 * member called `Ada`.
 */
function matchName(
  source: string,
  index: number,
  entries: readonly { id: string; name: string }[],
): { id: string; length: number } | null {
  let best: { id: string; length: number } | null = null;
  const lowered = source.toLowerCase();
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    if (name === "") continue;
    if (!lowered.startsWith(name, index)) continue;
    const after = source[index + name.length];
    if (after !== undefined && /[\w-]/.test(after) && /[\w-]/.test(name[name.length - 1])) continue;
    if (!best || name.length > best.length) best = { id: entry.id, length: entry.name.length };
  }
  return best;
}

/** `2026-09-01` as the start of that day where the reader is, or null. */
function parseDay(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Local midnight, not UTC: somebody searching `before:2026-09-01` means the
  // first of September where they are, and a UTC boundary silently moves the
  // cut by a day for most of the world.
  const at = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) return null;
  return at.toISOString();
}

function applyFilter(
  key: string,
  value: string,
  filters: SearchFilters,
  problems: string[],
  dictionary: SearchDictionary,
) {
  const clean = value.trim();
  if (clean === "") {
    problems.push(`${key}: needs a value.`);
    return;
  }

  if (key === "from") {
    const found = dictionary.users.find((user) => user.name.toLowerCase() === clean.toLowerCase());
    if (found) filters.authorId = found.id;
    else problems.push(`No member called “${clean}”.`);
    return;
  }

  if (key === "in") {
    const name = clean.replace(/^#/, "");
    const found = dictionary.channels.find((channel) => channel.name.toLowerCase() === name.toLowerCase());
    if (found) filters.channelId = found.id;
    else problems.push(`No channel called “${name}”.`);
    return;
  }

  if (key === "has") {
    const wanted = clean.toLowerCase();
    if (HAS_VALUES.includes(wanted)) filters.has = wanted as HasFilter;
    else problems.push("has: takes link, image or file.");
    return;
  }

  const day = parseDay(clean);
  if (!day) {
    problems.push(`${key}: needs a date like 2026-09-01.`);
    return;
  }
  if (key === "before") filters.before = day;
  else filters.after = day;
}

export function parseSearchQuery(raw: string, dictionary: SearchDictionary): ParsedSearch {
  const filters: SearchFilters = {
    text: "",
    channelId: null,
    authorId: null,
    has: null,
    before: null,
    after: null,
  };
  const problems: string[] = [];
  const words: string[] = [];

  const source = raw ?? "";
  const lowered = source.toLowerCase();
  let i = 0;

  while (i < source.length) {
    if (/\s/.test(source[i])) {
      i += 1;
      continue;
    }

    const key = KEYS.find((candidate) => lowered.startsWith(`${candidate}:`, i));
    if (!key) {
      // Anything else — including an unknown `foo:bar` — is text. Swallowing it
      // would make any message containing a colon unsearchable.
      const end = source.indexOf(" ", i);
      const word = source.slice(i, end === -1 ? undefined : end);
      words.push(word);
      i += word.length;
      continue;
    }

    const at = i + key.length + 1;

    // A quoted value ends at its closing quote; an unquoted one is resolved
    // against the dictionary first, so a two-word name survives unquoted.
    if (source[at] === '"') {
      const close = source.indexOf('"', at + 1);
      applyFilter(key, source.slice(at + 1, close === -1 ? undefined : close), filters, problems, dictionary);
      i = close === -1 ? source.length : close + 1;
      continue;
    }

    const entries = key === "from" ? dictionary.users : key === "in" ? dictionary.channels : null;
    if (entries) {
      const hash = source[at] === "#" ? 1 : 0;
      const matched = matchName(source, at + hash, entries);
      if (matched) {
        if (key === "from") filters.authorId = matched.id;
        else filters.channelId = matched.id;
        i = at + hash + matched.length;
        continue;
      }
    }

    const end = source.indexOf(" ", at);
    applyFilter(key, source.slice(at, end === -1 ? undefined : end), filters, problems, dictionary);
    i = end === -1 ? source.length : end;
  }

  filters.text = words.join(" ").trim();

  const narrowed =
    filters.channelId !== null ||
    filters.authorId !== null ||
    filters.has !== null ||
    filters.before !== null ||
    filters.after !== null;

  if (filters.text === "" && !narrowed) {
    return { filters, problems, runnable: false };
  }
  if (filters.text !== "" && filters.text.length < MIN_TEXT && !narrowed) {
    problems.push(`Search for at least ${MIN_TEXT} characters, or add a filter.`);
  }
  if (filters.before && filters.after && filters.after >= filters.before) {
    problems.push("That date range is empty — after: must come before before:.");
  }

  return { filters, problems, runnable: problems.length === 0 };
}

/**
 * The stored instant back as the calendar day the reader typed.
 *
 * Not `iso.slice(0, 10)`. The instant is local midnight, so its UTC prefix is
 * the *previous* day everywhere east of Greenwich — `after:2026-08-01` came
 * back as "after 2026-07-31", telling somebody their filter was a day off when
 * it was exactly right.
 */
function dayLabel(iso: string): string {
  const at = new Date(iso);
  const month = String(at.getMonth() + 1).padStart(2, "0");
  const day = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${month}-${day}`;
}

const HAS_LABEL: Record<HasFilter, string> = {
  link: "with a link",
  image: "with an image",
  file: "with a file",
};

/** The filters as chips, so a search says out loud what it is actually doing. */
export function describeFilters(filters: SearchFilters, dictionary: SearchDictionary): string[] {
  const chips: string[] = [];
  if (filters.authorId) {
    chips.push(`from ${dictionary.users.find((user) => user.id === filters.authorId)?.name ?? "someone"}`);
  }
  if (filters.channelId) {
    chips.push(`in #${dictionary.channels.find((channel) => channel.id === filters.channelId)?.name ?? "a channel"}`);
  }
  if (filters.has) chips.push(HAS_LABEL[filters.has]);
  if (filters.after) chips.push(`after ${dayLabel(filters.after)}`);
  if (filters.before) chips.push(`before ${dayLabel(filters.before)}`);
  return chips;
}
