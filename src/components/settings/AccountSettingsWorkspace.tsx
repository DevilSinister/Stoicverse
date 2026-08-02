"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, Camera, Check, ChevronRight, CircleUserRound, KeyRound, Laptop, LoaderCircle, LockKeyhole, LogOut, Mail, MonitorSmartphone, ShieldAlert, ShieldCheck, Trash2, UserRound, X } from "lucide-react";

import {
  EMPTY_SETTINGS_ACTION_STATE,
  logoutAction,
  removeAvatar,
  requestAccountDeletion,
  revokeOtherSessions,
  saveNotificationPreferences,
  updateDisplayName,
  updateEmail,
  updatePassword,
  uploadAvatar,
  type SettingsActionState,
} from "@/app/dashboard/settings/actions";

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

const sections: { id: SettingsSection; label: string; description: string; icon: typeof UserRound }[] = [
  { id: "account", label: "My Account", description: "Identity, email, and password", icon: UserRound },
  { id: "notifications", label: "Notifications", description: "Choose what reaches your inbox", icon: Bell },
  { id: "sessions", label: "Sessions", description: "Review and revoke access", icon: MonitorSmartphone },
  { id: "deletion", label: "Account Removal", description: "Request permanent deletion", icon: ShieldAlert },
];

const inputClass = "focus-ring mt-2 min-h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3.5 text-base text-on-surface placeholder:text-fog-muted";
const primaryButton = "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-surgical-steel px-5 text-sm font-semibold text-on-surface transition hover:border-primary-container hover:text-primary-container disabled:cursor-not-allowed disabled:opacity-50";

