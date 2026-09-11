"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AtSign, ChevronDown, Hash, Lock, Menu, Pin } from "lucide-react";

import { deleteMessage, editMessage, togglePostHighlight, toggleReaction } from "@/app/community/actions";
import { ChannelSidebar } from "@/components/community/ChannelSidebar";
import { channelMeta, tierName } from "@/components/community/channel-meta";
import { MessageComposer } from "@/components/community/MessageComposer";
import { MessageStream } from "@/components/community/MessageStream";
import { StructureEditor } from "@/components/community/structure/StructureEditor";
import type { CommunityCategory, CommunityChannel, CommunityPost } from "@/components/community/types";
import { AppShell, type Notification } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";

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
        <StructureEditor
          variant="modal"
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
      const result = await editMessage(postId, body);
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
        const result = await deleteMessage(postId);
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
        : channel.canSend
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
          {channel.canSend ? (
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
              {/* Not "only staff": posting is a permission now, and who holds it
                  is the community's choice rather than a platform role. */}
              You do not have permission to post here. You can still react to any message.
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
