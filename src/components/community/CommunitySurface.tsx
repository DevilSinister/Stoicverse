"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AtSign,
  ChevronDown,
  ChevronLeft,
  FolderPlus,
  Hash,
  Loader2,
  Lock,
  Menu,
  Pin,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { deleteStaffPost, editStaffPost, togglePostHighlight, toggleReaction } from "@/app/community/actions";
import {
  deleteCommunityStructure,
  saveCategory,
  saveChannel,
  setCommunityStructureArchived,
} from "@/app/creator/channels/actions";
import { ChannelSidebar } from "@/components/community/ChannelSidebar";
import { CHANNEL_TYPES, channelMeta, channelSlug, tierName } from "@/components/community/channel-meta";
import { MessageComposer } from "@/components/community/MessageComposer";
import { MessageStream } from "@/components/community/MessageStream";
import type { CommunityCategory, CommunityChannel, CommunityPost } from "@/components/community/types";
import { AppShell, type Notification } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";

const TIERS = [1, 2, 3, 4, 5];
const ROLES = ["member", "moderator", "influencer"] as const;
const MENTION_PATTERN = /(@all\b|@tier-[1-5]\b)/i;

type Props = {
  workspace: "member" | "creator";
  currentUserId: string;
  memberName: string;
  platformRole: string;
  currentTier: number;
  isMaster: boolean;
  canModeratePosts: boolean;
  notifications: Notification[];
  routeBase: string;
  activeNavigationLabel: string;
  selectedChannelId?: string;
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  posts: CommunityPost[];
};

export function CommunitySurface({
  workspace,
  currentUserId,
  memberName,
  platformRole,
  currentTier,
  isMaster,
  canModeratePosts,
  notifications,
  routeBase,
  activeNavigationLabel,
  selectedChannelId,
  categories,
  channels,
  posts,
}: Props) {
  const creator = workspace === "creator";
  const [notice, setNotice] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [channelSheetOpen, setChannelSheetOpen] = useState(false);
  // Drafts live here so switching channels never discards what was typed.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const toastTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setNotice(null);
      toastTimer.current = null;
    }, 2600);
  }, []);

  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    if (!channelSheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChannelSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [channelSheetOpen]);

  const activeChannel =
    channels.find((channel) => channel.id === selectedChannelId && !channel.isLocked && !channel.isArchived) ??
    channels.find((channel) => !channel.isLocked && !channel.isArchived);

  const activeChannelId = activeChannel?.id;
  const activePosts = useMemo(
    () => posts.filter((post) => post.channelId === activeChannelId),
    [posts, activeChannelId],
  );

  return (
    <AppShell
      active={activeNavigationLabel}
      title={creator ? "Channels" : "Community"}
      memberName={memberName}
      platformRole={platformRole}
      currentTier={currentTier}
      isMaster={isMaster}
      notifications={notifications}
      routeBase={routeBase}
    >
      <main className="grid min-h-[calc(100dvh-4rem)] bg-surface md:min-h-screen lg:h-screen lg:grid-cols-[17rem_minmax(0,1fr)] lg:overflow-hidden">
        <div className="hidden border-r border-surgical-steel lg:block lg:h-screen">
          <ChannelSidebar
            categories={categories}
            channels={channels}
            creator={creator}
            activeChannelId={activeChannelId}
            routeBase={routeBase}
            onManageClick={creator ? () => setManageOpen(true) : undefined}
          />
        </div>

        <section className="min-w-0 bg-surface lg:h-full lg:overflow-hidden">
          <Feed
            channel={activeChannel}
            initialPosts={activePosts}
            canModeratePosts={canModeratePosts}
            currentUserId={currentUserId}
            memberName={memberName}
            platformRole={platformRole}
            draft={activeChannelId ? drafts[activeChannelId] ?? "" : ""}
            onDraftChange={(value) => {
              if (activeChannelId) setDrafts((current) => ({ ...current, [activeChannelId]: value }));
            }}
            onOpenChannels={() => setChannelSheetOpen(true)}
            onNotice={showNotice}
          />
        </section>
      </main>

      {channelSheetOpen && (
        <div className="fixed inset-0 z-[65] lg:hidden">
          <button
            type="button"
            aria-label="Close channel list"
            onClick={() => setChannelSheetOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Channels"
            className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col border-r border-surgical-steel"
          >
            <ChannelSidebar
              categories={categories}
              channels={channels}
              creator={creator}
              activeChannelId={activeChannelId}
              routeBase={routeBase}
              onManageClick={
                creator
                  ? () => {
                      setChannelSheetOpen(false);
                      setManageOpen(true);
                    }
                  : undefined
              }
              onNavigate={() => setChannelSheetOpen(false)}
            />
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-[75] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-surgical-steel bg-monolith-surface px-4 py-3 text-sm text-on-surface shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)]"
        >
          {notice}
        </div>
      )}

      {creator && manageOpen && (
        <ManageStructure
          categories={categories}
          channels={channels}
          onNotice={showNotice}
          onClose={() => setManageOpen(false)}
        />
      )}
    </AppShell>
  );
}

