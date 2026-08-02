"use client";

import Link from "next/link";
import { ArrowRight, Check, Crown, Gauge, Image as ImageIcon, Lock, LogIn, MessageSquare, MoreVertical, Play, Plus, Send, Shield, Video } from "lucide-react";
import { AppShell as SharedAppShell } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "outline" }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 font-label-md text-label-md transition focus-ring",
        variant === "primary"
          ? "bg-primary-container text-on-primary-fixed hover:bg-opacity-95 hover:brightness-105 active:scale-[0.98] duration-150 emerald-glow"
          : "border border-surgical-steel text-on-surface hover:border-primary-container hover:text-primary-container"
      )}
    >
      {children}
    </Link>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full border border-surgical-steel text-on-surface-variant transition hover:border-primary-container hover:text-primary-container focus-ring"
    >
      {children}
    </button>
  );
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("border border-surgical-steel bg-monolith-surface rounded-lg overflow-hidden", className)}>
      <div className="flex min-h-11 items-center justify-between border-b border-surgical-steel bg-surface-container-high px-4 py-2">
        <h2 className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-fog-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-surgical-steel bg-monolith-surface p-5 rounded-lg">
      <p className="font-label-sm text-label-sm uppercase tracking-[0.14em] text-fog-muted">{label}</p>
      <p className="mt-3 font-headline-sm text-headline-sm text-primary-container font-semibold">{value}</p>
    </div>
  );
}

function AppShell({ active, title, isMaster = false, memberName, platformRole, currentTier, notifications, routeBase, children }: { active: string; title: string; isMaster?: boolean; memberName?: string; platformRole?: string; currentTier?: number; notifications?: import("@/components/layout/AppShell").Notification[]; routeBase?: string; children: React.ReactNode }) {
  return (
    <SharedAppShell
      active={active}
      title={title}
      isMaster={isMaster}
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      notifications={notifications}
      routeBase={routeBase}
    >
      {children}
    </SharedAppShell>
  );
}

function PricingCard({ title, price, body, featured }: { title: string; price: string; body: string; featured?: boolean }) {
  return (
    <article className={cx("border bg-monolith-surface p-6 md:p-8 rounded-lg", featured ? "border-primary-container" : "border-surgical-steel")}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-label-md text-label-md uppercase tracking-[0.12em] text-fog-muted">{title}</h3>
        {featured && <span className="bg-primary-container px-2 py-0.5 rounded font-label-sm text-label-sm text-on-primary-fixed uppercase tracking-wider">Priority</span>}
      </div>
      <div className="mt-5 font-headline text-3xl md:text-4xl font-extrabold text-white">
        {price}
        <span className="ml-2 font-body text-sm text-on-surface-variant">/month</span>
      </div>
      <p className="mt-4 max-w-xl font-body text-sm text-on-surface-variant leading-relaxed">{body}</p>
      <div className="mt-8 flex flex-col gap-4 border-t border-surgical-steel pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-body text-xs text-fog-muted">
          <Check size={16} className="text-primary-container" />
          Cancel before your next renewal
        </div>
        <ButtonLink href={featured ? "/subscription/commitment" : "/checkout"} variant={featured ? "primary" : "outline"}>
          Continue
          <ArrowRight size={16} />
        </ButtonLink>
      </div>
    </article>
  );
}

