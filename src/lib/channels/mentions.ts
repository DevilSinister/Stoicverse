/**
 * Turning what a person typed into what the database stores, and back.
 *
 * A mention is stored as `<@uuid>`, never as a name: renaming a member, role
 * or channel must not break a message written last month. But nobody types a
 * uuid, and nobody wants to read one — so the composer works in display form
 * and converts at the boundary.
 *
 * Zero imports, so the unit test loads this directly.
 */

const UUID_SOURCE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export type MentionTarget = { id: string; name: string };

export type MentionDictionary = {
  users: MentionTarget[];
  roles: MentionTarget[];
  channels: MentionTarget[];
};

const EMPTY: MentionDictionary = { users: [], roles: [], channels: [] };

/**
 * Display form to storage form.
 *
 * Longest names first, so `@Ada Lovelace` is not eaten by a member called
 * `@Ada`. Names are matched case-insensitively because that is how people
 * type them, and the match has to end on a non-word character so `@Ada` does
 * not match inside `@Adam`.
 */
export function encodeMentions(body: string, dictionary: MentionDictionary = EMPTY): string {
  let text = body ?? "";

  const replaceAll = (targets: MentionTarget[], prefix: string, wrap: (id: string) => string) => {
    const ordered = [...targets].sort((a, b) => b.name.length - a.name.length);
    for (const target of ordered) {
      if (!target.name) continue;
      const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`${prefix}${escaped}(?![0-9A-Za-z_-])`, "gi");
      text = text.replace(pattern, wrap(target.id));
    }
  };

  replaceAll(dictionary.users, "@", (id) => `<@${id}>`);
  replaceAll(dictionary.roles, "@", (id) => `<@&${id}>`);
  replaceAll(dictionary.channels, "#", (id) => `<#${id}>`);

  return text;
}

/**
 * Storage form back to display form, for the edit box.
 *
 * A token whose target no longer exists becomes a readable placeholder rather
 * than a raw uuid: the member deleted their account, the role was removed, and
 * the person editing should see that rather than a string of hex.
 */
export function decodeMentions(body: string, dictionary: MentionDictionary = EMPTY): string {
  const byId = (targets: MentionTarget[]) => new Map(targets.map((target) => [target.id, target.name]));
  const users = byId(dictionary.users);
  const roles = byId(dictionary.roles);
  const channels = byId(dictionary.channels);

  return (body ?? "")
    .replace(new RegExp(`<@&(${UUID_SOURCE})>`, "g"), (_, id: string) => `@${roles.get(id) ?? "deleted-role"}`)
    .replace(new RegExp(`<@(${UUID_SOURCE})>`, "g"), (_, id: string) => `@${users.get(id) ?? "unknown-member"}`)
    .replace(new RegExp(`<#(${UUID_SOURCE})>`, "g"), (_, id: string) => `#${channels.get(id) ?? "deleted-channel"}`);
}

/**
 * What the autocomplete popover should offer for the token under the caret.
 *
 * Returns null when the caret is not in a mention, which is most of the time —
 * the composer calls this on every keystroke.
 */
export function activeMentionQuery(
  body: string,
  caret: number,
): { trigger: "@" | "#" | ":"; query: string; start: number } | null {
  const upTo = (body ?? "").slice(0, caret);
  const match = /(^|[\s(])([@#:])([0-9A-Za-z_-]{0,32})$/.exec(upTo);
  if (!match) return null;
  return {
    trigger: match[2] as "@" | "#" | ":",
    query: match[3],
    start: caret - match[3].length - 1,
  };
}
