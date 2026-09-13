"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { BellOff, CalendarDays, Hash, Lock, Megaphone, ScrollText, Settings } from "lucide-react";
import type { ReactNode } from "react";

import { setChannelNotificationLevel } from "@/app/community/actions";
import { useCommunity, type ChannelRow } from "@/components/channels/CommunityProvider";
import { MemberProfileDialog } from "@/components/channels/MemberProfileDialog";
import { MobilePaneDrawer } from "@/components/channels/MobilePane";
import { AppRail } from "@/components/layout/AppRail";
import { SearchOverlay } from "@/components/channels/SearchOverlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isTypingTarget, resolveShortcut } from "@/lib/channels/shortcuts";
import { CHANNEL_NOTIFICATION_LEVELS } from "@/lib/community/constants";

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

const LEVEL_LABEL: Record<string, string> = {
  all: "Every message",
  mentions: "Only when I am mentioned",
  none: "Nothing",
};

/**
 * `touch` is the drawer, and it is the only place the row grows.
 *
 * The sidebar keeps the chat density the owner chose - 32px rows - because it
 * is operated with a pointer. In the drawer the same row is the primary action
 * on a phone and was 32px of target. `hit-target` is the wrong tool here: the
 * rows are stacked at a 34px pitch, so a 44px invisible box on each one would
 * reach 10px into both neighbours, which is precisely the overlap P3a measured
 * and removed from the header. Below `md` the row is simply 44px tall.
 */
