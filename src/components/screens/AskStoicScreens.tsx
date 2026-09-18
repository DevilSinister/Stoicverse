import Link from "next/link";
import { Crown, MessageSquare } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { withRouteBase } from "@/lib/navigation/paths";
import { cn } from "@/lib/utils";

/**
 * The two screens the phase order never assigned: `/admin`, where a super admin
 * lands after signing in, and `/master`, the Master Zone feed.
 *
 * Phase 13d brought both onto the token layer and took four claims out of them
 * on the way, because repainting a claim is how it survives another six months:
 *
 *   * **The admin dashboard's figures were invented.** "30,248 members",
 *     "$418k revenue", "1 maximum" and "7 suspensions" were literals in this
 *     file, on the first screen a platform administrator sees. Nothing read a
 *     database. They are gone rather than restyled; what is left says what the
 *     platform *is*, which is structural truth, and says plainly that no
 *     platform metrics are wired up yet.
 *   * **Every channel in the Master Zone linked to `#`** except the events one.
 *     A row that goes nowhere is not a link, so it is not rendered as one.
 *   * **The unread dots were guessed from channel names** - a hard-coded list
 *     of "announcements" and "morning reflections" - whenever the caller did
 *     not supply `isUnread`. An unread mark nobody wrote is worse than none.
 *   * **The composer, its Send, its image button and the per-post Pin and More
 *     buttons had no handlers at all.** A control that does nothing is a
 *     promise the screen cannot keep; the real composer is `/channels`.
 *
 * What remains is what the page can actually show: the channels and posts the
 * server hands it, and honest empty states where there are none.
 */

