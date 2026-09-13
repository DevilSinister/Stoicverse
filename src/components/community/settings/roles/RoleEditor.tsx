"use client";

import { Loader2, Lock, ShieldAlert, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import { saveRole, setRoleMembers } from "@/app/creator/settings/actions";
import { RoleColorField, RoleIconField, RolePermissionGrid } from "@/components/community/settings/roles/RoleFields";
import {
  newlyEscalating,
  PERMISSION_CATALOG,
  type PermissionKey,
  type ViewerForGrants,
} from "@/lib/community-settings/permissions";
import { isTierRole, ROLE_LIMITS, type CommunityRole } from "@/lib/community-settings/role-model";
import { createClient } from "@/lib/supabase/client";

type Tab = "display" | "permissions" | "members";

const TABS: { id: Tab; label: string }[] = [
  { id: "display", label: "Display" },
  { id: "permissions", label: "Permissions" },
  { id: "members", label: "Manage Members" },
];

/**
 * One role's editor.
 *
 * Nothing here is optimistic. Every control writes a permission, and an
 * optimistic toggle on `ban_members` would be a lie about a security-relevant
 * write that the database may still refuse on hierarchy grounds.
 */
export function RoleEditor({
  role,
  iconUrl,
  viewer,
  editable,
  canSave,
}: {
  role: CommunityRole;
  iconUrl: string | null;
  viewer: ViewerForGrants;
  /** False for a role at or above the viewer's own, and for every tier role. */
  editable: boolean;
  canSave: boolean;
}) {
  const [tab, setTab] = useState<Tab>("display");
  const isEveryone = role.systemKey === "everyone";
  const isTier = isTierRole(role.systemKey);
  const isModeratorRole = role.systemKey === "moderator";

  return (
    <section className="min-w-0">
      <header className="min-w-0">
        <h2 className="flex items-center gap-2 font-headline text-lg font-bold text-text-strong">
          {role.iconEmoji && <span aria-hidden="true">{role.iconEmoji}</span>}
          <span className="truncate" style={{ color: role.color }}>
            {role.name}
          </span>
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-fog-muted">
          Effective for {role.memberCount} {role.memberCount === 1 ? "member" : "members"}.
        </p>
      </header>

      {(isTier || isModeratorRole) && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-surgical-steel bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant">
          <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-fog-muted" />
          <span>
            {isTier
              ? "This role follows a member's paid tier. It is granted and removed automatically, and nobody can be added to it by hand."
              : "Membership of this role mirrors the platform moderator role. Promote or demote someone in Members; the role follows."}
          </span>
        </p>
      )}

      <div role="tablist" aria-label="Role settings" className="mt-4 flex gap-1 border-b border-surgical-steel">
        {TABS.filter((entry) => entry.id !== "members" || !isEveryone).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`role-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`role-panel-${entry.id}`}
            onClick={() => setTab(entry.id)}
            className={`focus-ring -mb-px min-h-11 rounded-t-lg px-4 text-sm font-semibold transition ${
              tab === entry.id
                ? "border-b-2 border-primary-container text-text-strong"
                : "text-on-surface-variant hover:text-text-strong"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <div role="tabpanel" id="role-panel-members" aria-labelledby="role-tab-members" className="pt-4">
          <MembersTab role={role} editable={editable && !isTier} />
        </div>
      ) : (
        <RoleForm
          key={role.id}
          role={role}
          iconUrl={iconUrl}
          viewer={viewer}
          editable={editable}
          canSave={canSave}
          tab={tab}
        />
      )}
    </section>
  );
}

