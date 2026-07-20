"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  FileUp,
  Hash,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Smile,
  X,
  Megaphone,
  Calendar,
  Crown,
  Settings,
  FolderPlus,
} from "lucide-react";

import { createStaffPost, toggleReaction } from "@/app/community/actions";
import {
  deleteCommunityStructure,
  saveCategory,
  saveChannel,
  setCommunityStructureArchived,
} from "@/app/creator/channels/actions";
import { AppShell, type Notification } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";

export type CommunityCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  minTier: number;
  allowedRoles: string[];
  visibilityMode: "locked" | "hidden";
  isArchived: boolean;
};

export type CommunityChannel = {
  id: string;
  categoryId: string;
  name: string;
  type: string;
  description: string | null;
  sortOrder: number;
  minTier: number;
  allowedRoles: string[];
  visibilityMode: "locked" | "hidden";
  isArchived: boolean;
  isLocked: boolean;
};

export type CommunityPost = {
  id: string;
  channelId: string;
  authorName: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  isPinned: boolean;
  reactionCount: number;
};

const reactionOptions = ["👍", "❤️", "🔥", "💡"];
const tiers = [1, 2, 3, 4, 5];
const roles = ["member", "moderator", "influencer"] as const;

type Props = {
  workspace: "member" | "creator";
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

type ModalState =
  | { kind: "category"; category?: CommunityCategory }
  | { kind: "channel"; category: CommunityCategory; channel?: CommunityChannel }
  | null;

function tierName(tier: number) {
  return tier === 5 ? "Master" : `Tier ${tier}`;
}

function channelHref(routeBase: string, creator: boolean, channelId: string) {
  return `${routeBase}${creator ? "/channels" : "/community"}?channel=${channelId}`;
}

function ChannelList({
  categories,
  channels,
  creator,
  activeChannelId,
  routeBase,
  onManageClick,
}: {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  creator: boolean;
  activeChannelId?: string;
  routeBase: string;
  onManageClick?: () => void;
}) {
  return (
    <aside
      aria-label="Channel selector"
      className="flex flex-col h-full border-b border-surgical-steel bg-surface-container-low/30 lg:border-b-0 lg:border-r lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h2 className="font-headline text-sm font-bold text-white uppercase tracking-wider">Channels</h2>
          <p className="mt-1 text-xs text-fog-muted">Community study circles & updates.</p>
        </div>

        <div className="space-y-4">
          {categories
            .filter((category) => creator || !category.isArchived)
            .map((category) => {
              const items = channels.filter(
                (channel) => channel.categoryId === category.id && (creator || !channel.isArchived)
              );
              return (
                <section key={category.id} className="space-y-1">
                  <div className="mb-1.5 flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-[.14em] text-fog-muted/80">
                    <ChevronDown size={12} className="opacity-70" />
                    <span>{category.name}</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((channel) => {
                      const isActive = activeChannelId === channel.id;
                      const getIcon = () => {
                        switch (channel.type) {
                          case "announcements":
                            return <Megaphone size={14} className={isActive ? "text-primary-container" : "text-fog-muted/70"} />;
                          case "events":
                            return <Calendar size={14} className={isActive ? "text-primary-container" : "text-fog-muted/70"} />;
                          case "master":
                            return <Crown size={14} className={isActive ? "text-primary-container" : "text-fog-muted/70"} />;
                          default:
                            return <Hash size={14} className={isActive ? "text-primary-container" : "text-fog-muted/70"} />;
                        }
                      };

                      if (channel.isLocked) {
                        return (
                          <div
                            key={channel.id}
                            className="rounded-lg px-3 py-2 border border-dashed border-surgical-steel/20 bg-surface-container-lowest/30 text-fog-muted/60"
                          >
                            <div className="flex items-center gap-2 text-xs">
                              <Lock size={12} className="opacity-60" />
                              <span className="truncate">{channel.name}</span>
                              <span className="ml-auto text-[9px] border border-surgical-steel bg-surface-container-high px-1.5 py-0.5 rounded font-semibold">
                                {tierName(channel.minTier)}
                              </span>
                            </div>
                            <p className="ml-5 mt-1 text-[9px] text-fog-muted/40">Reach {tierName(channel.minTier)} to unlock.</p>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={channel.id}
                          href={channelHref(routeBase, creator, channel.id)}
                          className={`flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-xs transition duration-200 ${
                            isActive
                              ? "bg-primary-container/10 border border-primary-container/20 text-primary-container font-semibold"
                              : "text-on-surface-variant hover:bg-surface-container-high/40 hover:text-white"
                          }`}
                        >
                          {getIcon()}
                          <span className="truncate">{channel.name}</span>
                          {channel.minTier > 1 && (
                            <span className="ml-auto text-[9px] border border-primary-container/10 bg-primary-container/5 px-1 py-0.5 rounded text-primary-container/80">
                              {tierName(channel.minTier)}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      </div>

      {creator && onManageClick && (
        <div className="p-4 border-t border-surgical-steel bg-surface-container-low/50">
          <button
            onClick={onManageClick}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-surgical-steel bg-surface-container-high/30 hover:bg-surface-container-high hover:border-primary-container text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer"
          >
            <Settings size={14} className="text-primary-container" />
            <span>Manage Structure</span>
          </button>
        </div>
      )}
    </aside>
  );
}

function PostComposer({ channelId, onNotice }: { channelId: string; onNotice: (value: string) => void }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const form = new FormData();
      form.set("channelId", channelId);
      form.set("body", body);
      if (file) {
        if (file.size > 20 * 1024 * 1024) {
          onNotice("Attachments must be 20 MB or smaller.");
          return;
        }
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          onNotice("Sign in to post.");
          return;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${auth.user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("community-posts").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) {
          onNotice(uploadError.message);
          return;
        }
        form.set("attachmentPath", path);
      }
      const result = await createStaffPost(form);
      if (result.error) {
        onNotice(result.error);
        return;
      }
      setBody("");
      setFile(null);
      if (input.current) input.current.value = "";
      onNotice("Post published.");
    });
  };

  return (
    <form
      onSubmit={submit}
      className="border border-surgical-steel bg-surface-container-low rounded-xl overflow-hidden shadow-sm"
    >
      <label className="sr-only" htmlFor="staff-post">
        Post an update
      </label>
      <textarea
        id="staff-post"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={10000}
        className="block min-h-24 w-full resize-none bg-transparent p-4 text-xs text-white placeholder-fog-muted outline-none"
        placeholder="Share an update with your community…"
      />

      {file && (
        <div className="mx-4 mb-2 flex items-center justify-between border border-surgical-steel bg-surface-container-high/40 rounded px-3 py-1.5 text-[10px] text-fog-muted">
          <span className="truncate font-medium text-white">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (input.current) input.current.value = "";
            }}
            className="text-fog-muted hover:text-red-400 p-0.5 rounded transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-surface-container-high/50 border-t border-surgical-steel/40">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-fog-muted hover:text-white transition-colors">
          <FileUp size={14} className="text-primary-container" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">Attach media</span>
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          disabled={pending || (!body.trim() && !file)}
          className="inline-flex items-center gap-1.5 bg-primary-container px-4 py-2 rounded-full text-xs font-bold text-on-primary-fixed hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <Send size={12} />
          <span>{pending ? "Sending…" : "Send"}</span>
        </button>
      </div>
    </form>
  );
}

function Feed({
  channel,
  initialPosts,
  canModeratePosts,
  onNotice,
}: {
  channel?: CommunityChannel;
  initialPosts: CommunityPost[];
  canModeratePosts: boolean;
  onNotice: (value: string) => void;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => setPosts(initialPosts), [initialPosts]);

  useEffect(() => {
    if (!channel) return;
    const live = supabase
      .channel(`community-posts:${channel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `channel_id=eq.${channel.id}` }, async (payload) => {
        const row = payload.new as { id: string; channel_id: string; body: string | null; image_url: string | null; created_at: string; is_pinned: boolean };
        const attachment = row.image_url && !row.image_url.startsWith("http") ? await supabase.storage.from("community-posts").createSignedUrl(row.image_url, 60 * 60) : null;
        const imageUrl = row.image_url?.startsWith("http") ? row.image_url : attachment?.data?.signedUrl ?? null;
        setPosts((current) =>
          current.some((post) => post.id === row.id)
            ? current
            : [
                {
                  id: row.id,
                  channelId: row.channel_id,
                  authorName: "Community staff",
                  body: row.body,
                  imageUrl,
                  createdAt: row.created_at,
                  isPinned: row.is_pinned,
                  reactionCount: 0,
                },
                ...current,
              ]
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { post_id?: string };
        if (!row.post_id) return;
        const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;
        if (delta)
          setPosts((current) =>
            current.map((post) => (post.id === row.post_id ? { ...post, reactionCount: Math.max(0, post.reactionCount + delta) } : post))
          );
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(live);
    };
  }, [channel?.id, supabase]);

  const react = useCallback(
    (postId: string, emoji: string) => {
      void (async () => {
        const result = await toggleReaction(postId, emoji);
        if (result.error) {
          onNotice(result.error);
          return;
        }
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? { ...post, reactionCount: Math.max(0, post.reactionCount + (result.reactionAdded ? 1 : -1)) }
              : post
          )
        );
        setPickerFor(null);
      })();
    },
    [onNotice]
  );

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-surgical-steel/40 rounded-xl p-12 bg-surface-container-low/20">
        <Lock className="text-fog-muted opacity-50 mb-3" size={24} />
        <p className="text-sm font-semibold text-white">Select a channel</p>
        <p className="text-xs text-fog-muted mt-1">Unlock tiers to access premium Stoic study groups.</p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-200">
      <header className="border-b border-surgical-steel/60 pb-5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-primary-container/25 bg-primary-container/5 text-primary-container rounded">
            {channel.type}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold text-white tracking-tight"># {channel.name}</h1>
        {channel.description && <p className="mt-2 text-xs text-fog-muted leading-relaxed">{channel.description}</p>}
      </header>

      {canModeratePosts && <PostComposer channelId={channel.id} onNotice={onNotice} />}

      <div className="space-y-4">
        {posts.map((post) => {
          const isStaff =
            post.authorName === "Community staff" ||
            post.authorName.toLowerCase().includes("moderator") ||
            post.authorName.toLowerCase().includes("staff");

          return (
            <article
              key={post.id}
              className="border border-surgical-steel/40 bg-surface-container-low/60 rounded-xl p-5 hover:border-surgical-steel/80 transition-all duration-200 flex gap-4"
            >
              {/* Avatar Initial */}
              <div className="size-9 shrink-0 rounded-full bg-surface-container-high border border-surgical-steel flex items-center justify-center text-sm font-bold text-primary-container select-none">
                {post.authorName[0]?.toUpperCase() || "S"}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-white font-semibold">{post.authorName}</strong>
                    {isStaff && (
                      <span className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border border-primary-container/20 bg-primary-container/5 text-primary-container">
                        Staff
                      </span>
                    )}
                  </div>
                  <time className="text-[10px] text-fog-muted" dateTime={post.createdAt}>
                    {new Date(post.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>

                {post.body && <p className="text-xs text-on-surface/90 whitespace-pre-wrap leading-relaxed font-body">{post.body}</p>}

                {post.imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-surgical-steel max-w-md bg-surface-container-lowest/50 group">
                    <img src={post.imageUrl} alt="Attached media" className="max-h-72 w-full object-cover group-hover:scale-[1.01] transition-transform duration-300" />
                    <div className="flex items-center justify-between border-t border-surgical-steel/40 bg-surface-container-low/80 px-3 py-1.5">
                      <span className="text-[9px] text-fog-muted">Attached Media</span>
                      <a
                        href={post.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary-container hover:underline flex items-center gap-1 font-semibold"
                      >
                        <FileUp size={11} /> Open Original
                      </a>
                    </div>
                  </div>
                )}

                {/* Reactions and Actions */}
                <div className="relative mt-4 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPickerFor(pickerFor === post.id ? null : post.id)}
                    aria-label="Add reaction"
                    className="grid size-7 place-items-center rounded-full border border-surgical-steel/60 text-fog-muted hover:border-primary-container hover:text-primary-container transition-colors cursor-pointer"
                  >
                    <Smile size={14} />
                  </button>

                  {post.reactionCount > 0 && (
                    <button
                      type="button"
                      onClick={() => react(post.id, "👍")}
                      className="px-2.5 py-1 rounded-full border border-primary-container/20 bg-primary-container/5 hover:bg-primary-container/10 transition-colors flex items-center gap-1.5 text-[10px] text-primary-container font-semibold cursor-pointer"
                    >
                      <span>👍</span>
                      <span>{post.reactionCount}</span>
                    </button>
                  )}

                  {pickerFor === post.id && (
                    <div className="absolute left-0 bottom-8 z-20 flex gap-1 border border-surgical-steel bg-surface-container-high p-1 shadow-2xl rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
                      {reactionOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(post.id, emoji)}
                          className="grid size-8 place-items-center hover:bg-surface-container-lowest rounded transition-colors text-base cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {posts.length === 0 && (
          <p className="border border-dashed border-surgical-steel/40 rounded-xl p-12 text-center text-xs text-fog-muted bg-surface-container-low/10">
            No updates in this channel yet. Check back later for studies and reflections.
          </p>
        )}
      </div>
    </section>
  );
}

function AccessFields({ rule }: { rule?: CommunityCategory | CommunityChannel }) {
  const value = rule ?? {
    minTier: 1,
    allowedRoles: ["member", "moderator", "influencer"],
    visibilityMode: "locked",
  };
  return (
    <div className="grid gap-3 text-xs text-fog-muted sm:grid-cols-3">
      <label>
        Minimum tier
        <select name="minTier" defaultValue={value.minTier} className="mt-1 w-full bg-surface p-2 text-white border border-surgical-steel/40 rounded">
          {tiers.map((tier) => (
            <option key={tier} value={tier}>
              {tierName(tier)}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Allowed roles</legend>
        <div className="mt-1 space-y-1">
          {roles.map((role) => (
            <label key={role} className="mr-2 capitalize">
              <input
                name="allowedRoles"
                type="checkbox"
                value={role}
                defaultChecked={value.allowedRoles.includes(role)}
              />{" "}
              {role}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        When locked
        <select name="visibilityMode" defaultValue={value.visibilityMode} className="mt-1 w-full bg-surface p-2 text-white border border-surgical-steel/40 rounded">
          <option value="locked">Show tier lock</option>
          <option value="hidden">Hide channel</option>
        </select>
      </label>
    </div>
  );
}

function StructureModal({
  state,
  onClose,
  onNotice,
}: {
  state: Exclude<ModalState, null>;
  onClose: () => void;
  onNotice: (value: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const isCategory = state.kind === "category";
  const subject = isCategory ? state.category : state.channel;

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = isCategory ? await saveCategory(data) : await saveChannel(data);
      onNotice(result.error ?? `${isCategory ? "Category" : "Channel"} saved.`);
      if (!result.error) onClose();
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={subject ? `Edit ${isCategory ? "category" : "channel"}` : `Create ${isCategory ? "category" : "channel"}`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <form
        action={submit}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-auto border border-surgical-steel bg-surface-container-low p-6 shadow-2xl rounded-xl animate-in zoom-in-95 duration-200"
      >
        <div className="mb-5 flex items-center justify-between border-b border-surgical-steel/40 pb-3">
          <h2 className="text-base font-bold text-white">
            {subject ? "Edit" : "Create"} {isCategory ? "Category" : "Channel"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 hover:bg-surface-container-high rounded transition-colors text-fog-muted hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {isCategory ? (
          <input type="hidden" name="categoryId" value={state.category?.id ?? ""} />
        ) : (
          <>
            <input type="hidden" name="channelId" value={state.channel?.id ?? ""} />
            <input type="hidden" name="categoryId" value={state.category.id} />
          </>
        )}

        <div className="space-y-4">
          <label className="block text-xs text-fog-muted">
            Name
            <input
              required
              name="name"
              defaultValue={subject?.name ?? ""}
              className="mt-1 w-full bg-surface p-2 text-white border border-surgical-steel/40 rounded outline-none focus:border-primary-container"
            />
          </label>

          {!isCategory && (
            <label className="block text-xs text-fog-muted">
              Channel type
              <select
                name="type"
                defaultValue={(subject as CommunityChannel | undefined)?.type ?? "text"}
                className="mt-1 w-full bg-surface p-2 text-white border border-surgical-steel/40 rounded"
              >
                <option value="text">Text</option>
                <option value="announcements">Announcement</option>
                <option value="events">Event</option>
                <option value="master">Master</option>
              </select>
            </label>
          )}

          <label className="block text-xs text-fog-muted">
            Description
            <input
              name="description"
              defaultValue={subject?.description ?? ""}
              className="mt-1 w-full bg-surface p-2 text-white border border-surgical-steel/40 rounded outline-none focus:border-primary-container"
            />
          </label>

          <AccessFields rule={subject} />
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-surgical-steel/40 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-surgical-steel text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={pending}
            className="bg-primary-container px-5 py-2 rounded-full text-xs font-bold text-on-primary-fixed hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ManageChannelsModal({
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
  const creator = true;
  const [open, setOpen] = useState<string | null>(categories[0]?.id ?? null);
  const [modal, setModal] = useState<ModalState>(null);
  const [pending, startTransition] = useTransition();

  const archive = (kind: "category" | "channel", id: string, archived: boolean) =>
    startTransition(async () => {
      const result = await setCommunityStructureArchived(kind, id, archived);
      onNotice(result.error ?? `${kind === "category" ? "Category" : "Channel"} ${archived ? "archived" : "restored"}.`);
    });

  const remove = (kind: "category" | "channel", id: string) =>
    startTransition(async () => {
      const result = await deleteCommunityStructure(kind, id);
      onNotice(result.error ?? "Deleted.");
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage channels and categories"
      className="fixed inset-0 z-40 grid place-items-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col border border-surgical-steel bg-surface-container-low text-on-surface shadow-2xl rounded-xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <header className="flex items-center justify-between border-b border-surgical-steel px-6 py-4 bg-surface-container-high/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings size={18} className="text-primary-container" />
              Manage Channels & Categories
            </h2>
            <p className="text-xs text-fog-muted mt-0.5">Customize structure, layout, and tier-locked access.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal({ kind: "category" })}
              className="inline-flex items-center gap-1 bg-primary-container/10 border border-primary-container/20 px-3 py-1.5 rounded-full text-xs font-semibold text-primary-container hover:bg-primary-container/20 transition-all duration-200 cursor-pointer"
              aria-label="Create category"
            >
              <FolderPlus size={14} />
              <span>Add Category</span>
            </button>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {categories.map((category) => {
            const categoryChannels = channels.filter((channel) => channel.categoryId === category.id);
            const expanded = open === category.id;
            return (
              <div key={category.id} className="border border-surgical-steel rounded-lg bg-surface-container-lowest overflow-hidden transition-all duration-200">
                <div className="flex items-center justify-between p-3 bg-surface-container-high/20 border-b border-surgical-steel/40">
                  <button
                    className="flex items-center gap-2 text-left text-sm font-semibold text-white hover:text-primary-container transition-colors cursor-pointer"
                    onClick={() => setOpen(expanded ? null : category.id)}
                  >
                    <ChevronDown className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} size={16} />
                    <span>{category.name}</span>
                    {category.isArchived && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 font-semibold tracking-wider uppercase">
                        Archived
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setModal({ kind: "category", category })}
                      aria-label={`Edit ${category.name}`}
                      className="p-1.5 text-fog-muted hover:text-primary-container rounded hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setModal({ kind: "channel", category })}
                      aria-label={`Add channel to ${category.name}`}
                      className="p-1.5 text-fog-muted hover:text-primary-container rounded hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="p-3 space-y-2">
                    {categoryChannels.length === 0 ? (
                      <p className="text-xs text-fog-muted/60 text-center py-4">No channels in this category.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {categoryChannels.map((channel) => (
                          <div
                            key={channel.id}
                            className="flex items-center justify-between py-2 px-3 text-xs border border-surgical-steel/30 rounded bg-surface-container-low/40 hover:bg-surface-container-low transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {channel.type === "announcements" ? (
                                <Megaphone size={13} className="text-primary-container/80" />
                              ) : channel.type === "events" ? (
                                <Calendar size={13} className="text-primary-container/80" />
                              ) : channel.type === "master" ? (
                                <Crown size={13} className="text-primary-container/80" />
                              ) : (
                                <Hash size={13} className="text-primary-container/80" />
                              )}
                              <span className="font-medium text-white truncate">{channel.name}</span>
                              {channel.minTier > 1 && (
                                <span className="text-[9px] border border-primary-container/25 bg-primary-container/5 px-1.5 py-0.5 rounded text-primary-container/90">
                                  {tierName(channel.minTier)}
                                </span>
                              )}
                              {channel.isArchived && (
                                <span className="text-[8px] border border-red-500/25 bg-red-500/5 px-1.5 py-0.5 rounded text-red-400">
                                  Archived
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setModal({ kind: "channel", category, channel })}
                              aria-label={`Edit ${channel.name}`}
                              className="p-1 text-fog-muted hover:text-primary-container hover:bg-surface-container-high rounded transition-colors cursor-pointer"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 border-t border-surgical-steel/40 pt-2 text-[10px] font-semibold uppercase tracking-wider text-fog-muted">
                      <button
                        disabled={pending}
                        onClick={() => archive("category", category.id, !category.isArchived)}
                        className="px-2.5 py-1 border border-surgical-steel rounded hover:border-primary-container hover:text-white transition-colors cursor-pointer"
                      >
                        {category.isArchived ? "Restore Category" : "Archive Category"}
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => remove("category", category.id)}
                        className="px-2.5 py-1 border border-red-500/25 rounded hover:border-red-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Delete Category
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {modal && <StructureModal state={modal} onClose={() => setModal(null)} onNotice={onNotice} />}
    </div>
  );
}

export function CommunitySurface({
  workspace,
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
  const [isManageOpen, setIsManageOpen] = useState(false);

  const activeChannel =
    channels.find((channel) => channel.id === selectedChannelId && !channel.isLocked && !channel.isArchived) ??
    channels.find((channel) => !channel.isLocked && !channel.isArchived);

  const activePosts = posts.filter((post) => post.channelId === activeChannel?.id);

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
      <main className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[18rem_minmax(0,1fr)] bg-surface">
        <ChannelList
          categories={categories}
          channels={channels}
          creator={creator}
          activeChannelId={activeChannel?.id}
          routeBase={routeBase}
          onManageClick={() => setIsManageOpen(true)}
        />
        <section className="min-w-0 bg-surface p-4 md:p-8">
          {notice && (
            <p
              role="status"
              className="mx-auto mb-4 max-w-3xl border border-surgical-steel/60 p-3 text-xs text-on-surface-variant bg-surface-container-low/50 rounded-lg animate-in fade-in duration-200"
            >
              {notice}
            </p>
          )}
          <Feed
            channel={activeChannel}
            initialPosts={activePosts}
            canModeratePosts={canModeratePosts}
            onNotice={setNotice}
          />
        </section>
      </main>

      {creator && isManageOpen && (
        <ManageChannelsModal
          categories={categories}
          channels={channels}
          onNotice={setNotice}
          onClose={() => setIsManageOpen(false)}
        />
      )}
    </AppShell>
  );
}
