"use client";

import Link from "next/link";
import { Crown, Image as ImageIcon, MessageSquare, MoreVertical, Plus, Send } from "lucide-react";
import { AppShell as SharedAppShell } from "@/components/layout/AppShell";
import { withRouteBase } from "@/lib/navigation/paths";

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

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
                      ? "text-text-strong font-bold hover:bg-surface-container-high"
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
                    <h3 className="font-label-md text-label-md text-text-strong font-semibold">{post.authorName}</h3>
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
            {posts.length === 0 && <div className="border border-dashed border-surgical-steel bg-monolith-surface p-8 text-center rounded-lg"><p className="font-headline text-base font-semibold text-text-strong">No posts yet</p><p className="mt-2 font-body text-sm text-fog-muted">New community updates will appear here.</p></div>}
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
              <p className="font-headline text-lg font-bold text-text-strong">One community, one operating surface.</p>
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