function RoleForm({
  role,
  iconUrl,
  viewer,
  editable,
  canSave,
  tab,
}: {
  role: CommunityRole;
  iconUrl: string | null;
  viewer: ViewerForGrants;
  editable: boolean;
  canSave: boolean;
  tab: "display" | "permissions";
}) {
  const isEveryone = role.systemKey === "everyone";
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color);
  const [hoist, setHoist] = useState(role.hoist);
  const [mentionable, setMentionable] = useState(role.mentionable);
  const [icon, setIcon] = useState({ emoji: role.iconEmoji, path: role.iconPath, url: iconUrl });
  const [permissions, setPermissions] = useState<PermissionKey[]>(role.permissions);
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const confirmId = useId();

  const dirty =
    name !== role.name ||
    color !== role.color ||
    hoist !== role.hoist ||
    mentionable !== role.mentionable ||
    icon.emoji !== role.iconEmoji ||
    icon.path !== role.iconPath ||
    permissions.join() !== role.permissions.join();

  // Only newly-added escalating grants need the confirmation. Removing one, or
  // saving one that was already in force, should not demand ceremony.
  const escalating = newlyEscalating(role.permissions, permissions);
  const confirmed = escalating.length === 0 || confirmation.trim() === role.name;
  const locked = !editable || !canSave;

  const toggle = (key: PermissionKey, next: boolean) =>
    setPermissions((current) => (next ? [...current, key] : current.filter((held) => held !== key)));

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = await saveRole(data);
      if (result.error) {
        setFeedback({ tone: "error", message: result.error });
        return;
      }
      setConfirmation("");
      setFeedback({
        tone: "success",
        message: `Saved. This applies to ${role.memberCount} ${
          role.memberCount === 1 ? "member" : "members"
        } on their next page load.`,
      });
    });

  return (
    <form action={submit} className="space-y-6 pt-4">
      <input type="hidden" name="roleId" value={role.id} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="iconEmoji" value={icon.emoji ?? ""} />
      <input type="hidden" name="iconPath" value={icon.path ?? ""} />
      {/* Each tab renders only its own controls, so the other tab's values have
          to ride along as hidden fields or one save would wipe them. */}
      {tab === "display" && permissions.map((key) => <input key={key} type="hidden" name="permissions" value={key} />)}
      {tab === "permissions" && <input type="hidden" name="name" value={name} />}
      {tab === "permissions" && hoist && <input type="hidden" name="hoist" value="on" />}
      {tab === "permissions" && mentionable && <input type="hidden" name="mentionable" value="on" />}

      <div role="tabpanel" id={`role-panel-${tab}`} aria-labelledby={`role-tab-${tab}`} className="space-y-6">
        {tab === "display" ? (
          <>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Role name</span>
              <input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={ROLE_LIMITS.name.min}
                maxLength={ROLE_LIMITS.name.max}
                required
                readOnly={isEveryone}
                aria-describedby={isEveryone ? `${confirmId}-everyone` : undefined}
                className="focus-ring mt-2 h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none read-only:opacity-60 sm:text-sm"
              />
              {isEveryone && (
                <span id={`${confirmId}-everyone`} className="mt-1 block text-xs leading-5 text-fog-muted">
                  @everyone is the baseline every member holds. Its name and grouping are fixed.
                </span>
              )}
            </label>

            <RoleColorField value={color} onChange={setColor} disabled={locked} />
            {!isEveryone && (
              <RoleIconField emoji={icon.emoji} path={icon.path} url={icon.url} onChange={setIcon} disabled={locked} />
            )}

            {!isEveryone && (
              <fieldset disabled={locked} className="space-y-2">
                <legend className="sr-only">Display options</legend>
                <ToggleRow
                  name="hoist"
                  checked={hoist}
                  onChange={setHoist}
                  label="Show members separately"
                  detail="Group everyone holding this role under its own heading in the member list."
                />
                <ToggleRow
                  name="mentionable"
                  checked={mentionable}
                  onChange={setMentionable}
                  label="Allow anyone to @mention this role"
                  detail="Without this, only people with Mention any role can notify it."
                />
              </fieldset>
            )}
          </>
        ) : (
          <RolePermissionGrid
            permissions={permissions}
            viewer={viewer}
            onToggle={toggle}
            appliesToEveryone={isEveryone}
            disabled={locked}
          />
        )}
      </div>

      {escalating.length > 0 && (
        <div className="rounded-lg border border-error/40 bg-error/10 p-3">
          <p className="flex items-start gap-2 text-sm leading-6 text-error">
            <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              You are granting {escalating.map((key) => PERMISSION_CATALOG[key].label).join(" and ")} to{" "}
              {role.memberCount} {role.memberCount === 1 ? "member" : "members"}. Type <strong>{role.name}</strong> to
              confirm.
            </span>
          </p>
          <label htmlFor={confirmId} className="sr-only">
            Type the role name to confirm
          </label>
          <input
            id={confirmId}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="focus-ring mt-3 h-11 w-full max-w-xs rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none"
          />
        </div>
      )}

      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`text-sm leading-6 ${feedback.tone === "error" ? "text-error" : "text-primary-container"}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-surgical-steel pt-4">
        <button
          type="submit"
          disabled={locked || !dirty || !confirmed || pending}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
        >
          {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
          Save role
        </button>
        {!editable && (
          <span className="text-xs leading-5 text-fog-muted">
            This role sits at or above your own, so you cannot change it.
          </span>
        )}
      </div>
    </form>
  );
}

function ToggleRow({
  name,
  checked,
  onChange,
  label,
  detail,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-surgical-steel p-3 transition has-[:checked]:border-primary-container has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-strong">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-fog-muted">{detail}</span>
      </span>
    </label>
  );
}

type Candidate = { id: string; full_name: string; avatar_url: string | null };
type MemberRow = { id: string; fullName: string; source: string };

/**
 * Who holds this role, and the search that adds to it.
 *
 * The search runs through the browser Supabase client rather than a Server
 * Action: Next dispatches actions sequentially per client, so a search-as-you-
 * type would queue behind whatever save is in flight. The writes stay actions,
 * batched into one call, for the same reason in reverse.
 */
function MembersTab({ role, editable }: { role: CommunityRole; editable: boolean }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const searchId = useId();
  const latestQuery = useRef(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("community_role_members_page", {
      role_id: role.id,
      after_name: null,
      after_id: null,
      page_size: 51,
    });
    setLoading(false);
    if (error) {
      setNotice({ tone: "error", message: "The members of this role could not be read." });
      return;
    }
    setMembers(
      ((data ?? []) as { id: string; full_name: string; source: string }[]).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        source: row.source,
      })),
    );
  }, [role.id]);

  useEffect(() => {
    // Deferred by a zero timer, the pattern NotificationCenter uses: calling the
    // loader straight from the effect body sets state synchronously during the
    // effect and cascades a second render before the first has painted.
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!editable) return;
    const ticket = ++latestQuery.current;
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("community_role_member_candidates", { query, page_size: 20 });
      // Out-of-order responses would otherwise repaint the list with an older query's results.
      if (ticket !== latestQuery.current) return;
      setCandidates((data ?? []) as Candidate[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, editable]);

  const commit = (changes: { add?: string[]; remove?: string[] }) =>
    startTransition(async () => {
      const result = await setRoleMembers(role.id, changes);
      if (result.error) {
        setNotice({ tone: "error", message: result.error });
        return;
      }
      setNotice({ tone: "success", message: "Membership updated." });
      await refresh();
    });

  const held = new Set(members.map((member) => member.id));

  return (
    <div className="space-y-4">
      {editable && (
        <div>
          <label htmlFor={searchId} className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">
            Add a member
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
            className="focus-ring mt-2 h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none sm:text-sm"
          />
          <ul className="mt-2 space-y-1">
            {candidates
              .filter((candidate) => !held.has(candidate.id))
              .slice(0, 8)
              .map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => commit({ add: [candidate.id] })}
                    className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high/50 disabled:opacity-40"
                  >
                    <UserPlus size={14} aria-hidden="true" className="shrink-0 text-primary-container" />
                    <span className="truncate">{candidate.full_name}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">
          Holding this role ({members.length})
        </h3>
        {loading ? (
          <p className="mt-2 text-sm leading-6 text-fog-muted">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-fog-muted">Nobody holds this role yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-surgical-steel">
            {members.map((member) => (
              <li key={member.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-text-strong">{member.fullName}</span>
                {member.source === "system" ? (
                  <span className="shrink-0 text-xs text-fog-muted">Automatic</span>
                ) : (
                  editable && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => commit({ remove: [member.id] })}
                      className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-error transition hover:bg-error/10 disabled:opacity-40"
                    >
                      <UserMinus size={13} aria-hidden="true" />
                      Remove
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`text-sm leading-6 ${notice.tone === "error" ? "text-error" : "text-primary-container"}`}
        >
          {notice.message}
        </p>
      )}
    </div>
  );
}
