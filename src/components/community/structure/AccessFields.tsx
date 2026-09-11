"use client";

import { tierName } from "@/components/community/channel-meta";

const TIERS = [1, 2, 3, 4, 5];
const ROLES = ["member", "moderator", "influencer"] as const;

/** Tier floor, below-tier visibility and role allow-list, shared by categories and channels. */
export function AccessFields({ rule }: { rule?: { minTier: number; allowedRoles: string[]; visibilityMode: string } }) {
  const value = rule ?? { minTier: 1, allowedRoles: ["member", "moderator", "influencer"], visibilityMode: "locked" };

  return (
    <fieldset className="space-y-4 rounded-lg border border-surgical-steel p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Access</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="structure-min-tier" className="block text-sm text-on-surface-variant">
            Minimum tier
          </label>
          <select
            id="structure-min-tier"
            name="minTier"
            defaultValue={value.minTier}
            className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none"
          >
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tierName(tier)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="structure-visibility" className="block text-sm text-on-surface-variant">
            Below that tier
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
        </div>
      </div>

      <div>
        <span className="block text-sm text-on-surface-variant">Roles that may open it</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <label
              key={role}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-surgical-steel px-3 text-sm capitalize text-on-surface-variant transition hover:border-fog-muted has-[:checked]:border-primary-container has-[:checked]:text-primary-container has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container"
            >
              <input
                type="checkbox"
                name="allowedRoles"
                value={role}
                defaultChecked={value.allowedRoles.includes(role)}
                className="size-4 accent-[#10B981]"
              />
              {role}
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
