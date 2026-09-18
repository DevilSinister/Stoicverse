"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  ChevronRight,
  CircleUserRound,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  logoutAction,
  removeAvatar,
  requestAccountDeletion,
  revokeOtherSessions,
  saveNotificationPreferences,
  updateDisplayName,
  updateEmail,
  updatePassword,
  uploadAvatar,
} from "@/app/dashboard/settings/actions";
import { type SettingsActionState, EMPTY_SETTINGS_ACTION_STATE } from "@/app/dashboard/settings/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Account settings. Monolith, phase 10.
 *
 * **The preference checkboxes were `accent-emerald-500`** — a stock Tailwind
 * colour on the one control in the product whose whole job is to show state.
 * They are `ui/checkbox` now, which takes its checked fill from `--primary`.
 * Worth stating why `value="on"` is passed explicitly: the server action reads
 * `formData.get(name) === "on"`, a native checkbox with no `value` attribute
 * submits exactly that, and Base UI reproduces the default only while no
 * `value` prop is given. Naming it is what makes the two halves legible
 * together rather than dependent on a library's undefined-handling.
 *
 * **`group-hover:text-accent-contrast` on the category icons.** The near-black
 * meant to sit *on* the lime accent, painted over a dark chip on hover — the
 * icon disappeared under the pointer. Seventh sighting of this family, and the
 * second in a hover state specifically.
 *
 * **A design brief was being injected into the DOM.** A hidden `<span>` used
 * `dangerouslySetInnerHTML` to write an HTML comment — "THESIS…", "OWN-WORLD…",
 * "selected shape seed ff507120" — into every render of the page. It described
 * an intention, it was invisible, and it used the one React API that exists to
 * write unescaped markup. Deleted.
 *
 * **The file was written as one element per line, some lines 1,400 characters
 * long.** 96 deprecated-alias call sites were hiding in that, which is most of
 * why this screen was the last member surface still on the old palette.
 *
 * Every form name, action binding and focus behaviour is unchanged: the mobile
 * detail switch, the focus hand-off between the category rail and the editor,
 * the blob-URL revoke on unmount, and the `returnTo` round trip all behave as
 * they did.
 */

export type SettingsSection = "account" | "notifications" | "sessions" | "deletion";

export type SettingsWorkspaceData = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  platformRole: string;
  membershipStatus: string;
  membershipExpiresAt: string | null;
  cosmeticRoles: { id: string; name: string; color: string }[];
  preferences: { eventUpdates: boolean; courseUpdates: boolean; communityMentions: boolean; roleAchievements: boolean };
  currentDevice: string;
  canDelete: boolean;
};

const SECTIONS: { id: SettingsSection; label: string; description: string; icon: typeof UserRound }[] = [
  { id: "account", label: "My account", description: "Identity, email, and password", icon: UserRound },
  { id: "notifications", label: "Notifications", description: "Choose what reaches your inbox", icon: Bell },
  { id: "sessions", label: "Sessions", description: "Review and revoke access", icon: MonitorSmartphone },
  { id: "deletion", label: "Account removal", description: "Request permanent deletion", icon: ShieldAlert },
];

const through = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));