export function AccountSettingsWorkspace({ data, initialSection, returnTo }: { data: SettingsWorkspaceData; initialSection: SettingsSection; returnTo: string }) {
  const router = useRouter();
  const [section, setSection] = useState(initialSection);
  const [mobileDetail, setMobileDetail] = useState(initialSection !== "account");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(data.avatarUrl);
  const categoryButtons = useRef<Partial<Record<SettingsSection, HTMLButtonElement | null>>>({});
  const mobileBackButton = useRef<HTMLButtonElement>(null);

  useEffect(() => () => { if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);
  useEffect(() => {
    if (!mobileDetail || !window.matchMedia("(max-width: 767px)").matches) return;
    const timer = window.setTimeout(() => mobileBackButton.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [mobileDetail, section]);

  function chooseSection(next: SettingsSection) {
    setSection(next);
    setMobileDetail(true);
    const params = new URLSearchParams({ section: next });
    if (returnTo !== "/dashboard") params.set("returnTo", returnTo);
    router.replace(`/dashboard/settings?${params.toString()}`, { scroll: false });
  }

  function showCategories() {
    setMobileDetail(false);
    window.setTimeout(() => categoryButtons.current[section]?.focus(), 0);
  }

  return (
    <main className="min-h-svh bg-surface text-on-surface">
      <span aria-hidden="true" className="hidden" dangerouslySetInnerHTML={{ __html: "<!-- THESIS: Account settings are an identity command center, not a stack of modal forms. OWN-WORLD: deep navy regions, emerald action, and surgical hairlines. STORY: choose a category, make one precise change, verify identity at a glance. FIRST VIEWPORT: category rail, focused editor, live member preview, with close control above. FORM: dedicated three-column settings workspace; selected shape seed ff507120. -->" }} />
      <header className="flex h-16 items-center justify-between border-b border-surgical-steel bg-surface-container-low px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full border border-primary-container/40 bg-primary-container/10 text-primary-container"><CircleUserRound size={18}/></div><div><p className="text-sm font-semibold text-white">Account settings</p><p className="text-xs text-fog-muted">Member control center</p></div></div>
        <Link href={returnTo} aria-label="Close account settings" className="focus-ring grid size-10 place-items-center rounded-full border border-surgical-steel text-on-surface-variant transition hover:border-primary-container hover:text-primary-container"><X size={18}/></Link>
      </header>

      <div className="mx-auto grid w-full max-w-[92rem] md:min-h-[calc(100svh-4rem)] md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(30rem,1fr)_19rem]">
        <aside className={`${mobileDetail ? "hidden" : "block"} border-r-0 border-surgical-steel bg-surface-container-low px-4 py-6 md:block md:border-r md:px-3 lg:py-8`}>
          <p className="mb-3 px-3 text-xs font-semibold text-fog-muted">Account categories</p>
          <nav className="space-y-1" aria-label="Account settings categories">
            {sections.map((item) => { const Icon = item.icon; const selected = section === item.id; return <button ref={(element) => { categoryButtons.current[item.id] = element; }} key={item.id} type="button" onClick={() => chooseSection(item.id)} className={`focus-ring flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left transition ${selected ? "bg-surface-container-high text-white" : "text-on-surface-variant hover:bg-surface-container-high/70 hover:text-white"}`}><Icon size={17} className={selected ? "text-primary-container" : "text-fog-muted"}/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block truncate text-xs text-fog-muted">{item.description}</span></span><ChevronRight size={15} className="md:hidden"/></button>; })}
          </nav>
          <form action={logoutAction} className="mt-8 border-t border-surgical-steel pt-4"><button type="submit" className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high hover:text-white"><LogOut size={17}/>Log out</button></form>
        </aside>

        <section className={`${mobileDetail ? "block" : "hidden"} min-w-0 px-4 py-6 md:block md:px-8 lg:px-10 lg:py-10`}>
          <button ref={mobileBackButton} type="button" onClick={showCategories} className="focus-ring mb-5 inline-flex min-h-10 items-center gap-2 rounded-full pr-3 text-sm font-semibold text-on-surface-variant md:hidden"><ArrowLeft size={17}/>All settings</button>
          {section === "account" && <AccountSection data={data} avatarPreview={avatarPreview} setAvatarPreview={setAvatarPreview}/>} 
          {section === "notifications" && <NotificationsSection preferences={data.preferences}/>} 
          {section === "sessions" && <SessionsSection currentDevice={data.currentDevice}/>} 
          {section === "deletion" && <DeletionSection canDelete={data.canDelete}/>} 
        </section>

        <aside className="hidden border-l border-surgical-steel bg-surface-container-low px-6 py-10 xl:block">
          <div className="sticky top-10">
            <p className="text-xs font-semibold text-fog-muted">Live identity</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-surgical-steel bg-monolith-surface">
              <div className="h-20 bg-surface-container-high"/>
              <div className="px-5 pb-5">
                <Avatar value={avatarPreview} name={data.fullName} className="-mt-10 size-20 border-4 border-monolith-surface text-2xl"/>
                <h2 className="mt-4 truncate text-lg font-semibold text-white">{data.fullName}</h2>
                <p className="mt-1 truncate text-sm text-fog-muted">{data.email}</p>
                <div className="mt-4 border-t border-surgical-steel pt-4"><p className="text-xs font-semibold text-on-surface">{data.membershipStatus}</p>{data.membershipExpiresAt && <p className="mt-1 text-xs text-fog-muted">Through {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(data.membershipExpiresAt))}</p>}</div>
                <div className="mt-4 flex flex-wrap gap-2">{data.cosmeticRoles.map((role) => <span key={role.id} className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: role.color, color: role.color, backgroundColor: `${role.color}14` }}>{role.name}</span>)}{!data.cosmeticRoles.length && <span className="rounded-full border border-surgical-steel px-2.5 py-1 text-[11px] text-fog-muted">Member</span>}</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-fog-muted">Cosmetic roles express community identity. They never lock courses or determine access.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <header className="border-b border-surgical-steel pb-6"><h1 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">{description}</p></header>;
}

function AccountSection({ data, avatarPreview, setAvatarPreview }: { data: SettingsWorkspaceData; avatarPreview: string | null; setAvatarPreview: (value: string | null) => void }) {
  const [nameState, nameAction, namePending] = useActionState(updateDisplayName, EMPTY_SETTINGS_ACTION_STATE);
  const [emailState, emailAction, emailPending] = useActionState(updateEmail, EMPTY_SETTINGS_ACTION_STATE);
  const [passwordState, passwordAction, passwordPending] = useActionState(updatePassword, EMPTY_SETTINGS_ACTION_STATE);
  const [avatarState, avatarAction, avatarPending] = useActionState(uploadAvatar, EMPTY_SETTINGS_ACTION_STATE);
  const [removeState, removeAction, removePending] = useActionState(removeAvatar, EMPTY_SETTINGS_ACTION_STATE);
  return <div><SectionHeader title="My Account" description="Keep the identity attached to your learning record accurate and secure."/><div className="divide-y divide-surgical-steel">
    <section className="grid gap-6 py-7 sm:grid-cols-[8rem_minmax(0,1fr)]"><div><Avatar value={avatarPreview} name={data.fullName} className="size-24 text-2xl"/></div><div><h2 className="text-base font-semibold text-white">Profile image</h2><p className="mt-1 text-sm leading-6 text-fog-muted">JPEG, PNG, or WebP. Maximum 5 MB. Visible in settings only.</p><div className="mt-4 flex flex-wrap items-center gap-3"><form action={avatarAction} className="flex flex-wrap items-center gap-3"><label className={`${secondaryButton} cursor-pointer`}><Camera size={16}/>Choose image<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAvatarPreview(URL.createObjectURL(file)); }}/></label><SubmitButton pending={avatarPending} label="Upload"/></form>{avatarPreview && <form action={removeAction}><button type="submit" disabled={removePending} className="focus-ring min-h-11 rounded-full px-3 text-sm font-semibold text-error transition hover:bg-error/10 disabled:opacity-50">Remove</button></form>}</div><ActionFeedback state={avatarState.ok || avatarState.error ? avatarState : removeState}/></div></section>
    <SettingsForm title="Display name" description="This is the name shown in your member workspace." action={nameAction} state={nameState} pending={namePending}><label className="text-sm font-semibold text-on-surface" htmlFor="display-name">Display name</label><input id="display-name" name="displayName" defaultValue={data.fullName} minLength={2} maxLength={50} required className={inputClass}/><SubmitButton pending={namePending} label="Save display name"/></SettingsForm>
    <SettingsForm title="Email address" description="Supabase will send verification before the new address becomes active." action={emailAction} state={emailState} pending={emailPending}><label className="text-sm font-semibold text-on-surface" htmlFor="account-email">New email</label><div className="relative"><Mail size={16} className="absolute left-3.5 top-[1.25rem] text-fog-muted"/><input id="account-email" name="email" type="email" autoComplete="email" placeholder={data.email} required className={`${inputClass} pl-10`}/></div><SubmitButton pending={emailPending} label="Send verification"/></SettingsForm>
    <SettingsForm title="Password" description="Confirm the current password before replacing it." action={passwordAction} state={passwordState} pending={passwordPending}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-on-surface sm:col-span-2">Current password<input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass}/></label><label className="text-sm font-semibold text-on-surface">New password<input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass}/></label><label className="text-sm font-semibold text-on-surface">Confirm new password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required className={inputClass}/></label></div><SubmitButton pending={passwordPending} label="Update password" icon={KeyRound}/></SettingsForm>
  </div></div>;
}

function NotificationsSection({ preferences }: { preferences: SettingsWorkspaceData["preferences"] }) {
  const [state, action, pending] = useActionState(saveNotificationPreferences, EMPTY_SETTINGS_ACTION_STATE);
  const options = [
    { name: "eventUpdates", title: "Events", description: "New sessions, changes, room links, and cancellations.", checked: preferences.eventUpdates },
    { name: "courseUpdates", title: "Courses", description: "New courses and released learning material.", checked: preferences.courseUpdates },
    { name: "communityMentions", title: "Community mentions", description: "Messages that call your attention in community channels.", checked: preferences.communityMentions },
    { name: "roleAchievements", title: "Roles and achievements", description: "Cosmetic role assignments and learning milestones.", checked: preferences.roleAchievements },
  ];
  return <div><SectionHeader title="Notifications" description="Tune the member inbox without muting essential account communication."/><form action={action} className="py-3"><div className="divide-y divide-surgical-steel">{options.map((option) => <label key={option.name} className="flex cursor-pointer items-start gap-4 py-5"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{option.title}</span><span className="mt-1 block text-sm leading-6 text-fog-muted">{option.description}</span></span><input type="checkbox" name={option.name} defaultChecked={option.checked} className="mt-1 size-5 accent-emerald-500"/></label>)}<div className="flex items-start gap-4 py-5"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-surgical-steel text-primary-container"><LockKeyhole size={16}/></span><span><span className="block text-sm font-semibold text-white">Account, security, and payments</span><span className="mt-1 block text-sm leading-6 text-fog-muted">Always enabled so important changes and receipts cannot be missed.</span></span><span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary-container/40 bg-primary-container/10 px-2.5 py-1 text-xs font-semibold text-primary-container"><Check size={13}/>On</span></div></div><div className="mt-6 flex items-center gap-4"><SubmitButton pending={pending} label="Save preferences"/><ActionFeedback state={state}/></div></form></div>;
}

function SessionsSection({ currentDevice }: { currentDevice: string }) {
  const [state, action, pending] = useActionState(revokeOtherSessions, EMPTY_SETTINGS_ACTION_STATE);
  return <div><SectionHeader title="Sessions" description="Keep this device signed in while closing every other Stoicverse session."/><section className="py-7"><div className="flex items-start gap-4 rounded-xl border border-surgical-steel bg-monolith-surface p-5"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-container-high text-primary-container"><Laptop size={19}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-white">This device</h2><span className="rounded-full bg-primary-container/10 px-2 py-0.5 text-[11px] font-semibold text-primary-container">Current</span></div><p className="mt-1 truncate text-sm text-on-surface-variant">{currentDevice}</p><p className="mt-1 text-xs text-fog-muted">Active now</p></div></div><form action={action} className="mt-6"><button type="submit" disabled={pending} className={secondaryButton}>{pending ? <LoaderCircle size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}Sign out all other sessions</button><ActionFeedback state={state}/><p className="mt-4 max-w-2xl text-xs leading-5 text-fog-muted">Supabase can revoke other sessions, but it does not expose a trustworthy device-by-device session list to this member screen.</p></form></section></div>;
}

function DeletionSection({ canDelete }: { canDelete: boolean }) {
  const [state, action, pending] = useActionState(requestAccountDeletion, EMPTY_SETTINGS_ACTION_STATE);
  return <div><SectionHeader title="Account Removal" description="Request permanent deletion with a 30-day recovery window."/><section className="py-7"><div className="border border-error/35 bg-error/10 p-5"><div className="flex items-start gap-3"><Trash2 size={20} className="mt-0.5 shrink-0 text-error"/><div><h2 className="font-semibold text-white">What deletion changes</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-on-surface-variant"><li>Dashboard access locks immediately and all sessions are signed out.</li><li>You can sign back in and cancel while the request is pending.</li><li>After 30 days, your profile and learning data are removed.</li><li>Community posts remain under “Deleted member”; payment records remain without a profile link.</li></ul></div></div></div>{canDelete ? <form action={action} className="mt-7 max-w-xl space-y-5"><label className="block text-sm font-semibold text-on-surface">Current password<input name="currentPassword" type="password" autoComplete="current-password" required className={inputClass}/></label><label className="block text-sm font-semibold text-on-surface">Type DELETE to confirm<input name="confirmation" autoComplete="off" required pattern="DELETE" className={inputClass}/></label><button type="submit" disabled={pending} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-error/50 bg-error/10 px-5 text-sm font-semibold text-error transition hover:bg-error/20 disabled:opacity-50">{pending ? <LoaderCircle size={16} className="animate-spin"/> : <Trash2 size={16}/>}Request account deletion</button><ActionFeedback state={state}/></form> : <div className="mt-6 border border-surgical-steel px-4 py-3 text-sm leading-6 text-on-surface-variant">Staff and creator accounts own operational records and must be removed by an administrator.</div>}</section></div>;
}

function SettingsForm({ title, description, action, state, pending, children }: { title: string; description: string; action: (formData: FormData) => void; state: SettingsActionState; pending: boolean; children: React.ReactNode }) {
  return <section className="py-7"><div className="mb-5"><h2 className="text-base font-semibold text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-fog-muted">{description}</p></div><form action={action} className="max-w-xl space-y-4">{children}<ActionFeedback state={state}/>{pending && <span className="sr-only" aria-live="polite">Saving</span>}</form></section>;
}

function SubmitButton({ pending, label, icon: Icon }: { pending: boolean; label: string; icon?: typeof KeyRound }) {
  return <button type="submit" disabled={pending} className={primaryButton}>{pending ? <LoaderCircle size={16} className="animate-spin"/> : Icon ? <Icon size={16}/> : null}{label}</button>;
}

function ActionFeedback({ state }: { state: SettingsActionState }) {
  if (!state.error && !state.message) return null;
  return <p role={state.error ? "alert" : "status"} className={`mt-3 text-sm ${state.error ? "text-error" : "text-primary-container"}`}>{state.error || state.message}</p>;
}

function Avatar({ value, name, className }: { value: string | null; name: string; className?: string }) {
  return <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-surgical-steel bg-surface-container-high font-semibold text-primary-container ${className ?? ""}`}>{value ? <>
    {/* Signed private URLs and local blob previews intentionally bypass the image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={value} alt="" className="size-full object-cover"/>
  </> : name[0]?.toUpperCase() || <UserRound size={20}/>}</span>;
}