export function DashboardScreen() {
  return (
    <AppShell active="Dashboard" title="Welcome back, Practitioner">
      <main className="relative grid gap-4 p-4 md:grid-cols-12 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:64px_64px]" />
        <div className="relative space-y-4 md:col-span-8">
          <Panel title="Training Vector" action={<Gauge size={16} />}>
            <div className="p-6">
              <p className="font-label-sm text-label-sm text-primary-container">Current Tier</p>
              <h2 className="mt-2 font-headline text-xl font-bold text-white">The Disciplined Mind - Level II</h2>
              <div className="mt-8 flex justify-between font-label text-xs text-fog-muted">
                <span>Module 04 / 12</span>
                <span className="text-primary-container font-semibold">33%</span>
              </div>
              <div className="mt-2 h-2 bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel">
                <div className="h-full w-1/3 bg-primary-container rounded-full" />
              </div>
            </div>
          </Panel>
          <Panel title="Active Lesson" action={<Play size={16} />}>
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="border border-surgical-steel bg-surface-container-high px-2 py-0.5 rounded font-label text-[10px] text-fog-muted">TRACTATUS 4.1</span>
                <h3 className="mt-4 font-headline text-lg font-bold text-white">Perception: The Objective View</h3>
                <p className="mt-2 max-w-xl font-body text-sm text-on-surface-variant">Strip away value judgments from immediate impressions and analyze the core geometry of the event.</p>
              </div>
              <ButtonLink href="/courses/lesson/perception-objective-view">
                Resume
                <ArrowRight size={16} />
              </ButtonLink>
            </div>
          </Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Lessons completed" value="11 / 32" />
            <Metric label="Community rank" value="Level II" />
          </div>
        </div>
        <div className="relative space-y-4 md:col-span-4">
          <Panel title="Chronos">
            <div className="p-6">
              <span className="border border-primary-container/30 bg-primary-container/10 px-2 py-0.5 rounded font-label text-[10px] text-primary-container">UPCOMING LIVE</span>
              <h3 className="mt-4 font-headline text-lg font-bold text-white">Amor Fati: Monthly Workshop</h3>
              <div className="mt-8 border-t border-surgical-steel pt-4">
                <p className="font-label-sm text-label-sm uppercase text-fog-muted">T-minus</p>
                <div className="mt-2 flex justify-between font-label text-base text-primary-container font-bold">
                  <span>02d</span>
                  <span>14h</span>
                  <span>35m</span>
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="Comms / general ethics">
            <div className="p-4">
              <p className="font-label text-xs text-primary-container font-semibold">@marcus_a</p>
              <blockquote className="mt-3 border-l-2 border-primary-container/50 pl-3 font-body text-sm text-on-surface-variant italic">
                The dichotomy of control in modern workspaces needs fewer slogans and more systems.
              </blockquote>
            </div>
          </Panel>
        </div>
      </main>
    </AppShell>
  );
}

type CommunityChannel = { id: string; name: string; type: string; description: string | null; isUnread?: boolean };
type CommunityPost = { id: string; authorName: string; body: string | null; imageUrl: string | null; createdAt: string; isPinned: boolean; reactionCount: number; channelName: string };