export function AccountSettingsWorkspace({
  data,
  initialSection,
  returnTo,
  /**
   * Where this workspace lives. The creator reaches the same page at
   * `/creator/account`, and hardcoding `/dashboard/settings` here would send
   * them somewhere `proxy.ts` immediately bounces them out of — changing a
   * section would have thrown them back to /creator.
   */
  basePath = "/dashboard/settings",
  /** Where "back" goes when `returnTo` is the default. */
  homePath = "/dashboard",
}: {
  data: SettingsWorkspaceData;
  initialSection: SettingsSection;
  returnTo: string;
  basePath?: string;
  homePath?: string;
}) {
  const router = useRouter();
  const [section, setSection] = useState(initialSection);
  const [mobileDetail, setMobileDetail] = useState(initialSection !== "account");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(data.avatarUrl);
  const categoryButtons = useRef<Partial<Record<SettingsSection, HTMLButtonElement | null>>>({});
  const mobileBackButton = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  useEffect(() => {
    if (!mobileDetail || !window.matchMedia("(max-width: 767px)").matches) return;
    const timer = window.setTimeout(() => mobileBackButton.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [mobileDetail, section]);

  function chooseSection(next: SettingsSection) {
    setSection(next);
    setMobileDetail(true);
    const params = new URLSearchParams({ section: next });
    if (returnTo !== homePath) params.set("returnTo", returnTo);
    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
  }

  function showCategories() {
    setMobileDetail(false);
    window.setTimeout(() => categoryButtons.current[section]?.focus(), 0);
  }

  return (
    <main className="min-h-svh bg-surface-canvas text-text-default md:h-svh md:overflow-hidden">
      <header className="relative z-30 flex h-16 items-center justify-between border-b border-border-hairline bg-surface-panel px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md border border-border-hairline bg-surface-sunken text-primary">
            <CircleUserRound size={18} />
          </div>
          <div>
            <p className="text-content-sm font-medium text-text-strong">Account settings</p>
            <p className="text-chrome-sm text-text-muted">Member control center</p>
          </div>
        </div>
        <Link href={returnTo} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back to dashboard</span>
          <span className="sr-only sm:hidden">Back to dashboard</span>
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-[92rem] md:h-[calc(100svh-4rem)] md:min-h-0 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(30rem,1fr)_20rem]">
        <aside
          className={`${mobileDetail ? "hidden" : "flex"} min-h-[calc(100svh-4rem)] flex-col border-border-hairline bg-surface-panel px-4 py-5 md:flex md:h-full md:min-h-0 md:overflow-y-auto md:border-r md:px-3 lg:py-6`}
        >
          <div className="mb-5 md:hidden">
            <h1 className="text-title-md font-medium text-text-strong">Settings</h1>
            <p className="mt-1 text-content-sm text-text-muted">Choose what you want to review or change.</p>
          </div>

          <div className="mb-5 flex items-center gap-3 rounded-lg border border-border-hairline bg-surface-sunken p-3 md:mx-1">
            <Avatar value={avatarPreview} name={data.fullName} className="size-11 text-content-sm" />
            <div className="min-w-0">
              <p className="truncate text-content-sm font-medium text-text-strong">{data.fullName}</p>
              <p className="mt-0.5 truncate text-chrome-sm text-text-muted">{data.email}</p>
            </div>
          </div>

          <p className="terminal-label mb-2 px-3 text-text-faint">Account categories</p>
          <nav className="space-y-1" aria-label="Account settings categories">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const selected = section === item.id;
              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    categoryButtons.current[item.id] = element;
                  }}
                  type="button"
                  onClick={() => chooseSection(item.id)}
                  aria-current={selected ? "page" : undefined}
                  className={`focus-ring group flex min-h-[4.25rem] w-full items-center gap-3 rounded-lg border px-3 text-left transition-colors ${
                    selected
                      ? "border-border-hairline bg-surface-raised text-text-strong"
                      : "border-transparent text-text-muted hover:bg-surface-raised hover:text-text-strong"
                  }`}
                >
                  {/* `group-hover:text-text-strong`. The colour this used to hover
                      to is the one meant to sit on the accent fill, so under the
                      pointer the icon went near-black on a dark chip. */}
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-md ${
                      selected
                        ? "bg-surface-sunken text-primary"
                        : "bg-surface-sunken text-text-faint group-hover:text-text-strong"
                    }`}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-content-sm font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-chrome-sm text-text-muted md:truncate">{item.description}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-text-faint md:hidden" />
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border-t border-border-hairline px-3 pt-4 md:mt-auto">
            <p className="text-chrome-base text-text-default">{data.membershipStatus}</p>
            {data.membershipExpiresAt && (
              <p className="mt-1 font-mono text-mono-xs text-text-muted tabular-nums">
                Through {through(data.membershipExpiresAt)}
              </p>
            )}
          </div>

          <form action={logoutAction} className="mt-3">
            <Button type="submit" variant="ghost" className="w-full justify-start gap-3">
              <LogOut size={16} />
              Log out
            </Button>
          </form>
        </aside>

        <section
          className={`${mobileDetail ? "block" : "hidden"} min-w-0 px-4 py-5 md:block md:h-full md:overflow-y-auto md:px-8 md:py-8 lg:px-10 lg:py-10`}
        >
          <div className="mx-auto max-w-3xl">
            <button
              ref={mobileBackButton}
              type="button"
              onClick={showCategories}
              className="focus-ring mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-content-sm font-medium text-text-muted md:hidden"
            >
              <ArrowLeft size={16} />
              All settings
            </button>

            {section === "account" && (
              <AccountSection data={data} avatarPreview={avatarPreview} setAvatarPreview={setAvatarPreview} />
            )}
            {section === "notifications" && <NotificationsSection preferences={data.preferences} />}
            {section === "sessions" && <SessionsSection currentDevice={data.currentDevice} />}
            {section === "deletion" && <DeletionSection canDelete={data.canDelete} />}
          </div>
        </section>

        <aside className="hidden h-full overflow-y-auto border-l border-border-hairline bg-surface-panel px-6 py-8 xl:block">
          <p className="terminal-label text-text-faint">Live identity</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-border-hairline bg-surface-sunken">
            <div className="h-20 bg-surface-raised" />
            <div className="px-5 pb-5">
              <Avatar
                value={avatarPreview}
                name={data.fullName}
                className="-mt-10 size-20 border-4 border-surface-sunken text-title-md"
              />
              <h2 className="mt-4 truncate text-title-sm font-medium text-text-strong">{data.fullName}</h2>
              <p className="mt-1 truncate text-content-sm text-text-muted">{data.email}</p>
              <div className="mt-4 border-t border-border-hairline pt-4">
                <p className="text-chrome-base text-text-default">{data.membershipStatus}</p>
                {data.membershipExpiresAt && (
                  <p className="mt-1 font-mono text-mono-xs text-text-muted tabular-nums">
                    Through {through(data.membershipExpiresAt)}
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.cosmeticRoles.map((role) => (
                  // The colour belongs to the row, so it stays inline. Nothing
                  // in the token layer can know what a member named their role.
                  <span
                    key={role.id}
                    className="rounded-md border px-2.5 py-1 font-mono text-mono-xs"
                    style={{ borderColor: role.color, color: role.color, backgroundColor: `${role.color}14` }}
                  >
                    {role.name}
                  </span>
                ))}
                {!data.cosmeticRoles.length && <StatusBadge tone="neutral">Member</StatusBadge>}
              </div>
            </div>
          </div>
          <p className="mt-4 text-content-sm text-text-muted">
            Cosmetic roles express community identity. They never lock courses or determine access.
          </p>
        </aside>
      </div>
    </main>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="border-b border-border-hairline pb-6">
      <h1 className="text-title-lg font-medium text-text-strong">{title}</h1>
      <p className="mt-2 max-w-2xl text-content-base text-text-default">{description}</p>
    </header>
  );
}

function AccountSection({
  data,
  avatarPreview,
  setAvatarPreview,
}: {
  data: SettingsWorkspaceData;
  avatarPreview: string | null;
  setAvatarPreview: (value: string | null) => void;
}) {
  const [nameState, nameAction, namePending] = useActionState(updateDisplayName, EMPTY_SETTINGS_ACTION_STATE);
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, EMPTY_SETTINGS_ACTION_STATE);
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePassword, EMPTY_SETTINGS_ACTION_STATE);
  const [avatarState, avatarAction, avatarPending] = useActionState(uploadAvatar, EMPTY_SETTINGS_ACTION_STATE);
  const [removeState, removeAction, removePending] = useActionState(removeAvatar, EMPTY_SETTINGS_ACTION_STATE);

  return (
    <div>
      <SectionHeader
        title="My account"
        description="Keep the identity attached to your learning record accurate and secure."
      />

      <div className="divide-y divide-border-hairline">
        <section className="grid gap-6 py-7 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <Avatar value={avatarPreview} name={data.fullName} className="size-24 text-title-md" />
          <div>
            <h2 className="text-title-sm font-medium text-text-strong">Profile image</h2>
            <p className="mt-1 text-content-sm text-text-muted">
              JPEG, PNG, or WebP. Maximum 5 MB. Visible in settings only.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form action={avatarAction} className="flex flex-wrap items-center gap-3">
                <label className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}>
                  <Camera size={16} />
                  Choose image
                  <input
                    type="file"
                    name="avatar"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setAvatarPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
                <SubmitButton pending={avatarPending} label="Upload" />
              </form>
              {avatarPreview && (
                <form action={removeAction}>
                  <Button type="submit" variant="destructive" disabled={removePending}>
                    Remove
                  </Button>
                </form>
              )}
            </div>
            <ActionFeedback state={avatarState.ok || avatarState.error ? avatarState : removeState} />
          </div>
        </section>

        <SettingsForm
          title="Display name"
          description="This is the name shown in your member workspace."
          action={nameAction}
          state={nameState}
          pending={namePending}
        >
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              name="displayName"
              defaultValue={data.fullName}
              minLength={2}
              maxLength={50}
              required
            />
          </div>
          <SubmitButton pending={namePending} label="Save display name" />
        </SettingsForm>

        <SettingsForm
          title="Email address"
          description="Supabase will send verification before the new address becomes active."
          action={emailAction}
          state={emailState}
          pending={emailPending}
        >
          <div className="space-y-2">
            <Label htmlFor="account-email">New email</Label>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-text-faint" />
              <Input
                id="account-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={data.email}
                required
                className="pl-10"
              />
            </div>
          </div>
          <SubmitButton pending={emailPending} label="Send verification" />
        </SettingsForm>

        <SettingsForm
          title="Password"
          description="Confirm the current password before replacing it."
          action={passwordAction}
          state={passwordState}
          pending={passwordPending}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>
          <SubmitButton pending={passwordPending} label="Update password" icon={KeyRound} />
        </SettingsForm>
      </div>
    </div>
  );
}

function NotificationsSection({ preferences }: { preferences: SettingsWorkspaceData["preferences"] }) {
  const [state, action, pending] = useActionState(saveNotificationPreferences, EMPTY_SETTINGS_ACTION_STATE);

  const options = [
    {
      name: "eventUpdates",
      title: "Events",
      description: "New sessions, changes, room links, and cancellations.",
      checked: preferences.eventUpdates,
    },
    {
      name: "courseUpdates",
      title: "Courses",
      description: "New courses and released learning material.",
      checked: preferences.courseUpdates,
    },
    {
      name: "communityMentions",
      title: "Community mentions",
      description: "Messages that call your attention in community channels.",
      checked: preferences.communityMentions,
    },
    {
      name: "roleAchievements",
      title: "Roles and achievements",
      description: "Cosmetic role assignments and learning milestones.",
      checked: preferences.roleAchievements,
    },
  ];

  return (
    <div>
      <SectionHeader
        title="Notifications"
        description="Tune the member inbox without muting essential account communication."
      />

      <form action={action} className="py-3">
        <div className="divide-y divide-border-hairline">
          {options.map((option) => (
            <Label key={option.name} htmlFor={option.name} className="flex cursor-pointer items-start gap-4 py-5">
              {/* The name comes from this `<Label htmlFor>`: Base UI points the
                  control's `aria-labelledby` at `<id>-label` and stamps that id
                  onto the label it finds. Adding an element of my own with that
                  id put two of them in the document, which is how this was
                  first written and why it is called out here. */}
              <span className="min-w-0 flex-1">
                <span className="block text-content-sm font-medium text-text-strong">{option.title}</span>
                <span className="mt-1 block text-content-sm font-normal text-text-muted">{option.description}</span>
              </span>
              {/* `value="on"` states the contract the action reads:
                  `formData.get(name) === "on"`. */}
              <Checkbox
                id={option.name}
                name={option.name}
                value="on"
                defaultChecked={option.checked}
                className="mt-1 size-5"
              />
            </Label>
          ))}

          <div className="flex items-start gap-4 py-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border-hairline text-primary">
              <LockKeyhole size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-content-sm font-medium text-text-strong">Account, security, and payments</span>
              <span className="mt-1 block text-content-sm text-text-muted">
                Always enabled so important changes and receipts cannot be missed.
              </span>
            </span>
            <StatusBadge tone="accent" className="ml-auto">
              <Check size={12} />
              On
            </StatusBadge>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <SubmitButton pending={pending} label="Save preferences" />
          <ActionFeedback state={state} />
        </div>
      </form>
    </div>
  );
}

function SessionsSection({ currentDevice }: { currentDevice: string }) {
  const [state, action, pending] = useActionState(revokeOtherSessions, EMPTY_SETTINGS_ACTION_STATE);

  return (
    <div>
      <SectionHeader
        title="Sessions"
        description="Keep this device signed in while closing every other Stoicverse session."
      />

      <section className="py-7">
        <div className="flex items-start gap-4 rounded-lg border border-border-hairline bg-surface-panel p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-sunken text-primary">
            <Laptop size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-content-sm font-medium text-text-strong">This device</h2>
              <StatusBadge tone="accent">Current</StatusBadge>
            </div>
            <p className="mt-1 truncate text-content-sm text-text-default">{currentDevice}</p>
            <p className="mt-1 text-chrome-sm text-text-muted">Active now</p>
          </div>
        </div>

        <form action={action} className="mt-6">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Sign out all other sessions
          </Button>
          <ActionFeedback state={state} />
          <p className="mt-4 max-w-2xl text-content-sm text-text-muted">
            Supabase can revoke other sessions, but it does not expose a trustworthy device-by-device session list to
            this member screen.
          </p>
        </form>
      </section>
    </div>
  );
}

function DeletionSection({ canDelete }: { canDelete: boolean }) {
  const [state, action, pending] = useActionState(requestAccountDeletion, EMPTY_SETTINGS_ACTION_STATE);

  return (
    <div>
      <SectionHeader title="Account removal" description="Request permanent deletion with a 30-day recovery window." />

      <section className="py-7">
        <div className="flex items-start gap-3 rounded-lg border border-status-danger/40 bg-status-danger/10 p-5">
          <Trash2 size={19} className="mt-0.5 shrink-0 text-status-danger" />
          <div>
            <h2 className="text-title-sm font-medium text-text-strong">What deletion changes</h2>
            <ul className="mt-3 space-y-2 text-content-sm text-text-default">
              <li>Dashboard access locks immediately and all sessions are signed out.</li>
              <li>You can sign back in and cancel while the request is pending.</li>
              <li>After 30 days, your profile and learning data are removed.</li>
              <li>
                Community posts remain under &ldquo;Deleted member&rdquo;; payment records remain without a profile
                link.
              </li>
            </ul>
          </div>
        </div>

        {canDelete ? (
          <form action={action} className="mt-7 max-w-xl space-y-5">
            <div className="space-y-2">
              <Label htmlFor="deletion-password">Current password</Label>
              <Input
                id="deletion-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-confirmation">Type DELETE to confirm</Label>
              <Input id="deletion-confirmation" name="confirmation" autoComplete="off" required pattern="DELETE" />
            </div>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Request account deletion
            </Button>
            <ActionFeedback state={state} />
          </form>
        ) : (
          <p className="mt-6 rounded-lg border border-border-hairline px-4 py-3 text-content-sm text-text-default">
            Staff and creator accounts own operational records and must be removed by an administrator.
          </p>
        )}
      </section>
    </div>
  );
}

function SettingsForm({
  title,
  description,
  action,
  state,
  pending,
  children,
}: {
  title: string;
  description: string;
  action: (formData: FormData) => void;
  state: SettingsActionState;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="py-7">
      <div className="mb-5">
        <h2 className="text-title-sm font-medium text-text-strong">{title}</h2>
        <p className="mt-1 text-content-sm text-text-muted">{description}</p>
      </div>
      <form action={action} className="max-w-xl space-y-4">
        {children}
        <ActionFeedback state={state} />
        {pending && (
          <span className="sr-only" aria-live="polite">
            Saving
          </span>
        )}
      </form>
    </section>
  );
}

function SubmitButton({ pending, label, icon: Icon }: { pending: boolean; label: string; icon?: typeof KeyRound }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {label}
    </Button>
  );
}

function ActionFeedback({ state }: { state: SettingsActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={`mt-3 text-content-sm ${state.error ? "text-status-danger" : "text-primary"}`}
    >
      {state.error || state.message}
    </p>
  );
}

function Avatar({ value, name, className }: { value: string | null; name: string; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-border-hairline bg-surface-raised font-medium text-primary ${className ?? ""}`}
    >
      {value ? (
        <>
          {/* Signed private URLs and local blob previews intentionally bypass the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-full object-cover" />
        </>
      ) : (
        name[0]?.toUpperCase() || <UserRound size={20} />
      )}
    </span>
  );
}
