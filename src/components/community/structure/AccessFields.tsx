"use client";

/**
 * What a channel looks like to somebody who cannot open it.
 *
 * This fieldset used to carry "Minimum tier" and "Roles that may open it" as
 * well. Phase 3 moved access onto per-channel role and member overrides, and
 * from that point those two controls wrote columns nothing read — a creator
 * setting a channel to Tier 3 was changing a field with no enforcement behind
 * it, and the channel stayed open to everyone. Phase 9 dropped the columns and
 * the controls together.
 *
 * `visibility_mode` stays, and is not the same kind of setting: it decides
 * whether a channel somebody cannot open is listed as locked or not listed at
 * all. Who may open it is the overrides grid, one tab across.
 */
export function AccessFields({ rule }: { rule?: { visibilityMode: string } }) {
  const value = rule ?? { visibilityMode: "locked" };

  return (
    <fieldset className="space-y-4 rounded-lg border border-surgical-steel p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Visibility</legend>

      <div>
        <label htmlFor="structure-visibility" className="block text-sm text-on-surface-variant">
          To someone who cannot open it
        </label>
        <select
          id="structure-visibility"
          name="visibilityMode"
          defaultValue={value.visibilityMode}
          className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none"
        >
          <option value="locked">Show it locked</option>
          <option value="hidden">Hide it entirely</option>
        </select>
        <p className="mt-2 text-xs text-fog-muted">
          Who may open it is set per role and per member in Permissions.
        </p>
      </div>
    </fieldset>
  );
}
