"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Loader2, MoreHorizontal, Paperclip, Pencil, Pin, Smile, Trash2 } from "lucide-react";

import { EmojiPicker } from "@/components/community/emoji/EmojiPicker";
import { staffLabel, type CommunityPost } from "@/components/community/types";

/** Consecutive messages from one author inside this window collapse under a
 *  single header, the way a spoken turn reads as one turn. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; post: CommunityPost; grouped: boolean };

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function buildRows(posts: CommunityPost[]): Row[] {
  const rows: Row[] = [];
  let previous: CommunityPost | null = null;

  for (const post of posts) {
    const startsDay = !previous || dayKey(previous.createdAt) !== dayKey(post.createdAt);
    if (startsDay) {
      rows.push({ kind: "day", key: `day-${dayKey(post.createdAt)}`, label: dayLabel(post.createdAt) });
    }

    const sameAuthor =
      previous !== null && (previous.authorId ?? previous.authorName) === (post.authorId ?? post.authorName);
    const withinWindow =
      previous !== null &&
      new Date(post.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS;
    // A pinned message owns a header strip, so it never joins a run and never
    // absorbs the message that follows it.
    const groupable = sameAuthor && withinWindow && !startsDay && !post.isPinned && !previous?.isPinned;

    rows.push({ kind: "message", key: post.id, post, grouped: groupable });
    previous = post;
  }

  return rows;
}

/** Renders mentions as chips and bare http(s) URLs as links. Everything else
 *  stays plain text — React escapes it, so no markup can be injected. */
