/**
 * Who is here, and who is typing.
 *
 * Both are ephemeral: presence and typing live in the realtime channel and
 * never touch the database. Writing "is typing" to a table would be a write
 * per keystroke per member, for a value that expires in six seconds.
 *
 * Zero imports, so the unit test loads this directly.
 */

/** A typing notice is worth nothing after this, so it is dropped rather than shown stale. */
export const TYPING_TTL_MS = 6000;

export type TypingEntry = { userId: string; channelId: string; name: string; at: number };

export type MemberLike = {
  id: string;
  fullName: string;
  topRoleId: string | null;
  topRoleName: string | null;
  topRoleColor: string | null;
  hoisted: boolean;
};

export type MemberSection = {
  key: string;
  label: string;
  color: string | null;
  members: MemberLike[];
};

/**
 * The user ids in a Supabase presence state.
 *
 * The state is keyed by presence key with an array of metas per key, because
 * one person can be in two tabs. Flattening to a set is the only shape a
 * member list wants: two tabs is still one person online.
 */
export function onlineIdsFrom(state: Record<string, readonly { userId?: string }[]>): Set<string> {
  const ids = new Set<string>();
  for (const metas of Object.values(state ?? {})) {
    for (const meta of metas ?? []) {
      if (meta?.userId) ids.add(meta.userId);
    }
  }
  return ids;
}

/**
 * Members grouped the way a member list reads: each hoisted role that has
 * somebody online, then everyone else online, then offline.
 *
 * A hoisted role is one the creator chose to show separately, and it only
 * earns a heading when somebody holding it is actually here — a column of
 * empty role headings is worse than no headings at all.
 *
 * Offline members are listed once, at the bottom, whatever roles they hold.
 * Repeating the whole community under every role heading is noise.
 */
export function groupMembers(members: readonly MemberLike[], onlineIds: ReadonlySet<string>): MemberSection[] {
  const byName = (a: MemberLike, b: MemberLike) =>
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });

  const online = members.filter((member) => onlineIds.has(member.id));
  const offline = members.filter((member) => !onlineIds.has(member.id));

  const sections: MemberSection[] = [];
  const claimed = new Set<string>();

  // Role order is the order the directory returned, which is role position —
  // the creator's own arrangement.
  for (const member of online) {
    if (!member.hoisted || !member.topRoleId || claimed.has(member.topRoleId)) continue;
    claimed.add(member.topRoleId);
    sections.push({
      key: member.topRoleId,
      label: member.topRoleName ?? "Role",
      color: member.topRoleColor,
      members: online
        .filter((candidate) => candidate.hoisted && candidate.topRoleId === member.topRoleId)
        .sort(byName),
    });
  }

  const rest = online.filter((member) => !member.hoisted || !member.topRoleId).sort(byName);
  if (rest.length > 0) sections.push({ key: "online", label: "Online", color: null, members: rest });
  if (offline.length > 0) {
    sections.push({ key: "offline", label: "Offline", color: null, members: offline.sort(byName) });
  }

  return sections;
}

/**
 * Typing entries that have not expired, oldest first, never including yourself.
 *
 * Seeing your own name in "… is typing" is both useless and unsettling.
 */
export function activeTypists(
  entries: readonly TypingEntry[],
  now: number,
  viewerId: string | null,
): TypingEntry[] {
  const seen = new Map<string, TypingEntry>();
  for (const entry of entries) {
    if (now - entry.at >= TYPING_TTL_MS) continue;
    if (viewerId !== null && entry.userId === viewerId) continue;
    // A later keystroke from the same person replaces the earlier one.
    const existing = seen.get(entry.userId);
    if (!existing || entry.at > existing.at) seen.set(entry.userId, entry);
  }
  return [...seen.values()].sort((a, b) => a.at - b.at);
}

/**
 * The sentence under the composer.
 *
 * Four or more names is longer than the message anybody is typing, so past
 * three it stops naming people.
 */
export function typingSentence(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing…`;
  return "Several people are typing…";
}