function ChannelLink({
  channel,
  active,
  muted,
  touch = false,
}: {
  channel: ChannelRow;
  active: boolean;
  muted: boolean;
  touch?: boolean;
}) {
  const Icon = channel.isLocked ? Lock : (CHANNEL_ICONS[channel.type] ?? Hash);

  if (channel.isLocked) {
    // A locked channel is shown rather than hidden, because "there is more
    // here at a higher tier" is the point. It is not a link: there is nothing
    // behind it for this person yet.
    return (
      <span
        className={`flex items-center gap-2 rounded-lg px-2 text-sm text-fog-muted/70 ${touch ? "min-h-11" : "py-1.5"}`}
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

  // A muted channel still counts mentions — muting says "do not shout at me",
  // not "hide it from me" — but it stops going bold for ordinary traffic.
  const bold = channel.hasUnread && !active && !muted;

  return (
    <div className="group/channel relative flex items-center">
      <Link
        href={`/channels/${channel.id}`}
        aria-current={active ? "page" : undefined}
        className={`focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-lg pl-2 text-sm transition-colors ${
          // The bell is always visible off a pointer, so the name has to stop
          // before it rather than truncate underneath it.
          touch ? "min-h-11 pr-11" : "py-1.5 pr-2"
        } ${
          active
            ? "bg-surface-container-high text-on-surface"
            : bold
              ? "text-on-surface hover:bg-surface-container-low"
              : "text-fog-muted hover:bg-surface-container-low hover:text-on-surface"
        }`}
      >
        <Icon size={16} aria-hidden="true" className="shrink-0" />
        <span className={`truncate ${bold ? "font-semibold" : ""}`}>{channel.name}</span>
        {muted ? <BellOff size={12} aria-hidden="true" className="shrink-0 text-fog-muted" /> : null}
        {channel.mentionCount > 0 ? (
          <span
            className="ml-auto shrink-0 rounded-full bg-error px-1.5 text-[11px] font-semibold text-monolith-surface"
            aria-label={`${channel.mentionCount} unread mentions`}
          >
            {channel.mentionCount > 99 ? "99+" : channel.mentionCount}
          </span>
        ) : null}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Notification settings for ${channel.name}`}
          /*
            An `opacity-0` control still takes the tap.

            This bell is revealed on hover, which no touch screen has - so on a
            phone it was invisible and live over the right 44px of every channel
            row, and tapping the end of a channel name opened its notification
            menu instead of the channel. Two halves to the fix: off a pointer it
            is simply visible, and where it does hide it stops receiving pointer
            events until it is revealed.
          */
          className={`focus-ring hit-target absolute right-1 rounded p-1 text-fog-muted hover:text-on-surface ${
            touch
              ? ""
              : "pointer-events-none opacity-0 group-focus-within/channel:pointer-events-auto group-focus-within/channel:opacity-100 group-hover/channel:pointer-events-auto group-hover/channel:opacity-100"
          }`}
        >
          <BellOff size={12} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {CHANNEL_NOTIFICATION_LEVELS.map((level) => (
            <DropdownMenuItem key={level} onClick={() => void setChannelNotificationLevel(channel.id, level)}>
              {LEVEL_LABEL[level]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ChannelNav({ onNavigate, touch = false }: { onNavigate?: () => void; touch?: boolean }) {
  const { channels, viewer, degraded } = useCommunity();
  const settings = viewer?.notificationSettings ?? {};
  // Read once when the nav mounts rather than on every render. `Date.now()`
  // during render is impure: an expiring mute would flip whenever React
  // happened to re-render, which is neither predictable nor tied to the clock.
  // The cost is that a timed mute expiring while the page is open keeps its
  // icon until the next navigation, which nobody will notice and nobody is
  // misled by — the server is still the one deciding what to notify.
  const [mountedAt] = useState(() => Date.now());
  const isMuted = (channelId: string) => {
    const setting = settings[channelId];
    if (!setting) return false;
    if (setting.level === "none" || setting.level === "mentions") return true;
    return setting.mutedUntil !== null && Date.parse(setting.mutedUntil) > mountedAt;
  };
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
    <>
      <div className="flex items-center justify-between gap-2 border-b border-surgical-steel px-3 py-3">
        <span className="truncate text-sm font-semibold text-on-surface">Community</span>
        {canManage ? (
          <Link
            href="/creator/settings"
            aria-label="Community settings"
            className="focus-ring hit-target relative rounded-lg p-1.5 text-fog-muted hover:text-on-surface"
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
                  <li key={channel.id} onClick={onNavigate}>
                    <ChannelLink
                      channel={channel}
                      active={channel.id === activeId}
                      muted={isMuted(channel.id)}
                      touch={touch}
                    />
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
    </>
  );
}

export function ChannelsShell({ children, isMaster = false }: { children: ReactNode; isMaster?: boolean }) {
  const { channels, viewer, pane, setPane, profileFor, closeProfile, searchOpen, setSearchOpen } = useCommunity();
  const router = useRouter();
  const activeId = useSelectedLayoutSegment();

  /**
   * The page's keyboard shortcuts.
   *
   * Bound on the document rather than on a wrapper, because the composer, the
   * member list and every dialog are all inside this tree and any of them can
   * hold focus when somebody reaches for Ctrl+K. What each key *means* is
   * `resolveShortcut`, which is a pure function a test can execute; this only
   * carries out the answer.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        typing: isTypingTarget(event.target),
      });
      if (action === null || action === "editLastMessage") return;

      if (action === "search") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (action === "closeTopmost") {
        // One layer at a time, outermost last. Escape with a pane open closes
        // the pane, not the page.
        //
        // The palette is not in this list. It is a Base UI dialog and dismisses
        // itself; closing it here as well would be the same double-close that
        // the nested confirm had, on a different pair of layers.
        if (searchOpen) return;
        if (profileFor) closeProfile();
        else if (pane) setPane(null);
        return;
      }

      // Walking the list skips the locked channels, which are shown but have
      // nothing behind them for this person.
      const open = channels.filter((channel) => !channel.isLocked);
      if (open.length === 0) return;
      const index = open.findIndex((channel) => channel.id === activeId);
      const next =
        action === "nextChannel"
          ? open[(index + 1 + open.length) % open.length]
          : open[(index - 1 + open.length) % open.length];
      if (next && next.id !== activeId) {
        event.preventDefault();
        router.push(`/channels/${next.id}`);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [channels, activeId, router, searchOpen, setSearchOpen, pane, setPane, profileFor, closeProfile]);

  // A pane left open across a navigation would sit over the channel somebody
  // just chose from inside it.
  useEffect(() => {
    setPane(null);
  }, [activeId, setPane]);

  /*
    The same rail the workspace renders. Mounting it here is the whole point of
    the component: crossing between /channels and /creator used to swap the
    entire frame and take the navigation with it.

    `routeBase` comes from the viewer rather than the URL, because /channels is
    one route for everybody — the resolver decides what each person may do once
    they are here — while the rail's other destinations are per-role.
  */
  const railProps = {
    routeBase: viewer?.isInfluencer ? "/creator" : "/dashboard",
    isMaster,
    memberName: viewer?.profile?.fullName ?? "Member",
    avatarUrl: viewer?.profile?.avatarUrl ?? null,
    onNavigate: () => setPane(null),
  };

  return (
    <div className="grid h-svh grid-cols-1 bg-monolith-surface md:grid-cols-[4.5rem_15rem_1fr]">
      <div className="hidden min-h-0 md:block">
        <AppRail {...railProps} />
      </div>

      <nav
        aria-label="Channels"
        className="hidden min-h-0 flex-col border-r border-surgical-steel bg-surface-container-lowest md:flex"
      >
        <ChannelNav />
      </nav>

      <div className="flex min-h-0 min-w-0 flex-col">{children}</div>

      {/* The same list as a pane, for the screens with no column to put it in. */}
      {pane === "sidebar" ? (
        <MobilePaneDrawer side="left" label="Channels" size="lg" onClose={() => setPane(null)}>
          {/*
            Both columns from one gesture. A permanent 4.5rem rail is too much
            of a phone, and a second drawer to reach the rest of the product
            would be a gesture nobody discovers.
          */}
          <div className="flex h-full min-h-0 flex-1">
            {/*
              `stack`, not the bare rail. Inside the drawer there is no hover,
              so the icons-only rail's tooltips never fire and this was nine
              unnamed glyphs - the entire primary navigation, anonymous, on
              every phone. The labelled column costs 80px of the drawer's 319
              and is the reason the channel names beside it can truncate.
            */}
            <AppRail {...railProps} variant="stack" />
            <div className="flex min-h-0 flex-1 flex-col">
              <ChannelNav touch onNavigate={() => setPane(null)} />
            </div>
          </div>
        </MobilePaneDrawer>
      ) : null}

      {/*
        One card for the whole page. Every name and every avatar in every
        message opens this same one, so there is never more than one mounted
        and never a stale copy behind the open one.
      */}
      {profileFor ? <MemberProfileDialog key={profileFor} userId={profileFor} onClose={closeProfile} /> : null}

      {/*
        One palette for the page, mounted here rather than in the channel view.
        Ctrl+K has to answer on /channels with no channel chosen, where there is
        no ChannelView to hold it - and the header button that also opens it is
        two subtrees away, which is why the open flag lives in the provider.
      */}
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

/**
 * Shown while the shell's data is in flight, so the frame does not jump in.
 *
 * It has to be the *same* grid as the shell it stands in for. It was
 * `[15rem_1fr]` — two columns, written before the rail existed — against the
 * real shell's `[4.5rem_15rem_1fr]`, so every arrival at /channels drew a frame
 * 4.5rem narrower than the one that replaced it and the whole conversation slid
 * sideways once the data landed.
 *
 * The rail column is drawn as its strip of discs rather than left blank: it is
 * the one part of the page about to be identical, and showing its shape is the
 * difference between "this is loading" and "this is broken".
 */
export function ShellSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the community"
      className="grid h-svh grid-cols-1 bg-monolith-surface md:grid-cols-[4.5rem_15rem_1fr]"
    >
      <div className="hidden flex-col items-center gap-3 border-r border-surgical-steel bg-sidebar py-3 md:flex">
        {Array.from({ length: 7 }, (_, item) => (
          <div key={item} className="size-11 animate-pulse rounded-2xl bg-surface-container-high" />
        ))}
      </div>

      <div className="hidden min-h-0 flex-col border-r border-surgical-steel bg-surface-container-lowest md:flex">
        <div className="border-b border-surgical-steel px-3 py-3">
          <div className="h-4 w-28 animate-pulse rounded-lg bg-surface-container-high" />
        </div>
        <div className="space-y-2 px-3 py-3">
          {Array.from({ length: 9 }, (_, row) => (
            <div
              key={row}
              className="h-4 animate-pulse rounded-lg bg-surface-container-high"
              style={{ width: `${55 + ((row * 13) % 40)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <div className="flex h-14 items-center border-b border-surgical-steel px-4">
          <div className="h-4 w-40 animate-pulse rounded-lg bg-surface-container-high" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 p-4">
          {Array.from({ length: 6 }, (_, message) => (
            <div key={message} className="flex gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-surface-container-high" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded-lg bg-surface-container-high" />
                <div
                  className="h-3 animate-pulse rounded-lg bg-surface-container-high"
                  style={{ width: `${45 + ((message * 17) % 45)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading the community</span>
    </div>
  );
}