export function FeedScreen({
  master = false,
  isMaster = false,
  canManageChannels = false,
  canPost = false,
  memberName,
  platformRole,
  currentTier,
  notifications,
  channels = [],
  posts = [],
  routeBase = "",
  activeNavigationLabel,
  title,
}: {
  master?: boolean; isMaster?: boolean; canManageChannels?: boolean; canPost?: boolean;
  memberName?: string; platformRole?: string; currentTier?: number;
  notifications?: import("@/components/layout/AppShell").Notification[];
  channels?: CommunityChannel[]; posts?: CommunityPost[];
  routeBase?: string;
  activeNavigationLabel?: string;
  title?: string;
}) {

  return (
    <AppShell active={master ? "Master Zone" : activeNavigationLabel ?? "Communities"} title={master ? "Master Zone" : title ?? "Community Feed"} isMaster={isMaster} memberName={memberName} platformRole={platformRole} currentTier={currentTier} notifications={notifications} routeBase={routeBase}>
      <main className="grid min-h-[calc(100vh-4rem)] md:grid-cols-[18rem_1fr]">
        <aside aria-label="Channel selector" className="border-b border-surgical-steel bg-surface-container-low p-4 md:border-b-0 md:border-r">
          <p className="mb-3 px-3 font-label text-[10px] uppercase tracking-[0.16em] text-fog-muted">Channel selector</p>
          {canManageChannels && (
            <button className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary-container px-4 font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider transition hover:brightness-105 active:scale-[0.98]">
              <Plus size={16} />
              New Channel
            </button>
          )}
          {channels.map((channel) => {
            const isSelected = (master && channel.type === "master") || (!master && channel.type !== "master");
            const isUnread = channel.isUnread ?? (!isSelected && (channel.name.toLowerCase() === "announcements" || channel.name.toLowerCase() === "morning reflections"));
            return (
              <Link
                href={channel.type === "events" ? withRouteBase(routeBase, "/events") : "#"}
                key={channel.id}
                className={cx(
                  "flex min-h-11 items-center justify-between px-3 py-1.5 rounded-lg font-label-md text-label-md transition",
                  isSelected
                    ? "border-l-2 border-primary-container bg-surface-container-high text-primary-container"
                    : isUnread
                      ? "text-white font-bold hover:bg-surface-container-high"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-primary-container"
                )}
              >
                <div className="flex items-center gap-3">
                  {channel.type === "master" ? <Crown size={16} /> : <MessageSquare size={16} />}
                  <span>#{channel.name}</span>
                </div>
                {isUnread && (
                  <span className="size-2 rounded-full bg-primary-container animate-pulse shrink-0 mr-1" />
                )}
              </Link>
            );
          })}
          {channels.length === 0 && <p className="px-3 py-4 font-body text-sm text-fog-muted">No channels are available yet.</p>}
        </aside>
        <section className="relative flex min-w-0 flex-col bg-surface">
          <div className={cx("flex-1 space-y-6 overflow-y-auto p-4 md:p-8", canPost && "pb-36")}>
            {posts.map((post) => (
              <article key={post.id} className="group flex gap-4 p-4 border border-surgical-steel bg-monolith-surface rounded-lg">
                <div className="grid size-10 shrink-0 place-items-center rounded bg-surface-container-high border border-surgical-steel font-headline text-lg font-bold text-primary-container">
                  {post.authorName[0]?.toUpperCase() ?? "M"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-label-md text-label-md text-white font-semibold">{post.authorName}</h3>
                    <span className="font-label text-[10px] text-fog-muted">{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(post.createdAt))}</span>
                    <span className="border border-surgical-steel bg-surface-container-low px-2 py-0.5 rounded font-label text-[10px] text-primary-container">{post.isPinned ? "Pinned" : `${post.reactionCount} reactions`}</span>
                  </div>
                  <p className="mt-2 font-body text-sm text-on-surface-variant leading-relaxed">{post.body ?? "Shared an attachment."}</p>
                  {post.imageUrl && <a href={post.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-label text-xs font-semibold uppercase tracking-wider text-primary-container hover:underline">View attachment</a>}
                </div>
                {canPost && (
                  <div className="hidden gap-1 opacity-0 transition group-hover:opacity-100 sm:flex">
                    <IconButton label="Pin">
                      <Crown size={15} />
                    </IconButton>
                    <IconButton label="More">
                      <MoreVertical size={15} />
                    </IconButton>
                  </div>
                )}
              </article>
            ))}
            {posts.length === 0 && <div className="border border-dashed border-surgical-steel bg-monolith-surface p-8 text-center rounded-lg"><p className="font-headline text-base font-semibold text-white">No posts yet</p><p className="mt-2 font-body text-sm text-fog-muted">New community updates will appear here.</p></div>}
          </div>
          {canPost && (
            <div className="absolute inset-x-0 bottom-0 border-t border-surgical-steel bg-surface-container-low p-4">
              <div className="mx-auto flex max-w-4xl items-end gap-2 border border-surgical-steel bg-monolith-surface p-2 rounded-lg focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container">
                <IconButton label="Add image">
                  <ImageIcon size={18} />
                </IconButton>
                <textarea
                  className="min-h-10 flex-1 resize-none bg-transparent p-2 font-body text-sm text-on-surface outline-none placeholder:text-fog-muted"
                  rows={1}
                  placeholder={master ? "Message #master-zone..." : "Message #general-theory..."}
                />
                <IconButton label="Send">
                  <Send size={18} />
                </IconButton>
              </div>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}

export function EventsScreen({ isMaster = false }: { isMaster?: boolean }) {
  const events = [
    ["Amor Fati Workshop", "Advanced", "Live in 2d 14h", "Zoom revealed"],
    ["Morning Reflection Room", "Basic", "Tomorrow 08:00", "Join available"],
    ["Investment Briefing", "Master", "Friday 19:00", "Locked"]
  ];

  return (
    <AppShell active="Events" title="Events Directory" isMaster={isMaster}>
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary-container">Live schedule</p>
            <h2 className="mt-2 font-headline text-2xl font-bold text-white md:text-3xl">Upcoming sessions and gated rooms</h2>
          </div>
          <ButtonLink href="/dashboard/community" variant="outline">
            <Plus size={16} />
            Create Event
          </ButtonLink>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(([title, tier, time, status]) => (
            <Panel key={title} title={tier}>
              <div className="p-5 flex flex-col justify-between min-h-[160px]">
                <div>
                  <h3 className="font-headline text-lg font-bold text-white">{title}</h3>
                  <p className="mt-2 font-body text-sm text-on-surface-variant leading-relaxed">Tier-gated event card with Zoom visibility based on earned access.</p>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-surgical-steel pt-4">
                  <span className="font-label text-xs text-primary-container font-semibold">{time}</span>
                  <span className="font-label text-xs text-fog-muted uppercase">{status}</span>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </main>
    </AppShell>
  );
}

export function LessonScreen() {
  return (
    <AppShell active="Courses" title="Video Lesson Player">
      <main className="grid gap-6 p-4 lg:grid-cols-[1fr_22rem] md:p-8 max-w-7xl mx-auto">
        <section className="space-y-4">
          <div className="aspect-video border border-surgical-steel bg-surface-container-low rounded-lg overflow-hidden flex flex-col items-center justify-center gap-4 text-primary-container">
            <Video size={56} strokeWidth={1.2} />
            <span className="font-label text-xs uppercase tracking-wider text-fog-muted">Google Drive embed loads after server tier check</span>
          </div>
          <Panel title="Perception / Lesson 04">
            <div className="p-6">
              <h2 className="font-headline text-xl font-bold text-white">The Objective View</h2>
              <p className="mt-3 font-body text-sm text-on-surface-variant leading-relaxed">
                A disciplined pass through impression, judgment, action, and review. Progress is tracked by watch-time threshold.
              </p>
              <div className="mt-6 flex justify-between font-label text-xs text-fog-muted">
                <span>Watch progress</span>
                <span className="text-primary-container font-semibold">68%</span>
              </div>
              <div className="mt-2 h-2 bg-surface-container-high rounded-full overflow-hidden border border-surgical-steel">
                <div className="h-full w-[68%] bg-primary-container rounded-full" />
              </div>
            </div>
          </Panel>
        </section>
        <Panel title="Tier sequence">
          <div className="divide-y divide-surgical-steel">
            {["Opening frame", "What is in control", "What is not in control", "Objective view", "Reserve clause"].map((lesson, i) => (
              <div key={lesson} className="flex items-center justify-between p-4 font-body text-sm hover:bg-surface-container-high/50 transition">
                <span className="text-on-surface">{lesson}</span>
                {i < 3 ? (
                  <Check size={16} className="text-primary-container" />
                ) : i === 3 ? (
                  <Play size={16} className="text-primary-container animate-pulse" />
                ) : (
                  <Lock size={16} className="text-fog-muted" />
                )}
              </div>
            ))}
          </div>
        </Panel>
      </main>
    </AppShell>
  );
}

export function AdminScreen() {
  return (
    <AppShell active="Dashboard" title="Super Admin Dashboard">
      <main className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Stoicverse members" value="30,248" />
          <Metric label="Membership revenue" value="$418k" />
          <Metric label="Influencer account" value="1 maximum" />
          <Metric label="Suspensions" value="7" />
        </div>
        <Panel title="Stoicverse Platform">
          <div className="divide-y divide-surgical-steel text-on-surface-variant">
            <div className="p-5">
              <p className="font-headline text-lg font-bold text-white">One community, one operating surface.</p>
              <p className="mt-2 font-body text-sm">Manage members, content, payments, moderators, and the single optional influencer account from this platform.</p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Metric label="Channels" value="Community-wide" />
              <Metric label="Curriculum" value="Global tiers" />
              <Metric label="Access" value="One membership" />
            </div>
          </div>
        </Panel>
      </main>
    </AppShell>
  );
}

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_30rem] bg-surface-container-lowest">
      <section className="hidden border-r border-surgical-steel p-12 lg:flex lg:flex-col lg:justify-between relative overflow-hidden bg-surface-container-low">
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:60px_60px]" />
        <div className="relative z-10">
          <Link href="/" className="font-headline text-2xl font-bold text-primary-container tracking-wider">
            Stoicverse
          </Link>
        </div>
        <div className="relative z-10 my-auto max-w-2xl border-l-2 border-primary-container pl-8 py-6">
          <h1 className="font-headline text-3xl font-extrabold text-white leading-tight md:text-4xl">
            Enter the operating surface for disciplined study.
          </h1>
          <p className="mt-6 font-body text-base text-on-surface-variant leading-relaxed">
            Membership unlocks community channels, tier-one lessons, and the path toward Master access.
          </p>
        </div>
        <div className="relative z-10 font-label text-xs text-fog-muted tracking-[0.2em] uppercase">
          system_entry // secure_access_portal
        </div>
      </section>

      <section className="relative flex items-center justify-center p-6 md:p-12 overflow-hidden bg-surface">
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#334155_1px,transparent_1px),linear-gradient(90deg,#334155_1px,transparent_1px)] [background-size:60px_60px]" />
        <div className="relative z-10 w-full max-w-md border-t-2 border-t-primary-container border-x border-b border-surgical-steel bg-monolith-surface p-8 md:p-10 rounded-lg shadow-xl hover:shadow-primary-container/5 transition-all">
          <div className="mb-8 flex items-center gap-3 text-primary-container">
            {isSignup ? <Shield size={24} className="animate-pulse" /> : <LogIn size={24} />}
            <h1 className="font-headline text-xl font-bold tracking-wide">{isSignup ? "Sign up" : "Log in"}</h1>
          </div>
          <div className="space-y-5">
            {isSignup && <Field label="Full name" placeholder="Marcus North" />}
            <Field label="Email" placeholder="you@example.com" />
            <Field label="Password" placeholder="Minimum 8 characters" type="password" />
          </div>
          <button className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container font-label-md text-label-md text-on-primary-fixed uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all duration-300" type="button">
            {isSignup ? "Create account" : "Enter platform"}
            <ArrowRight size={16} />
          </button>
          <p className="mt-6 text-center font-body text-sm text-fog-muted">
            {isSignup ? "Already registered?" : "Need access?"}{" "}
            <Link href={isSignup ? "/login" : "/signup"} className="text-primary-container hover:underline font-semibold">
              {isSignup ? "Log in" : "Sign up"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <label className="block group">
      <span className="font-label-sm text-label-sm uppercase tracking-[0.14em] text-fog-muted group-focus-within:text-primary-container transition-colors">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-2 min-h-12 w-full rounded border border-surgical-steel bg-surface-container-lowest px-5 text-on-surface outline-none placeholder:text-fog-muted focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all hover:border-primary-container/70"
      />
    </label>
  );
}

export function CommunitySelectionScreen() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-surface">
      <div className="mx-auto max-w-xl border border-surgical-steel bg-monolith-surface p-8 rounded-lg">
        <Link href="/" className="font-headline text-lg font-bold text-primary-container">Stoicverse</Link>
        <h1 className="mt-10 font-headline text-2xl font-bold text-white md:text-3xl">Join Stoicverse.</h1>
        <p className="mt-4 font-body text-sm text-on-surface-variant leading-relaxed">One membership unlocks the Stoicverse community, curriculum, events, and progression path.</p>
        <div className="mt-8">
          <ButtonLink href="/checkout">Continue to checkout</ButtonLink>
        </div>
      </div>
    </main>
  );
}

export function SubscriptionScreen() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-surface">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="font-headline text-lg font-bold text-primary-container">Stoicverse</Link>
        <h1 className="mt-10 font-headline text-3xl font-extrabold text-white leading-tight md:text-4xl">Subscription cadence.</h1>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <PricingCard title="Monthly" price="$10" body="Maintain access to community surfaces, lessons, events, and tier progression." />
          <PricingCard title="Annual Commitment" price="$100" body="Commit for a full year and keep the learning system active without monthly interruption." featured />
        </div>
      </div>
    </main>
  );
}

export function CommitmentScreen() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-surface">
      <div className="mx-auto max-w-4xl border border-surgical-steel bg-monolith-surface p-6 md:p-10 rounded-lg">
        <Link href="/" className="font-headline text-lg font-bold text-primary-container">Stoicverse</Link>
        <h1 className="mt-10 font-headline text-3xl font-extrabold text-white leading-tight md:text-4xl">Confirm the commitment.</h1>
        <p className="mt-6 font-body text-base text-on-surface-variant leading-relaxed">
          This screen clarifies what membership does and does not unlock before payment: community access, ordered lessons, events, and progression tracking. Mentorship remains a separate purchase.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {["One community membership", "Tier 1 unlocked after payment", "Locked channels hidden until earned", "Mentorship purchase remains optional"].map((item) => (
            <div key={item} className="flex items-center gap-3 border border-surgical-steel bg-surface-container-low p-4 rounded">
              <Check size={16} className="text-primary-container shrink-0" />
              <span className="font-body text-sm text-on-surface">{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-surgical-steel pt-6">
          <ButtonLink href="/checkout">Continue to checkout</ButtonLink>
        </div>
      </div>
    </main>
  );
}
