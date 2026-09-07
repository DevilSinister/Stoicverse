"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ChevronRight, Lock, Search, Settings2, X } from "lucide-react";

import { channelHref, channelMeta, tierName } from "@/components/community/channel-meta";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";

type Props = {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  creator: boolean;
  activeChannelId?: string;
  routeBase: string;
  onManageClick?: () => void;
  /** Closes the mobile sheet once a channel is chosen. */
  onNavigate?: () => void;
};

export function ChannelSidebar({
  categories,
  channels,
  creator,
  activeChannelId,
  routeBase,
  onManageClick,
  onNavigate,
}: Props) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const needle = filter.trim().toLowerCase();

  const { groups, archived } = useMemo(() => {
    const matches = (channel: CommunityChannel) =>
      !needle ||
      channel.name.toLowerCase().includes(needle) ||
      (channel.description ?? "").toLowerCase().includes(needle);

    const visibleCategories = categories.filter((category) => creator || !category.isArchived);
    const archivedChannels = creator ? channels.filter((channel) => channel.isArchived && matches(channel)) : [];

    const grouped = visibleCategories
      .map((category) => ({
        category,
        items: channels.filter(
          (channel) => channel.categoryId === category.id && !channel.isArchived && matches(channel),
        ),
      }))
      // An empty category is noise while filtering, but real structure when the
      // field is clear — the creator needs to see it in order to fill it.
      .filter((group) => group.items.length > 0 || (!needle && creator));

    return { groups: grouped, archived: archivedChannels };
  }, [categories, channels, creator, needle]);

  const totalShown = groups.reduce((count, group) => count + group.items.length, 0) + archived.length;
  const activeCount = channels.filter((channel) => !channel.isArchived).length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-container-low">
      <div className="shrink-0 border-b border-surgical-steel px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Channels</h2>
          <span className="font-label text-[11px] text-fog-muted">{activeCount}</span>
        </div>

        <div className="relative mt-3">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-muted"
          />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter channels"
            aria-label="Filter channels by name"
            className="focus-ring h-10 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest pl-9 pr-9 text-base text-white placeholder:text-fog-muted sm:text-sm"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Clear channel filter"
              className="focus-ring absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Channel list" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {needle && totalShown === 0 && (
          <p className="px-3 py-6 text-center text-xs leading-5 text-fog-muted">
            No channel matches “{filter.trim()}”.
          </p>
        )}

        {groups.map(({ category, items }) => {
          const isCollapsed = Boolean(collapsed[category.id]) && !needle;
          const panelId = `channel-group-${category.id}`;

          return (
            <section key={category.id} className="mb-1">
              <h3>
                <button
                  type="button"
                  onClick={() => setCollapsed((current) => ({ ...current, [category.id]: !current[category.id] }))}
                  aria-expanded={!isCollapsed}
                  aria-controls={panelId}
                  className="focus-ring flex min-h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted transition hover:text-on-surface-variant"
                >
                  <ChevronRight
                    size={13}
                    aria-hidden="true"
                    className={`shrink-0 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                  />
                  <span className="truncate">{category.name}</span>
                  {category.isArchived && (
                    <span className="ml-auto shrink-0 font-label text-[10px] normal-case tracking-normal">
                      archived
                    </span>
                  )}
                </button>
              </h3>

              {!isCollapsed && (
                <ul id={panelId} className="mt-0.5 space-y-px">
                  {items.map((channel) => (
                    <li key={channel.id}>
                      <ChannelRow
                        channel={channel}
                        creator={creator}
                        routeBase={routeBase}
                        isActive={activeChannelId === channel.id}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="px-3 py-2 text-xs leading-5 text-fog-muted">No channels yet.</li>
                  )}
                </ul>
              )}
            </section>
          );
        })}

        {archived.length > 0 && (
          <section className="mt-3 border-t border-surgical-steel pt-3">
            <h3 className="flex min-h-9 items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
              <Archive size={13} aria-hidden="true" />
              Archived
            </h3>
            <ul className="mt-0.5 space-y-px">
              {archived.map((channel) => (
                <li key={channel.id}>
                  <ChannelRow
                    channel={channel}
                    creator={creator}
                    routeBase={routeBase}
                    isActive={activeChannelId === channel.id}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </nav>

      {creator && onManageClick && (
        <div className="shrink-0 border-t border-surgical-steel p-3">
          <button
            type="button"
            onClick={onManageClick}
            className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-surgical-steel bg-surface-container-high text-sm font-semibold text-white transition hover:border-primary-container hover:text-primary-container"
          >
            <Settings2 size={15} aria-hidden="true" />
            Manage structure
          </button>
        </div>
      )}
    </div>
  );
}

function ChannelRow({
  channel,
  creator,
  routeBase,
  isActive,
  onNavigate,
}: {
  channel: CommunityChannel;
  creator: boolean;
  routeBase: string;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const meta = channelMeta(channel.type);
  const Icon = meta.icon;

  if (channel.isLocked) {
    return (
      <div className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-fog-muted">
        <Lock size={14} aria-hidden="true" className="shrink-0 opacity-70" />
        <span className="truncate text-sm">{channel.name}</span>
        <span className="ml-auto shrink-0 rounded-full border border-surgical-steel px-2 py-0.5 font-label text-[11px] leading-4">
          {tierName(channel.minTier)}
        </span>
        <span className="sr-only">Locked. Reach {tierName(channel.minTier)} to unlock.</span>
      </div>
    );
  }

  return (
    <Link
      href={channelHref(routeBase, creator, channel.id)}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={channel.description ?? undefined}
      className={`focus-ring relative flex min-h-10 items-center gap-2 rounded-lg pl-3 pr-2 transition ${
        isActive
          ? "bg-surface-container-high font-semibold text-white"
          : "text-on-surface-variant hover:bg-surface-container-high/50 hover:text-white"
      } ${channel.isArchived ? "opacity-60" : ""}`}
    >
      {isActive && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-px bg-primary-container" />}
      <Icon
        size={14}
        aria-hidden="true"
        className={`shrink-0 ${isActive ? "text-primary-container" : "text-fog-muted"}`}
      />
      <span className="truncate text-sm">{channel.name}</span>
      {channel.minTier > 1 && (
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 font-label text-[11px] leading-4 ${
            isActive ? "border-primary-container/40 text-primary-container" : "border-surgical-steel text-fog-muted"
          }`}
        >
          {tierName(channel.minTier)}
        </span>
      )}
    </Link>
  );
}