type CommunityChannel = { id: string; name: string; type: string; description: string | null; isUnread?: boolean };
type CommunityPost = {
  id: string;
  authorName: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  isPinned: boolean;
  reactionCount: number;
  channelName: string;
};

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-hairline bg-surface-panel">
      <div className="flex h-chrome-bar items-center justify-between border-b border-border-hairline bg-surface-raised px-chrome-x">
        <h2 className="text-chrome-xs font-medium uppercase tracking-[0.16em] text-text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FeedScreen({
  master = false,
  isMaster = false,
  canManageChannels = false,
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
  master?: boolean;
  isMaster?: boolean;
  canManageChannels?: boolean;
  /**
   * Kept in the signature because `renderMasterPage` passes it and the
   * permission it carries is real. Nothing renders from it any more: the
   * composer it used to gate never sent anything.
   */
  canPost?: boolean;
  memberName?: string;
  platformRole?: string;
  currentTier?: number;
  notifications?: import("@/components/layout/AppShell").Notification[];
  channels?: CommunityChannel[];
  posts?: CommunityPost[];
  routeBase?: string;
  activeNavigationLabel?: string;
  title?: string;
}) {
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

  return (
    <AppShell
      active={master ? "Master Zone" : (activeNavigationLabel ?? "Communities")}
      title={master ? "Master Zone" : (title ?? "Community Feed")}
      isMaster={isMaster}
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      notifications={notifications}
      routeBase={routeBase}
    >
      <main className="grid min-h-0 md:grid-cols-[18rem_1fr]">
        <aside
          aria-label="Channel selector"
          className="border-b border-border-hairline bg-surface-sunken p-chrome-x md:border-r md:border-b-0"
        >
          <p className="mb-3 px-3 text-chrome-xs font-medium uppercase tracking-[0.16em] text-text-muted">
            Channel selector
          </p>

          {/*
            A link to where channels are actually created, rather than a button
            that was never wired to anything. That settings section exists, and
            this is the permission that reaches it.
          */}
          {canManageChannels ? (
            <Link
              href="/creator/settings?section=structure"
              className={cn(buttonVariants({ variant: "outline" }), "mb-4 w-full")}
            >
              Manage channels
            </Link>
          ) : null}

          <ul className="space-y-0.5">
            {channels.map((channel) => {
              const selected = master === (channel.type === "master");
              const unread = channel.isUnread === true;
              // Only the events channel has somewhere to go from here. The rest
              // are rows, because a link to `#` is a link that lies.
              const href = channel.type === "events" ? withRouteBase(routeBase, "/events") : null;
              const inner = (
                <>
                  <span className="flex min-w-0 items-center gap-3">
                    {channel.type === "master" ? (
                      <Crown size={16} aria-hidden="true" className="shrink-0" />
                    ) : (
                      <MessageSquare size={16} aria-hidden="true" className="shrink-0" />
                    )}
                    <span className="truncate">{`#${channel.name}`}</span>
                  </span>
                  {unread ? (
                    <span aria-hidden="true" className="mr-1 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </>
              );
              const shape = cn(
                "flex min-h-11 items-center justify-between rounded-lg px-3 text-chrome-base transition-colors",
                selected
                  ? "bg-accent-soft text-text-strong"
                  : unread
                    ? "text-text-strong hover:bg-surface-panel"
                    : "text-text-muted hover:bg-surface-panel hover:text-text-strong",
              );

              return (
                <li key={channel.id}>
                  {href ? (
                    <Link href={href} className={cn("focus-ring", shape)}>
                      {inner}
                    </Link>
                  ) : (
                    <span className={shape} title={channel.description ?? undefined}>
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {channels.length === 0 ? (
            <p className="px-3 py-4 text-chrome-sm text-text-muted">No channels are available yet.</p>
          ) : null}
        </aside>

        <section className="flex min-w-0 flex-col bg-surface-canvas">
          <div className="flex-1 space-y-content-gap overflow-y-auto p-4 md:p-content-x">
            {posts.map((post) => (
              <article
                key={post.id}
                className="flex gap-4 rounded-lg border border-border-hairline bg-surface-panel p-4"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border-hairline bg-surface-raised text-content-base font-medium text-text-strong">
                  {post.authorName[0]?.toUpperCase() ?? "M"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-chrome-base font-medium text-text-strong">{post.authorName}</h3>
                    <time dateTime={post.createdAt} className="font-mono text-mono-xs text-text-muted">
                      {date.format(new Date(post.createdAt))}
                    </time>
                    <span className="rounded-md border border-border-hairline px-2 py-0.5 font-mono text-mono-xs text-text-muted">
                      {post.isPinned ? "Pinned" : `${post.reactionCount} reactions`}
                    </span>
                  </div>
                  <p className="mt-2 text-content-sm text-text-default">{post.body ?? "Shared an attachment."}</p>
                  {post.imageUrl ? (
                    <a
                      href={post.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring mt-3 inline-flex rounded-md text-chrome-sm text-primary hover:underline"
                    >
                      View attachment
                    </a>
                  ) : null}
                </div>
              </article>
            ))}

            {posts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                description="New community updates will appear here."
                className="rounded-lg border border-dashed border-border-hairline"
              />
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}

export function AdminScreen() {
  return (
    <AppShell active="Dashboard" title="Super Admin Dashboard">
      <main className="mx-auto max-w-7xl space-y-content-gap p-4 md:p-content-x">
        <Panel title="Stoicverse Platform">
          <div className="p-5 text-text-default">
            <p className="text-title-sm font-medium text-text-strong">One community, one operating surface.</p>
            <p className="mt-2 text-content-sm">
              Members, content, payments, moderators and the single optional influencer account are managed
              from this platform.
            </p>
          </div>
        </Panel>

        {/*
          What this used to be: four metric tiles reading 30,248 members, $418k
          of revenue, one influencer account and seven suspensions. All four
          were literals in this file. An administrator has no way to tell a
          typed number from a measured one, which is exactly what makes writing
          one down a claim rather than a placeholder.
        */}
        <Panel title="Platform metrics">
          <EmptyState
            title="No platform metrics are connected"
            description="This screen has never read a figure from the database. The numbers that used to sit here were written into the page, and they are gone; the community's own analytics live in the creator workspace."
          />
        </Panel>
      </main>
    </AppShell>
  );
}
