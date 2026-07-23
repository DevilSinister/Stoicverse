"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ChevronDown,
  FileUp,
  Hash,
  Lock,
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
  AtSign,
  BookOpen,
  ImagePlus,
  MoreHorizontal,
  Paperclip,
  Pin,
  Copy,
  Check,
  Bell,
} from "lucide-react";

import { createStaffPost, toggleReaction, editStaffPost, deleteStaffPost, togglePostHighlight } from "@/app/community/actions";
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
  reactions: { emoji: string; count: number; userReacted: boolean }[];
};

const reactionOptions = ["👍", "❤️", "🔥", "💡", "👏", "🎉", "🚀", "👀", "😮", "😢", "💯", "🙏"];
const tiers = [1, 2, 3, 4, 5];
const roles = ["member", "moderator", "influencer"] as const;

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
      className="flex flex-col h-full border-b border-surgical-steel bg-surface-container-low/30 lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:h-screen overflow-hidden"
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
                          draggable={creator}
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

function renderFormattedBody(text: string | null) {
  if (!text) return null;
  const mentionRegex = /(@all|@tier-[1-5]|@[a-zA-Z0-9_-]+)/gi;
  const parts = text.split(mentionRegex);

  return parts.map((part, index) => {
    if (part.match(/^(@all|@tier-[1-5]|@[a-zA-Z0-9_-]+)$/i)) {
      const lower = part.toLowerCase();
      const isAll = lower === "@all";
      const isTier = lower.startsWith("@tier-");
      return (
        <span
          key={index}
          className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded text-[11px] mx-0.5 select-none shadow-sm ${
            isAll
              ? "bg-primary-container/20 border border-primary-container/50 text-primary-container"
              : isTier
              ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
              : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
          }`}
        >
          <AtSign size={10} className="inline opacity-80" />
          {part.slice(1)}
        </span>
      );
    }
    return part;
  });
}

function PostComposer({ channelId, onNotice }: { channelId: string; onNotice: (value: string) => void }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const addMention = (mention: string) => {
    setBody((current) => {
      const trimmed = current.trimEnd();
      const endsWithAt = trimmed.endsWith("@");
      const base = endsWithAt ? trimmed.slice(0, -1) : trimmed;
      return `${base}${base && !base.endsWith(" ") ? " " : ""}${mention} `;
    });
    setShowMentionPopup(false);
    textareaRef.current?.focus();
  };

  const addEmoji = (emoji: string) => {
    setBody((current) => `${current}${emoji}`);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    if (val.endsWith("@")) {
      setShowMentionPopup(true);
    } else if (showMentionPopup && !val.includes("@")) {
      setShowMentionPopup(false);
    }
  };

  const submitForm = () => {
    if (!body.trim() && !file) return;
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
      setShowMentionPopup(false);
      setShowEmojiPicker(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onNotice("Message published to community.");
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitForm();
    }
  };

  const mentionOptions = [
    { label: "@all", desc: "Notify all community members" },
    { label: "@tier-1", desc: "Notify Tier 1 (Initiate) members" },
    { label: "@tier-2", desc: "Notify Tier 2 (Practitioner) members" },
    { label: "@tier-3", desc: "Notify Tier 3 (Scholar) members" },
    { label: "@tier-4", desc: "Notify Tier 4 (Philosopher) members" },
    { label: "@tier-5", desc: "Notify Tier 5 (Sage / Master) members" },
  ];

  return (
    <div className="relative w-full">
      {showMentionPopup && (
        <div className="absolute left-0 bottom-full mb-3 z-50 w-72 border border-surgical-steel bg-surface-container-high/95 p-1.5 shadow-2xl rounded-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between border-b border-surgical-steel/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fog-muted">
            <span className="flex items-center gap-1"><AtSign size={12} className="text-primary-container" /> Select Mention Target</span>
            <button type="button" onClick={() => setShowMentionPopup(false)} className="text-fog-muted hover:text-white p-0.5"><X size={12} /></button>
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto p-1">
            {mentionOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => addMention(opt.label)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-primary-container/15 hover:text-white group cursor-pointer"
              >
                <span className="font-bold text-primary-container">{opt.label}</span>
                <span className="text-[10px] text-fog-muted group-hover:text-white/80">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute right-12 bottom-full mb-3 z-50 grid grid-cols-6 gap-1 border border-surgical-steel bg-surface-container-high p-2 shadow-2xl rounded-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 w-[220px]">
          {reactionOptions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="grid size-8 place-items-center hover:bg-surface-container-lowest rounded-lg text-lg transition-colors cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitForm();
        }}
        className="flex flex-col border border-surgical-steel/80 bg-surface-container-low/95 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md transition-all focus-within:border-primary-container/60"
      >
        {file && (
          <div className="flex items-center gap-3 border-b border-surgical-steel/40 bg-surface-container-high/60 px-4 py-2">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="size-10 rounded-lg object-cover border border-primary-container/30" />
            ) : (
              <Paperclip size={18} className="text-primary-container" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{file.name}</p>
              <p className="text-[10px] text-fog-muted">{(file.size / (1024 * 1024)).toFixed(2)} MB attachment</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="p-1 rounded-full text-fog-muted hover:text-red-400 hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 p-2.5 sm:p-3">
          <label
            title="Attach image or media"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-high/70 border border-surgical-steel/60 text-fog-muted hover:text-primary-container hover:border-primary-container/50 hover:bg-surface-container-high transition-all cursor-pointer select-none"
          >
            <Plus size={20} className="text-primary-container" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <textarea
            ref={textareaRef}
            id="chat-post"
            value={body}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            maxLength={10000}
            rows={1}
            disabled={pending}
            className="flex-1 min-h-[42px] max-h-32 bg-surface-container-lowest/80 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-fog-muted outline-none border border-surgical-steel/40 focus:border-primary-container/60 focus:ring-1 focus:ring-primary-container/20 transition-all resize-none font-body leading-relaxed"
            placeholder="Write a message or study prompt… (Type @ to mention)"
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji reactions"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-high/70 border border-surgical-steel/60 text-fog-muted hover:text-amber-300 hover:border-amber-500/50 transition-all cursor-pointer"
          >
            <Smile size={18} />
          </button>

          <button
            type="button"
            onClick={() => setShowMentionPopup(!showMentionPopup)}
            title="Mention members or tiers"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-high/70 border border-surgical-steel/60 text-fog-muted hover:text-primary-container hover:border-primary-container/50 transition-all cursor-pointer"
          >
            <AtSign size={18} />
          </button>

          <button
            type="submit"
            disabled={pending || (!body.trim() && !file)}
            title="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-fixed hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-md"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

function Feed({
  channel,
  initialPosts,
  canModeratePosts,
  onNotice,
  currentUserId,
}: {
  channel?: CommunityChannel;
  initialPosts: CommunityPost[];
  canModeratePosts: boolean;
  onNotice: (value: string) => void;
  currentUserId: string;
}) {
  const [prevInitialPosts, setPrevInitialPosts] = useState(initialPosts);
  const [posts, setPosts] = useState(initialPosts);
  const [onlyMentions, setOnlyMentions] = useState(false);
  const [showPinned, setShowPinned] = useState(false);

  if (initialPosts !== prevInitialPosts) {
    setPrevInitialPosts(initialPosts);
    setPosts(initialPosts);
  }

  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const longPressTimer = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const scrollToLatest = () => {
    messageScrollRef.current?.scrollTo({ top: messageScrollRef.current.scrollHeight, behavior: "smooth" });
    setNewMessageCount(0);
  };

  const closeMessageMenu = () => {
    setMenuFor(null);
    setMenuPosition(null);
  };

  const openMessageMenu = (
    postId: string,
    anchor: { top: number; right: number; bottom: number; left: number }
  ) => {
    const menuWidth = 192;
    const menuHeight = 280;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - anchor.bottom - viewportPadding;
    const spaceAbove = anchor.top - viewportPadding;
    const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const left = Math.min(Math.max(viewportPadding, anchor.right - menuWidth), window.innerWidth - menuWidth - viewportPadding);
    const top = openAbove
      ? Math.max(viewportPadding, anchor.top - Math.min(menuHeight, spaceAbove))
      : Math.min(anchor.bottom + 8, window.innerHeight - viewportPadding - Math.min(menuHeight, Math.max(spaceBelow, 140)));

    setMenuFor(postId);
    setMenuPosition({ left, top });
  };

  useEffect(() => {
    setNewMessageCount(0);
    requestAnimationFrame(() => messageScrollRef.current?.scrollTo({ top: messageScrollRef.current?.scrollHeight ?? 0 }));
  }, [channel?.id]);

  useEffect(() => {
    if (!channel) return;
    const live = supabase
      .channel(`community-posts:${channel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `channel_id=eq.${channel.id}` }, async (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as { id: string; channel_id: string; body: string | null; image_url: string | null; created_at: string; is_pinned: boolean };
          const attachment = row.image_url && !row.image_url.startsWith("http") ? await supabase.storage.from("community-posts").createSignedUrl(row.image_url, 60 * 60) : null;
          const imageUrl = row.image_url?.startsWith("http") ? row.image_url : attachment?.data?.signedUrl ?? null;
          setPosts((current) =>
            current.some((post) => post.id === row.id)
              ? current
              : [
                  ...current,
                  {
                    id: row.id,
                    channelId: row.channel_id,
                    authorName: "Community staff",
                    body: row.body,
                    imageUrl,
                    createdAt: row.created_at,
                    isPinned: row.is_pinned,
                    reactions: [],
                  },
                ]
          );
          if (isAtBottomRef.current) requestAnimationFrame(scrollToLatest);
          else setNewMessageCount((count) => count + 1);
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as { id: string; body: string | null; is_deleted: boolean };
          if (row.is_deleted) {
            setPosts((current) => current.filter((post) => post.id !== row.id));
          } else {
            setPosts((current) =>
              current.map((post) => (post.id === row.id ? { ...post, body: row.body } : post))
            );
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { post_id?: string; emoji?: string; user_id?: string };
        if (!row.post_id || !row.emoji) return;

        const isSelf = row.user_id === currentUserId;
        const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;

        if (delta) {
          setPosts((current) =>
            current.map((post) => {
              if (post.id !== row.post_id) return post;
              const emoji = row.emoji!;
              const exists = post.reactions.find((r) => r.emoji === emoji);
              let updatedReactions;
              if (exists) {
                if (payload.eventType === "INSERT") {
                  updatedReactions = post.reactions.map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + 1, userReacted: r.userReacted || isSelf }
                      : r
                  );
                } else {
                  updatedReactions = post.reactions
                    .map((r) =>
                      r.emoji === emoji
                        ? { ...r, count: Math.max(0, r.count - 1), userReacted: isSelf ? false : r.userReacted }
                        : r
                    )
                    .filter((r) => r.count > 0);
                }
              } else {
                if (payload.eventType === "INSERT") {
                  updatedReactions = [...post.reactions, { emoji, count: 1, userReacted: isSelf }];
                } else {
                  updatedReactions = post.reactions;
                }
              }
              return { ...post, reactions: updatedReactions };
            })
          );
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(live);
    };
  }, [channel, supabase, currentUserId]);

  const react = useCallback(
    (postId: string, emoji: string) => {
      void (async () => {
        const result = await toggleReaction(postId, emoji);
        if (result.error) {
          onNotice(result.error);
          return;
        }
        setPosts((current) =>
          current.map((post) => {
            if (post.id !== postId) return post;
            const exists = post.reactions.find((r) => r.emoji === emoji);
            let updatedReactions;
            if (exists) {
              if (exists.userReacted) {
                updatedReactions = post.reactions
                  .map((r) => (r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), userReacted: false } : r))
                  .filter((r) => r.count > 0);
              } else {
                updatedReactions = post.reactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r
                );
              }
            } else {
              updatedReactions = [...post.reactions, { emoji, count: 1, userReacted: true }];
            }
            return { ...post, reactions: updatedReactions };
          })
        );
        setPickerFor(null);
      })();
    },
    [onNotice]
  );

  const copyText = (postId: string, text: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPostId(postId);
    onNotice("Message copied to clipboard.");
    setTimeout(() => setCopiedPostId(null), 2000);
    closeMessageMenu();
  };

  const startEdit = (post: CommunityPost) => {
    setEditingPostId(post.id);
    setEditBody(post.body || "");
  };

  const saveEdit = async (postId: string) => {
    if (!editBody.trim()) return;
    startTransition(async () => {
      const result = await editStaffPost(postId, editBody);
      if (result.error) {
        onNotice(result.error);
      } else {
        setPosts((current) =>
          current.map((post) => (post.id === postId ? { ...post, body: editBody.trim() } : post))
        );
        setEditingPostId(null);
      }
    });
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    startTransition(async () => {
      const result = await deleteStaffPost(postId);
      if (result.error) {
        onNotice(result.error);
      } else {
        setPosts((current) => current.filter((post) => post.id !== postId));
      }
    });
  };

  const toggleHighlight = (postId: string) => {
    startTransition(async () => {
      const result = await togglePostHighlight(postId);
      if (result.error) onNotice(result.error);
      else setPosts((current) => current.map((post) => (post.id === postId ? { ...post, isPinned: !post.isPinned } : post)));
      closeMessageMenu();
    });
  };

  const startLongPress = (postId: string, anchor: DOMRect) => {
    longPressTimer.current = window.setTimeout(() => openMessageMenu(postId, anchor), 400);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center border border-dashed border-surgical-steel/40 rounded-xl p-12 bg-surface-container-low/20">
        <Lock className="text-fog-muted opacity-50 mb-3" size={24} />
        <p className="text-sm font-semibold text-white">Select a channel</p>
        <p className="text-xs text-fog-muted mt-1">Unlock tiers to access premium Stoic study groups.</p>
      </div>
    );
  }

  const displayedPosts = showPinned
    ? posts.filter((post) => post.isPinned)
    : onlyMentions
      ? posts.filter((post) => post.body?.toLowerCase().includes("@"))
      : posts;
  const pinnedCount = posts.filter((post) => post.isPinned).length;

  return (
    <section className="relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-4 md:px-6 animate-in fade-in duration-200">
      <header className="z-20 flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-surgical-steel/60 bg-surface py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white"># {channel.name}</h1>
          {channel.description && <p className="truncate text-[11px] text-fog-muted">{channel.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => { setShowPinned(!showPinned); setOnlyMentions(false); }} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition ${showPinned ? "border-primary-container bg-primary-container text-on-primary-fixed" : "border-surgical-steel text-fog-muted hover:border-primary-container hover:text-primary-container"}`} aria-pressed={showPinned}>
            <Pin size={13} /> {pinnedCount} pinned
          </button>
          <button type="button" onClick={() => { setOnlyMentions(!onlyMentions); setShowPinned(false); }} className={`grid min-h-9 min-w-9 place-items-center rounded-full border transition ${onlyMentions ? "border-primary-container bg-primary-container text-on-primary-fixed" : "border-surgical-steel text-fog-muted hover:border-primary-container hover:text-primary-container"}`} aria-label="Show messages containing mentions" aria-pressed={onlyMentions}><AtSign size={13} /></button>
        </div>
      </header>

      <div ref={messageScrollRef} onScroll={(event) => { const target = event.currentTarget; isAtBottomRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 48; if (isAtBottomRef.current) setNewMessageCount(0); closeMessageMenu(); }} className="flex-1 space-y-4 overflow-y-auto py-4">
        {displayedPosts.map((post) => {
          const isStaff =
            post.authorName === "Community staff" ||
            post.authorName.toLowerCase().includes("moderator") ||
            post.authorName.toLowerCase().includes("staff");

          const isEditing = editingPostId === post.id;

          return (
            <article
              key={post.id}
              onContextMenu={(event) => {
                event.preventDefault();
                openMessageMenu(post.id, {
                  top: event.clientY,
                  right: event.clientX,
                  bottom: event.clientY,
                  left: event.clientX,
                });
              }}
              onPointerDown={(event) => {
                if (event.pointerType === "touch") startLongPress(post.id, event.currentTarget.getBoundingClientRect());
              }}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              className="flex gap-3 items-start max-w-3xl group/post select-none"
            >
              <div className="size-10 shrink-0 rounded-full bg-surface-container-high border border-primary-container/30 flex items-center justify-center text-sm font-bold text-primary-container shadow-sm select-none">
                {post.authorName[0]?.toUpperCase() || "S"}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={`rounded-2xl rounded-tl-none px-4 py-3 shadow-lg relative group/bubble min-w-[260px] transition-all duration-200 ${
                    post.isPinned
                      ? "border-2 border-primary-container/70 bg-gradient-to-r from-primary-container/15 via-surface-container-high/90 to-surface-container-low text-white shadow-[0_0_25px_rgba(167,229,197,0.15)]"
                      : "bg-emerald-950/25 border border-emerald-500/20 text-white"
                  }`}
                >
                  {post.isPinned && (
                    <div className="mb-3 flex items-center gap-2 border-b border-primary-container/30 pb-2 text-[10px] font-bold uppercase tracking-wider text-primary-container">
                      <Pin size={13} className="animate-pulse" />
                      <span>STUDY PROMPT • HIGHLIGHTED BY CREATOR</span>
                    </div>
                  )}

                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(event) => {
                        if (menuFor === post.id) closeMessageMenu();
                        else openMessageMenu(post.id, event.currentTarget.getBoundingClientRect());
                      }}
                      className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white opacity-100 sm:opacity-0 sm:group-hover/bubble:opacity-100 cursor-pointer"
                      aria-label="Message options"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}

                  {menuFor === post.id && !isEditing && (
                    <div
                      className="fixed z-40 max-h-[calc(100dvh-1.5rem)] w-48 overflow-y-auto overscroll-contain rounded-xl border border-surgical-steel bg-surface-container-high p-1.5 shadow-lg animate-in fade-in duration-150"
                      role="menu"
                      style={menuPosition ?? undefined}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      {canModeratePosts ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              startEdit(post);
                              closeMessageMenu();
                            }}
                            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-on-surface-variant hover:bg-surface-container-lowest hover:text-white"
                            role="menuitem"
                          >
                            <Pencil size={13} className="text-emerald-400" /> Edit message
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHighlight(post.id)}
                            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-on-surface-variant hover:bg-surface-container-lowest hover:text-white"
                            role="menuitem"
                          >
                            <Pin size={13} className="text-primary-container" /> {post.isPinned ? "Remove highlight" : "Make study prompt (Highlight)"}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(post.id, post.body)}
                            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-on-surface-variant hover:bg-surface-container-lowest hover:text-white"
                            role="menuitem"
                          >
                            <Copy size={13} className="text-fog-muted" /> Copy text
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeMessageMenu();
                              handleDelete(post.id);
                            }}
                            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-red-300 hover:bg-red-950/40"
                            role="menuitem"
                          >
                            <X size={13} className="text-red-400" /> Delete message
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => copyText(post.id, post.body)}
                            className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-on-surface-variant hover:bg-surface-container-lowest hover:text-white"
                            role="menuitem"
                          >
                            {copiedPostId === post.id ? <Check size={13} className="text-primary-container" /> : <Copy size={13} />} Copy text
                          </button>
                        </>
                      )}
                      <div className="border-t border-surgical-steel/40 mt-1 pt-1">
                        <p className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fog-muted">Quick React</p>
                        <div className="flex flex-wrap gap-1 px-1 pb-1">
                          {reactionOptions.slice(0, 6).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                react(post.id, emoji);
                                closeMessageMenu();
                              }}
                              className="grid size-7 place-items-center rounded-lg text-sm hover:bg-surface-container-lowest transition-colors cursor-pointer"
                              aria-label={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-emerald-400">{post.authorName}</span>
                    {isStaff && (
                      <span className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-sm">
                        Staff
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mt-1">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        disabled={pending}
                        className="w-full bg-surface-container-lowest border border-emerald-500/40 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 resize-y min-h-[70px]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setEditingPostId(null)}
                          className="px-3 py-1 text-[10px] uppercase font-bold text-fog-muted hover:text-white rounded transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => saveEdit(post.id)}
                          className="px-3 py-1 text-[10px] uppercase font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                        >
                          {pending ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    post.body && (
                      <div className="text-xs text-on-surface/95 whitespace-pre-wrap leading-relaxed font-body">
                        {renderFormattedBody(post.body)}
                      </div>
                    )
                  )}

                  {post.imageUrl && !isEditing && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/20 max-w-md bg-surface-container-lowest/60 group/image">
                      <img
                        src={post.imageUrl}
                        alt="Attached media"
                        className="max-h-80 w-full object-cover group-hover/image:scale-[1.01] transition-transform duration-300"
                      />
                      <div className="flex items-center justify-between border-t border-emerald-500/10 bg-emerald-950/30 px-3 py-1.5">
                        <span className="text-[9px] text-emerald-300/70 font-medium">Attached Media</span>
                        <a
                          href={post.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <FileUp size={11} /> Open Original
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end items-center gap-1.5 mt-2">
                    <time className="text-[9px] text-emerald-300/40 font-mono" dateTime={post.createdAt}>
                      {new Date(post.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>

                <div className="relative mt-2 flex flex-wrap items-center gap-1.5 px-1">
                  {post.reactions &&
                    post.reactions.length > 0 &&
                    post.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => react(post.id, r.emoji)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${
                          r.userReacted
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm"
                            : "bg-surface-container-high/40 border-surgical-steel/60 text-fog-muted hover:text-white hover:border-surgical-steel"
                        }`}
                      >
                        <span>{r.emoji}</span>
                        <span className="text-[10px]">{r.count}</span>
                      </button>
                    ))}

                  <button
                    type="button"
                    onClick={() => setPickerFor(pickerFor === post.id ? null : post.id)}
                    aria-label="Add reaction"
                    className="grid size-6 place-items-center rounded-full border border-surgical-steel/60 text-fog-muted hover:border-emerald-500/50 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <Smile size={12} />
                  </button>

                  {pickerFor === post.id && (
                    <div className="absolute left-0 bottom-8 z-30 grid grid-cols-6 gap-1 border border-surgical-steel bg-surface-container-high p-1.5 shadow-2xl rounded-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 w-[210px]">
                      {reactionOptions.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(post.id, emoji)}
                          className="grid size-7 place-items-center hover:bg-surface-container-lowest rounded-lg transition-colors text-base cursor-pointer"
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

        <div ref={messagesEndRef} />

        {displayedPosts.length === 0 && (
          <p className="border border-dashed border-surgical-steel/40 rounded-2xl p-12 text-center text-xs text-fog-muted bg-surface-container-low/10">
            {showPinned ? "No pinned messages in this channel." : onlyMentions ? "No messages containing @ mentions in this channel." : "No updates in this channel yet. Check back later for studies and reflections."}
          </p>
        )}
      </div>

      {newMessageCount > 0 && !showPinned && !onlyMentions && (
        <button type="button" onClick={scrollToLatest} className="absolute bottom-24 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary-container bg-surface-container-high px-3 py-2 text-xs font-semibold text-primary-container shadow-lg transition hover:bg-primary-container hover:text-on-primary-fixed">
          <ChevronDown size={15} /> {newMessageCount} new {newMessageCount === 1 ? "message" : "messages"}
        </button>
      )}

      <div className="z-30 shrink-0 border-t border-surgical-steel/60 bg-surface py-3">
        {canModeratePosts ? (
          <PostComposer channelId={channel.id} onNotice={onNotice} />
        ) : (
          <div className="flex items-center justify-center gap-2 border border-surgical-steel/60 bg-surface-container-low/90 backdrop-blur-md rounded-2xl px-4 py-3 text-xs text-fog-muted font-medium shadow-lg">
            <Lock size={14} className="text-primary-container" />
            <span>Read-only channel • Only staff can publish study prompts & announcements. Members can react above.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function AccessFields({ rule }: { rule?: { minTier: number; allowedRoles: string[]; visibilityMode: string } }) {
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
              Manage categories and channels
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
  const [isManageOpen, setIsManageOpen] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);

    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => {
      setNotice(null);
      toastTimer.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

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
      <main className="grid min-h-[calc(100dvh-4rem)] bg-surface md:min-h-screen lg:h-screen lg:overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ChannelList
          categories={categories}
          channels={channels}
          creator={creator}
          activeChannelId={activeChannel?.id}
          routeBase={routeBase}
          onManageClick={() => setIsManageOpen(true)}
        />
        <section className="min-w-0 bg-surface lg:h-full lg:overflow-hidden">
          <Feed
            channel={activeChannel}
            initialPosts={activePosts}
            canModeratePosts={canModeratePosts}
            onNotice={showNotice}
            currentUserId={currentUserId}
          />
        </section>
      </main>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-primary-container/40 bg-surface-container-high px-4 py-3 text-sm text-on-surface shadow-lg animate-in fade-in duration-200"
        >
          {notice}
        </div>
      )}

      {creator && isManageOpen && (
        <ManageChannelsModal
          categories={categories}
          channels={channels}
          onNotice={showNotice}
          onClose={() => setIsManageOpen(false)}
        />
      )}
    </AppShell>
  );
}