function Feed({
  channel,
  initialPosts,
  canModeratePosts,
  currentUserId,
  memberName,
  platformRole,
  draft,
  onDraftChange,
  onOpenChannels,
  onNotice,
}: {
  channel?: CommunityChannel;
  initialPosts: CommunityPost[];
  canModeratePosts: boolean;
  currentUserId: string;
  memberName: string;
  platformRole: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onOpenChannels: () => void;
  onNotice: (value: string) => void;
}) {
  const [seededPosts, setSeededPosts] = useState(initialPosts);
  const [seededChannelId, setSeededChannelId] = useState(channel?.id);
  const [posts, setPosts] = useState(initialPosts);
  const [view, setView] = useState<"all" | "pinned" | "mentions">("all");
  const [newCount, setNewCount] = useState(0);
  const [pending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  if (initialPosts !== seededPosts) {
    setSeededPosts(initialPosts);
    setPosts(initialPosts);
  }

  // Opening another channel starts unfiltered. Derived during render rather
  // than in an effect so the first paint of the new channel is already correct.
  if (channel?.id !== seededChannelId) {
    setSeededChannelId(channel?.id);
    setView("all");
  }

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    setNewCount(0);
  }, []);

  const channelId = channel?.id;
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToLatest("auto"));
    return () => cancelAnimationFrame(frame);
  }, [channelId, scrollToLatest]);

  useEffect(() => {
    if (!channelId) return;
    const live = supabase
      .channel(`community-posts:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as {
              id: string;
              channel_id: string;
              author_id: string | null;
              body: string | null;
              image_url: string | null;
              created_at: string;
              is_pinned: boolean;
            };

            const attachment =
              row.image_url && !row.image_url.startsWith("http")
                ? await supabase.storage.from("community-posts").createSignedUrl(row.image_url, 60 * 60)
                : null;
            const imageUrl = row.image_url?.startsWith("http") ? row.image_url : attachment?.data?.signedUrl ?? null;

            // The realtime payload carries no profile, so resolve the author
            // instead of labelling every arrival "Community staff".
            let authorName = "Deleted member";
            let authorRole: string | null = null;
            if (row.author_id === currentUserId) {
              authorName = memberName;
              authorRole = platformRole;
            } else if (row.author_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name,platform_role")
                .eq("id", row.author_id)
                .maybeSingle();
              authorName = profile?.full_name?.trim() || "Community staff";
              authorRole = profile?.platform_role ?? null;
            }

            setPosts((current) =>
              current.some((post) => post.id === row.id)
                ? current
                : [
                    ...current,
                    {
                      id: row.id,
                      channelId: row.channel_id,
                      authorId: row.author_id,
                      authorName,
                      authorRole,
                      body: row.body,
                      imageUrl,
                      createdAt: row.created_at,
                      isPinned: row.is_pinned,
                      reactions: [],
                    },
                  ],
            );

            if (atBottomRef.current) requestAnimationFrame(() => scrollToLatest());
            else setNewCount((count) => count + 1);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as { id: string; body: string | null; is_pinned: boolean; is_deleted: boolean };
            setPosts((current) =>
              row.is_deleted
                ? current.filter((post) => post.id !== row.id)
                : current.map((post) =>
                    post.id === row.id ? { ...post, body: row.body, isPinned: row.is_pinned } : post,
                  ),
            );
          }
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as {
          post_id?: string;
          emoji?: string;
          user_id?: string;
        };
        if (!row.post_id || !row.emoji) return;
        const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;
        if (!delta) return;
        // A self-echo would double-count the optimistic update already applied.
        if (row.user_id === currentUserId) return;

        setPosts((current) =>
          current.map((post) => {
            if (post.id !== row.post_id) return post;
            const emoji = row.emoji!;
            const existing = post.reactions.find((reaction) => reaction.emoji === emoji);
            if (!existing) {
              return delta > 0
                ? { ...post, reactions: [...post.reactions, { emoji, count: 1, userReacted: false }] }
                : post;
            }
            return {
              ...post,
              reactions: post.reactions
                .map((reaction) =>
                  reaction.emoji === emoji
                    ? { ...reaction, count: Math.max(0, reaction.count + delta) }
                    : reaction,
                )
                .filter((reaction) => reaction.count > 0 || reaction.userReacted),
            };
          }),
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(live);
    };
  }, [channelId, supabase, currentUserId, memberName, platformRole, scrollToLatest]);

  const react = useCallback(
    (postId: string, emoji: string) => {
      // Optimistic; the server action reports any rejection.
      setPosts((current) =>
        current.map((post) => {
          if (post.id !== postId) return post;
          const existing = post.reactions.find((reaction) => reaction.emoji === emoji);
          if (!existing) return { ...post, reactions: [...post.reactions, { emoji, count: 1, userReacted: true }] };
          return {
            ...post,
            reactions: post.reactions
              .map((reaction) =>
                reaction.emoji === emoji
                  ? {
                      ...reaction,
                      count: Math.max(0, reaction.count + (reaction.userReacted ? -1 : 1)),
                      userReacted: !reaction.userReacted,
                    }
                  : reaction,
              )
              .filter((reaction) => reaction.count > 0),
          };
        }),
      );

      void toggleReaction(postId, emoji).then((result) => {
        if (result.error) onNotice(result.error);
      });
    },
    [onNotice],
  );

  const saveEdit = useCallback(
    async (postId: string, body: string) => {
      const result = await editStaffPost(postId, body);
      if (result.error) {
        onNotice(result.error);
        return false;
      }
      setPosts((current) => current.map((post) => (post.id === postId ? { ...post, body } : post)));
      return true;
    },
    [onNotice],
  );

  const remove = useCallback(
    (postId: string) => {
      if (!window.confirm("Delete this message? Members will no longer see it.")) return;
      startTransition(async () => {
        const result = await deleteStaffPost(postId);
        if (result.error) onNotice(result.error);
        else setPosts((current) => current.filter((post) => post.id !== postId));
      });
    },
    [onNotice],
  );

  const togglePin = useCallback(
    (postId: string) => {
      startTransition(async () => {
        const result = await togglePostHighlight(postId);
        if (result.error) onNotice(result.error);
        else
          setPosts((current) =>
            current.map((post) => (post.id === postId ? { ...post, isPinned: !post.isPinned } : post)),
          );
      });
    },
    [onNotice],
  );

  const copy = useCallback(
    (_postId: string, body: string | null) => {
      if (!body) return;
      void navigator.clipboard.writeText(body).catch(() => onNotice("Your browser blocked the copy."));
    },
    [onNotice],
  );

  if (!channel) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <Hash className="text-fog-muted" size={22} aria-hidden="true" />
        <p className="text-sm font-semibold text-white">No channel is open</p>
        <p className="max-w-sm text-sm leading-6 text-fog-muted">
          Choose a channel to read its discussion. Locked channels unlock as your tier rises.
        </p>
        <button
          type="button"
          onClick={onOpenChannels}
          className="focus-ring mt-1 inline-flex min-h-10 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-white transition hover:border-primary-container lg:hidden"
        >
          <Menu size={15} aria-hidden="true" />
          Browse channels
        </button>
      </div>
    );
  }

  const pinnedCount = posts.filter((post) => post.isPinned).length;
  const mentionCount = posts.filter((post) => MENTION_PATTERN.test(post.body ?? "")).length;
  const visiblePosts =
    view === "pinned"
      ? posts.filter((post) => post.isPinned)
      : view === "mentions"
        ? posts.filter((post) => MENTION_PATTERN.test(post.body ?? ""))
        : posts;

  const ChannelIcon = channelMeta(channel.type).icon;

  const emptyMessage =
    view === "pinned"
      ? "No study prompts here yet. Mark a message as a study prompt to keep it at hand."
      : view === "mentions"
        ? "No message in this channel mentions the community or a tier."
        : canModeratePosts
          ? "Nothing here yet. Your first message starts the channel."
          : "Nothing here yet. Check back for studies and reflections.";

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="z-20 shrink-0 border-b border-surgical-steel bg-surface px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            type="button"
            onClick={onOpenChannels}
            aria-label="Browse channels"
            className="focus-ring grid size-10 shrink-0 place-items-center rounded-lg border border-surgical-steel text-fog-muted transition hover:text-white lg:hidden"
          >
            <Menu size={17} aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-base font-semibold text-white">
              <ChannelIcon size={16} aria-hidden="true" className="shrink-0 text-fog-muted" />
              <span className="truncate">{channel.name}</span>
              {channel.minTier > 1 && (
                <span className="shrink-0 rounded-full border border-surgical-steel px-2 py-0.5 font-label text-[11px] font-normal leading-4 text-fog-muted">
                  {tierName(channel.minTier)}
                </span>
              )}
            </h1>
            {channel.description && (
              <p className="mt-0.5 truncate text-xs leading-5 text-fog-muted">{channel.description}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Filter messages">
            <FilterChip
              active={view === "pinned"}
              onClick={() => setView(view === "pinned" ? "all" : "pinned")}
              icon={<Pin size={13} aria-hidden="true" />}
              label={`${pinnedCount}`}
              srLabel="Show only study prompts"
            />
            <FilterChip
              active={view === "mentions"}
              onClick={() => setView(view === "mentions" ? "all" : "mentions")}
              icon={<AtSign size={13} aria-hidden="true" />}
              label={`${mentionCount}`}
              srLabel="Show only messages with mentions"
            />
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          atBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 64;
          if (atBottomRef.current) setNewCount(0);
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6"
      >
        <div className="mx-auto max-w-4xl">
          <MessageStream
            posts={visiblePosts}
            currentUserId={currentUserId}
            canModeratePosts={canModeratePosts}
            pending={pending}
            onReact={react}
            onSaveEdit={saveEdit}
            onDelete={remove}
            onTogglePin={togglePin}
            onCopy={copy}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>

      {newCount > 0 && view === "all" && (
        <button
          type="button"
          onClick={() => scrollToLatest()}
          className="focus-ring absolute bottom-32 left-1/2 z-30 inline-flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-full border border-primary-container bg-monolith-surface px-4 text-sm font-semibold text-primary-container transition hover:bg-primary-container hover:text-on-primary-fixed"
        >
          <ChevronDown size={15} aria-hidden="true" />
          {newCount} new {newCount === 1 ? "message" : "messages"}
        </button>
      )}

      <div className="z-20 shrink-0 border-t border-surgical-steel bg-surface px-4 py-3 md:px-6">
        <div className="mx-auto max-w-4xl">
          {canModeratePosts ? (
            <MessageComposer
              channelId={channel.id}
              channelName={channel.name}
              draft={draft}
              onDraftChange={onDraftChange}
              onNotice={onNotice}
            />
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-surgical-steel bg-surface-container-low px-4 py-3 text-sm text-fog-muted">
              <Lock size={14} aria-hidden="true" className="shrink-0 text-primary-container" />
              Only staff publish here. You can still react to any message.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
  srLabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  srLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition ${
        active
          ? "border-primary-container bg-primary-container text-on-primary-fixed"
          : "border-surgical-steel text-fog-muted hover:border-fog-muted hover:text-white"
      }`}
    >
      {icon}
      <span className="font-label">{label}</span>
      <span className="sr-only">{srLabel}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Creator: name and organize the structure                            */
/* ------------------------------------------------------------------ */

type Selection =
  | { kind: "category"; id: string }
  | { kind: "channel"; id: string }
  | { kind: "new-category" }
  | { kind: "new-channel"; categoryId: string };

function ManageStructure({
  categories,
  channels,
  onNotice,
  onClose,
}: {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  onNotice: (value: string) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<Selection>(
    categories[0] ? { kind: "category", id: categories[0].id } : { kind: "new-category" },
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectedCategory =
    selection.kind === "category" ? categories.find((category) => category.id === selection.id) : undefined;
  const selectedChannel =
    selection.kind === "channel" ? channels.find((channel) => channel.id === selection.id) : undefined;
  const showEditorOnMobile = selection.kind !== "category" || Boolean(selectedCategory);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage channel structure"
      className="fixed inset-0 z-[70] sm:grid sm:place-items-center sm:p-4"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/75" />

      <div className="relative flex h-full w-full flex-col overflow-hidden border-surgical-steel bg-surface-container-low sm:h-[min(44rem,90vh)] sm:max-w-4xl sm:rounded-xl sm:border">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-surgical-steel px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white sm:text-lg">Channel structure</h2>
            <p className="mt-0.5 text-xs leading-5 text-fog-muted">
              Name, group, and gate every channel members can open.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring grid size-10 shrink-0 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
          <nav
            aria-label="Categories and channels"
            className={`min-h-0 overflow-y-auto border-surgical-steel p-2 md:block md:border-r ${
              showEditorOnMobile ? "hidden md:block" : "flex-1"
            }`}
          >
            {categories.map((category) => {
              const items = channels.filter((channel) => channel.categoryId === category.id);
              const isCurrent = selection.kind === "category" && selection.id === category.id;
              return (
                <div key={category.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: "category", id: category.id })}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`focus-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                      isCurrent ? "bg-surface-container-high text-white" : "text-fog-muted hover:text-on-surface-variant"
                    }`}
                  >
                    <span className="truncate">{category.name}</span>
                    {category.isArchived && (
                      <span className="ml-auto shrink-0 font-label text-[10px] normal-case tracking-normal">
                        archived
                      </span>
                    )}
                  </button>

                  <ul className="mt-0.5 space-y-px pl-2">
                    {items.map((channel) => {
                      const Icon = channelMeta(channel.type).icon;
                      const isActive = selection.kind === "channel" && selection.id === channel.id;
                      return (
                        <li key={channel.id}>
                          <button
                            type="button"
                            onClick={() => setSelection({ kind: "channel", id: channel.id })}
                            aria-current={isActive ? "true" : undefined}
                            className={`focus-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left transition ${
                              isActive
                                ? "bg-surface-container-high font-semibold text-white"
                                : "text-on-surface-variant hover:bg-surface-container-high/50"
                            } ${channel.isArchived ? "opacity-60" : ""}`}
                          >
                            <Icon size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />
                            <span className="truncate text-sm">{channel.name}</span>
                          </button>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        type="button"
                        onClick={() => setSelection({ kind: "new-channel", categoryId: category.id })}
                        className="focus-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-fog-muted transition hover:text-primary-container"
                      >
                        <Plus size={14} aria-hidden="true" className="shrink-0" />
                        Add channel
                      </button>
                    </li>
                  </ul>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setSelection({ kind: "new-category" })}
              className="focus-ring mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-surgical-steel text-sm font-semibold text-fog-muted transition hover:border-primary-container hover:text-primary-container"
            >
              <FolderPlus size={15} aria-hidden="true" />
              New category
            </button>
          </nav>

          <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${showEditorOnMobile ? "" : "hidden md:block"}`}>
            <button
              type="button"
              onClick={() => setSelection({ kind: "new-category" })}
              className="focus-ring mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-semibold text-fog-muted transition hover:text-white md:hidden"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              All categories
            </button>

            {selection.kind === "new-category" && (
              <StructureForm key="new-category" kind="category" onNotice={onNotice} />
            )}
            {selectedCategory && (
              <StructureForm
                key={selectedCategory.id}
                kind="category"
                category={selectedCategory}
                channelCount={channels.filter((channel) => channel.categoryId === selectedCategory.id).length}
                onNotice={onNotice}
                onDeleted={() => setSelection({ kind: "new-category" })}
              />
            )}
            {selection.kind === "new-channel" && (
              <StructureForm
                key={`new-channel-${selection.categoryId}`}
                kind="channel"
                categoryId={selection.categoryId}
                onNotice={onNotice}
              />
            )}
            {selectedChannel && (
              <StructureForm
                key={selectedChannel.id}
                kind="channel"
                categoryId={selectedChannel.categoryId}
                channel={selectedChannel}
                onNotice={onNotice}
                onDeleted={() => setSelection({ kind: "category", id: selectedChannel.categoryId })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StructureForm({
  kind,
  category,
  channel,
  categoryId,
  channelCount = 0,
  onNotice,
  onDeleted,
}: {
  kind: "category" | "channel";
  category?: CommunityCategory;
  channel?: CommunityChannel;
  categoryId?: string;
  channelCount?: number;
  onNotice: (value: string) => void;
  onDeleted?: () => void;
}) {
  const subject = kind === "category" ? category : channel;
  const [name, setName] = useState(subject?.name ?? "");
  const [type, setType] = useState<string>(channel?.type ?? "text");
  const [pending, startTransition] = useTransition();

  const meta = channelMeta(type);
  const slug = channelSlug(name);
  const isNew = !subject;

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = kind === "category" ? await saveCategory(data) : await saveChannel(data);
      if (result.error) {
        onNotice(result.error);
        return;
      }
      onNotice(`${kind === "category" ? "Category" : "Channel"} saved.`);
      if (isNew) setName("");
    });

  const setArchived = (archived: boolean) =>
    startTransition(async () => {
      const result = await setCommunityStructureArchived(kind, subject!.id, archived);
      onNotice(result.error ?? `${kind === "category" ? "Category" : "Channel"} ${archived ? "archived" : "restored"}.`);
    });

  const destroy = () =>
    startTransition(async () => {
      const result = await deleteCommunityStructure(kind, subject!.id);
      if (result.error) {
        onNotice(result.error);
        return;
      }
      onNotice(`${kind === "category" ? "Category" : "Channel"} deleted.`);
      onDeleted?.();
    });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white">{isNew ? `New ${kind}` : `Edit ${kind}`}</h3>
        <p className="mt-1 text-xs leading-5 text-fog-muted">
          {kind === "category"
            ? "A category groups channels in the sidebar and sets the default access for channels added to it."
            : meta.hint}
        </p>
      </div>

      <form action={submit} className="space-y-5">
        {kind === "category" ? (
          <input type="hidden" name="categoryId" value={category?.id ?? ""} />
        ) : (
          <>
            <input type="hidden" name="channelId" value={channel?.id ?? ""} />
            <input type="hidden" name="categoryId" value={categoryId ?? ""} />
          </>
        )}

        {kind === "channel" && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Type</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHANNEL_TYPES.map((option) => {
                const optionMeta = channelMeta(option);
                const OptionIcon = optionMeta.icon;
                return (
                  <label
                    key={option}
                    className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-container ${
                      type === option
                        ? "border-primary-container bg-primary-container/10 text-primary-container"
                        : "border-surgical-steel text-on-surface-variant hover:border-fog-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={option}
                      checked={type === option}
                      onChange={() => setType(option)}
                      className="sr-only"
                    />
                    <OptionIcon size={14} aria-hidden="true" />
                    {optionMeta.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label
            htmlFor="structure-name"
            className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted"
          >
            Name
          </label>
          <input
            id="structure-name"
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "category" ? "Foundations" : meta.namePlaceholder}
            className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none placeholder:text-fog-muted"
          />
          {kind === "channel" && (
            <p className="mt-2 min-h-5 text-xs leading-5 text-fog-muted">
              {slug ? (
                <>
                  Members will see{" "}
                  <span className="font-label text-primary-container">
                    {meta.prefix}
                    {slug}
                  </span>
                </>
              ) : (
                "Lowercase and hyphenated reads best in the sidebar."
              )}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="structure-description"
            className="block text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted"
          >
            Description <span className="font-normal normal-case tracking-normal">· optional</span>
          </label>
          <input
            id="structure-description"
            name="description"
            defaultValue={subject?.description ?? ""}
            placeholder={kind === "category" ? "What this group of channels covers." : meta.descriptionPlaceholder}
            className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white outline-none placeholder:text-fog-muted"
          />
        </div>

        <AccessFields rule={subject} />

        <div className="flex items-center justify-end border-t border-surgical-steel pt-4">
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-container px-5 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
          >
            {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
            {isNew ? `Create ${kind}` : "Save changes"}
          </button>
        </div>
      </form>

      {subject && (
        <div className="space-y-3 border-t border-surgical-steel pt-5">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-fog-muted">Availability</h4>
          <p className="text-xs leading-5 text-fog-muted">
            {subject.isArchived
              ? "Archived. Members cannot see it, and its history is kept."
              : "Live. Archiving hides it from members without deleting anything."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setArchived(!subject.isArchived)}
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-white transition hover:border-primary-container disabled:opacity-40"
            >
              <Settings2 size={15} aria-hidden="true" />
              {subject.isArchived ? "Restore" : "Archive"}
            </button>
            <button
              type="button"
              disabled={pending || (kind === "category" && channelCount > 0)}
              onClick={destroy}
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-error/40 px-4 text-sm font-semibold text-error transition hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete permanently
            </button>
          </div>
          {kind === "category" && channelCount > 0 && (
            <p className="text-xs leading-5 text-fog-muted">
              This category still holds {channelCount} {channelCount === 1 ? "channel" : "channels"}. Archive or delete
              them first.
            </p>
          )}
          {kind === "channel" && (
            <p className="text-xs leading-5 text-fog-muted">
              A channel that already has messages can only be archived.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AccessFields({ rule }: { rule?: { minTier: number; allowedRoles: string[]; visibilityMode: string } }) {
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