function renderBody(text: string) {
  const pattern = /(@all\b|@tier-[1-5]\b)|(https?:\/\/[^\s<>()]+)/gi;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    if (match[1]) {
      nodes.push(
        <span
          key={`m-${match.index}`}
          className="rounded bg-primary-container/15 px-1 font-medium text-primary-container"
        >
          {match[1]}
        </span>,
      );
    } else if (match[2]) {
      nodes.push(
        <a
          key={`l-${match.index}`}
          href={match[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary-container underline underline-offset-2 hover:brightness-110"
        >
          {match[2]}
        </a>,
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

type Anchor = { left: number; top: number };

export function MessageStream({
  posts,
  currentUserId,
  canModeratePosts,
  pending,
  onReact,
  onSaveEdit,
  onDelete,
  onTogglePin,
  onCopy,
  emptyMessage,
}: {
  posts: CommunityPost[];
  currentUserId: string;
  canModeratePosts: boolean;
  pending: boolean;
  onReact: (postId: string, emoji: string) => void;
  onSaveEdit: (postId: string, body: string) => Promise<boolean>;
  onDelete: (postId: string) => void;
  onTogglePin: (postId: string) => void;
  onCopy: (postId: string, body: string | null) => void;
  emptyMessage: string;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<Anchor | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<Anchor | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  const rows = useMemo(() => buildRows(posts), [posts]);

  const closeOverlays = () => {
    setMenuFor(null);
    setMenuAnchor(null);
    setPickerFor(null);
    setPickerAnchor(null);
  };

  useEffect(() => {
    if (!menuFor && !pickerFor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOverlays();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuFor, pickerFor]);

  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);

  /** Both overlays are `fixed` so the message scroller's `overflow-y-auto`
   *  cannot clip them. */
  const place = (rect: DOMRect, width: number, height: number): Anchor => {
    const pad = 12;
    const left = Math.min(Math.max(pad, rect.right - width), window.innerWidth - width - pad);
    const openAbove = window.innerHeight - rect.bottom < height + pad && rect.top > height + pad;
    const top = openAbove ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - pad);
    return { left, top: Math.max(pad, top) };
  };

  const copy = (postId: string, body: string | null) => {
    onCopy(postId, body);
    setCopiedId(postId);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 2000);
    closeOverlays();
  };

  const saveEdit = async (postId: string) => {
    const next = editBody.trim();
    if (!next) return;
    if (await onSaveEdit(postId, next)) setEditingId(null);
  };

  if (posts.length === 0) {
    return (
      <p className="mx-auto max-w-md rounded-xl border border-dashed border-surgical-steel px-6 py-10 text-center text-sm leading-6 text-fog-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((row) => {
        if (row.kind === "day") {
          return (
            <div key={row.key} className="flex items-center gap-3 py-4">
              <span aria-hidden="true" className="h-px flex-1 bg-surgical-steel" />
              <span className="font-label text-[11px] uppercase tracking-[0.12em] text-fog-muted">{row.label}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-surgical-steel" />
            </div>
          );
        }

        const { post, grouped } = row;
        const isOwn = Boolean(post.authorId) && post.authorId === currentUserId;
        const isEditing = editingId === post.id;
        const badge = staffLabel(post.authorRole);
        const initial = post.authorName.trim()[0]?.toUpperCase() ?? "?";

        return (
          <article
            key={row.key}
            className={`group/post flex gap-3 ${grouped ? "mt-0.5" : "mt-4"} ${isOwn ? "flex-row-reverse" : ""}`}
          >
            <div className="w-9 shrink-0">
              {!grouped && (
                <span
                  aria-hidden="true"
                  className={`grid size-9 place-items-center rounded-full border text-sm font-semibold ${
                    isOwn
                      ? "border-primary-container/40 bg-primary-container/15 text-primary-container"
                      : "border-surgical-steel bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {initial}
                </span>
              )}
            </div>

            <div
              className={`flex min-w-0 max-w-[min(40rem,calc(100%-3rem))] flex-col ${
                isOwn ? "items-end" : "items-start"
              }`}
            >
              {!grouped && (
                <div
                  className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  <span className="text-sm font-semibold text-white">{post.authorName}</span>
                  {badge && (
                    <span className="rounded-full border border-surgical-steel px-2 py-0.5 text-[11px] leading-4 text-fog-muted">
                      {badge}
                    </span>
                  )}
                  {post.authorRoles?.map((role) => (
                    <span
                      key={role.id}
                      className="rounded-full border px-2 py-0.5 text-[11px] leading-4"
                      style={{ borderColor: role.color, color: role.color }}
                    >
                      {role.name}
                    </span>
                  ))}
                  <time className="font-label text-[11px] text-fog-muted" dateTime={post.createdAt}>
                    {clockTime(post.createdAt)}
                  </time>
                </div>
              )}

              <div
                className={`relative w-fit min-w-0 rounded-xl border px-3.5 py-2.5 ${
                  post.isPinned
                    ? "border-primary-container/45 bg-primary-container/10"
                    : isOwn
                      ? "border-primary-container/25 bg-primary-container/[0.07]"
                      : "border-surgical-steel bg-surface-container-high"
                }`}
              >
                {post.isPinned && (
                  <p className="mb-2 flex items-center gap-1.5 border-b border-primary-container/25 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-container">
                    <Pin size={12} aria-hidden="true" />
                    Study prompt
                  </p>
                )}

                {isEditing ? (
                  <div className="w-[min(32rem,60vw)] min-w-0">
                    <label htmlFor={`edit-${post.id}`} className="sr-only">
                      Edit message
                    </label>
                    <textarea
                      id={`edit-${post.id}`}
                      value={editBody}
                      autoFocus
                      onChange={(event) => setEditBody(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setEditingId(null);
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void saveEdit(post.id);
                        }
                      }}
                      rows={3}
                      className="focus-ring w-full resize-y rounded-lg border border-surgical-steel bg-surface-container-lowest p-2.5 text-base leading-6 text-white outline-none sm:text-sm"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="focus-ring min-h-9 rounded-lg px-3 text-sm font-semibold text-fog-muted transition hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={pending || !editBody.trim()}
                        onClick={() => void saveEdit(post.id)}
                        className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:opacity-40"
                      >
                        {pending && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {post.body && (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-on-surface">
                        {renderBody(post.body)}
                      </p>
                    )}

                    {post.imageUrl && (
                      <a
                        href={post.imageUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="focus-ring mt-2 block overflow-hidden rounded-lg border border-surgical-steel"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.imageUrl}
                          alt="Attachment"
                          loading="lazy"
                          className="max-h-80 w-full object-cover"
                        />
                        <span className="flex items-center gap-1.5 border-t border-surgical-steel bg-surface-container-lowest px-3 py-1.5 text-xs text-fog-muted">
                          <Paperclip size={12} aria-hidden="true" />
                          Open original
                        </span>
                      </a>
                    )}

                    {grouped && (
                      <time
                        dateTime={post.createdAt}
                        className={`pointer-events-none absolute top-2.5 hidden font-label text-[11px] text-fog-muted opacity-0 transition-opacity group-hover/post:opacity-100 lg:block ${
                          isOwn ? "right-full mr-3" : "left-full ml-3"
                        }`}
                      >
                        {clockTime(post.createdAt)}
                      </time>
                    )}
                  </>
                )}
              </div>

              <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                {post.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    onClick={() => onReact(post.id, reaction.emoji)}
                    aria-pressed={reaction.userReacted}
                    aria-label={`${reaction.emoji} ${reaction.count}`}
                    className={`focus-ring inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm transition ${
                      reaction.userReacted
                        ? "border-primary-container/50 bg-primary-container/15 text-primary-container"
                        : "border-surgical-steel text-fog-muted hover:border-fog-muted hover:text-white"
                    }`}
                  >
                    <span aria-hidden="true">{reaction.emoji}</span>
                    <span className="font-label text-[11px]">{reaction.count}</span>
                  </button>
                ))}

                <button
                  type="button"
                  aria-label="Add a reaction"
                  onClick={(event) => {
                    if (pickerFor === post.id) return closeOverlays();
                    closeOverlays();
                    setPickerAnchor(place(event.currentTarget.getBoundingClientRect(), 232, 132));
                    setPickerFor(post.id);
                  }}
                  className="focus-ring grid size-7 place-items-center rounded-full border border-surgical-steel text-fog-muted opacity-100 transition hover:border-fog-muted hover:text-white lg:opacity-0 lg:group-hover/post:opacity-100"
                >
                  <Smile size={13} aria-hidden="true" />
                </button>

                {!isEditing && (
                  <button
                    type="button"
                    aria-label="Message options"
                    aria-haspopup="menu"
                    aria-expanded={menuFor === post.id}
                    onClick={(event) => {
                      if (menuFor === post.id) return closeOverlays();
                      closeOverlays();
                      setMenuAnchor(place(event.currentTarget.getBoundingClientRect(), 208, 200));
                      setMenuFor(post.id);
                    }}
                    className="focus-ring grid size-7 place-items-center rounded-full border border-surgical-steel text-fog-muted opacity-100 transition hover:border-fog-muted hover:text-white lg:opacity-0 lg:group-hover/post:opacity-100"
                  >
                    <MoreHorizontal size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {(menuFor || pickerFor) && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeOverlays}
          className="fixed inset-0 z-[58] cursor-default"
        />
      )}

      {pickerFor && pickerAnchor && (
        <div style={pickerAnchor} className="fixed z-[59]">
          <EmojiPicker
            mode="react"
            onSelect={(selection) => {
              onReact(pickerFor, selection.kind === "unicode" ? selection.glyph : `<:${selection.name}:${selection.id}>`);
              closeOverlays();
            }}
            onClose={closeOverlays}
          />
        </div>
      )}

      {menuFor && menuAnchor && (
        <div
          role="menu"
          aria-label="Message options"
          style={menuAnchor}
          className="fixed z-[59] w-52 overflow-hidden rounded-xl border border-surgical-steel bg-monolith-surface p-1 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)]"
        >
          {(() => {
            const post = posts.find((candidate) => candidate.id === menuFor);
            if (!post) return null;
            return (
              <Fragment>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => copy(post.id, post.body)}
                  className="focus-ring flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-white"
                >
                  {copiedId === post.id ? (
                    <Check size={15} aria-hidden="true" className="text-primary-container" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {copiedId === post.id ? "Copied" : "Copy text"}
                </button>

                {canModeratePosts && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditingId(post.id);
                        setEditBody(post.body ?? "");
                        closeOverlays();
                      }}
                      className="focus-ring flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-white"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit message
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onTogglePin(post.id);
                        closeOverlays();
                      }}
                      className="focus-ring flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-on-surface-variant transition hover:bg-surface-container-high hover:text-white"
                    >
                      <Pin size={15} aria-hidden="true" />
                      {post.isPinned ? "Remove study prompt" : "Mark study prompt"}
                    </button>
                    <div className="my-1 h-px bg-surgical-steel" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeOverlays();
                        onDelete(post.id);
                      }}
                      className="focus-ring flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-error transition hover:bg-error/10"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Delete message
                    </button>
                  </>
                )}
              </Fragment>
            );
          })()}
        </div>
      )}
    </div>
  );
}
