"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { CalendarDays, Hash, Lock, Megaphone, ScrollText, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { useCommunity, type ChannelRow } from "@/components/channels/CommunityProvider";

/**
 * The frame: channels on the left, the conversation on the right.
 *
 * `/channels` renders without `AppShell` on purpose. A chat client owns the
 * whole viewport — a page header above a message list costs the vertical space
 * the list exists to use, and this sidebar already does the job the app nav
 * does elsewhere.
 */

const CHANNEL_ICONS: Record<string, typeof Hash> = {
  text: Hash,
  announcements: Megaphone,
  events: CalendarDays,
  rules: ScrollText,
};

function ChannelLink({ channel, active }: { channel: ChannelRow; active: boolean }) {
  const Icon = channel.isLocked ? Lock : (CHANNEL_ICONS[channel.type] ?? Hash);

  if (channel.isLocked) {
    // A locked channel is shown rather than hidden, because "there is more
    // here at a higher tier" is the point. It is not a link: there is nothing
    // behind it for this person yet.
    return (
      <span
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-fog-muted/70"
        title={channel.unlockTier ? `Unlocks at tier ${channel.unlockTier}` : "You do not have access"}
      >
        <Icon size={16} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{channel.name}</span>
        {channel.unlockTier ? (
          <span className="ml-auto shrink-0 rounded border border-surgical-steel px-1 text-[10px]">
            {`T${channel.unlockTier}`}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      href={`/channels/${channel.id}`}
      aria-current={active ? "page" : undefined}
      className={`focus-ring flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-surface-container-high text-on-surface"
          : channel.hasUnread
            ? "text-on-surface hover:bg-surface-container-low"
            : "text-fog-muted hover:bg-surface-container-low hover:text-on-surface"
      }`}
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className={`truncate ${channel.hasUnread && !active ? "font-semibold" : ""}`}>{channel.name}</span>
      {channel.mentionCount > 0 ? (
        <span
          className="ml-auto shrink-0 rounded-full bg-error px-1.5 text-[11px] font-semibold text-monolith-surface"
          aria-label={`${channel.mentionCount} unread mentions`}
        >
          {channel.mentionCount > 99 ? "99+" : channel.mentionCount}
        </span>
      ) : null}
    </Link>
  );
}

export function ChannelsShell({ children }: { children: ReactNode }) {
  const { channels, viewer, degraded } = useCommunity();
  // `/channels/[channelId]` — the segment is the id of the open channel.
  const activeId = useSelectedLayoutSegment();

  const canManage = (viewer?.grants ?? []).some(
    (grant) => grant === "manage_community" || grant === "manage_channels" || grant === "administrator",
  );

  // Categories in the order the directory returned them, which is the order
  // the creator arranged.
  const categories: { id: string; name: string; channels: ChannelRow[] }[] = [];
  for (const channel of channels) {
    const existing = categories.find((category) => category.id === channel.categoryId);
    if (existing) existing.channels.push(channel);
    else categories.push({ id: channel.categoryId, name: channel.categoryName, channels: [channel] });
  }

  return (
    <div className="grid h-svh grid-cols-1 bg-monolith-surface md:grid-cols-[15rem_1fr]">
      <nav
        aria-label="Channels"
        className="hidden min-h-0 flex-col border-r border-surgical-steel bg-surface-container-lowest md:flex"
      >
        <div className="flex items-center justify-between gap-2 border-b border-surgical-steel px-3 py-3">
          <span className="truncate text-sm font-semibold text-on-surface">Community</span>
          {canManage ? (
            <Link
              href="/creator/settings"
              aria-label="Community settings"
              className="focus-ring rounded-lg p-1.5 text-fog-muted hover:text-on-surface"
            >
              <Settings size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {degraded.length > 0 ? (
            <p
              role="status"
              className="mb-3 rounded-lg border border-dashed border-surgical-steel p-2 text-xs text-fog-muted"
            >
              {degraded[0]}
            </p>
          ) : null}

          {categories.length === 0 ? (
            <p className="px-2 text-xs text-fog-muted">No channels yet.</p>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="mb-4">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                  {category.name}
                </p>
                <ul className="space-y-0.5">
                  {category.channels.map((channel) => (
                    <li key={channel.id}>
                      <ChannelLink channel={channel} active={channel.id === activeId} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-surgical-steel px-3 py-2">
          <p className="truncate text-xs text-on-surface-variant">{viewer?.profile?.fullName ?? "Member"}</p>
        </div>
      </nav>

      <div className="flex min-h-0 min-w-0 flex-col">{children}</div>
    </div>
  );
}

/** Shown while the shell's data is in flight, so the frame does not jump in. */
export function ShellSkeleton() {
  return (
    <div className="grid h-svh grid-cols-1 bg-monolith-surface md:grid-cols-[15rem_1fr]">
      <div className="hidden border-r border-surgical-steel bg-surface-container-lowest md:block" />
      <div className="flex items-center justify-center">
        <p className="text-sm text-fog-muted">Loading the community…</p>
      </div>
    </div>
  );
}
