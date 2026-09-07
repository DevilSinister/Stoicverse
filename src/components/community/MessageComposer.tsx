"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { AtSign, Loader2, Paperclip, SendHorizontal, Smile, X } from "lucide-react";

import { createStaffPost } from "@/app/community/actions";
import { REACTION_OPTIONS } from "@/components/community/types";
import { createClient } from "@/lib/supabase/client";

const MAX_BODY = 10_000;
const COUNTER_FROM = 8_000;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const MENTIONS = [
  { label: "@all", detail: "Everyone in the community" },
  { label: "@tier-1", detail: "Tier 1 · Initiate" },
  { label: "@tier-2", detail: "Tier 2 · Practitioner" },
  { label: "@tier-3", detail: "Tier 3 · Scholar" },
  { label: "@tier-4", detail: "Tier 4 · Philosopher" },
  { label: "@tier-5", detail: "Tier 5 · Sage / Master" },
];

type MentionTrigger = { start: number; query: string };

/** Finds an in-progress `@mention` immediately before the caret. Returns null
 *  unless the `@` opens a word and nothing after it is whitespace, so an email
 *  address or a mid-word `@` never opens the menu. */
function mentionTriggerAt(value: string, caret: number): MentionTrigger | null {
  const upToCaret = value.slice(0, caret);
  const start = upToCaret.lastIndexOf("@");
  if (start < 0) return null;
  if (start > 0 && !/\s/.test(upToCaret[start - 1])) return null;
  const query = upToCaret.slice(start + 1);
  if (/\s/.test(query)) return null;
  return { start, query };
}

export function MessageComposer({
  channelId,
  channelName,
  draft,
  onDraftChange,
  onNotice,
}: {
  channelId: string;
  channelName: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onNotice: (value: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState<MentionTrigger | null>(null);
  const [activeMention, setActiveMention] = useState(0);
  const [pending, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const dragDepth = useRef(0);
  const listboxId = useId();

  const previewUrl = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return MENTIONS.filter((option) => option.label.slice(1).toLowerCase().startsWith(query));
  }, [mention]);

  const mentionOpen = Boolean(mention) && suggestions.length > 0;

  // Auto-grow: reset to auto first so the box shrinks again when text is deleted.
  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [draft]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (emojiRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) return;
      setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [emojiOpen]);

  const attach = useCallback(
    (candidate: File | null | undefined) => {
      if (!candidate) return;
      if (candidate.size > MAX_ATTACHMENT_BYTES) {
        onNotice("Attachments must be 20 MB or smaller.");
        return;
      }
      setFile(candidate);
    },
    [onNotice],
  );

  const clearAttachment = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const writeValue = (next: string, caret: number) => {
    onDraftChange(next);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  };

  const applyMention = (label: string) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, mention.start)}${label} ${draft.slice(caret)}`;
    setMention(null);
    writeValue(next, mention.start + label.length + 1);
  };

  const insertEmoji = (emoji: string) => {
    const caret = textareaRef.current?.selectionStart ?? draft.length;
    setEmojiOpen(false);
    writeValue(`${draft.slice(0, caret)}${emoji}${draft.slice(caret)}`, caret + emoji.length);
  };

  const submit = () => {
    const body = draft.trim();
    if ((!body && !file) || pending) return;

    startTransition(async () => {
      const form = new FormData();
      form.set("channelId", channelId);
      form.set("body", body);

      if (file) {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          onNotice("Your session expired. Sign in and try again.");
          return;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${auth.user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("community-posts")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          onNotice("The attachment could not be uploaded. Try again.");
          return;
        }
        form.set("attachmentPath", path);
      }

      const result = await createStaffPost(form);
      if (result.error) {
        onNotice(result.error);
        return;
      }
      onDraftChange("");
      clearAttachment();
      setMention(null);
      setEmojiOpen(false);
      textareaRef.current?.focus();
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveMention((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMention((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyMention(suggestions[activeMention].label);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === "Escape" && emojiOpen) {
      event.preventDefault();
      setEmojiOpen(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    onDraftChange(next);
    // Reset the highlight here rather than in an effect: the query only ever
    // changes as a result of this event.
    setActiveMention(0);
    setMention(mentionTriggerAt(next, event.target.selectionStart ?? next.length));
  };

  const openMentionMenu = () => {
    const node = textareaRef.current;
    const caret = node?.selectionStart ?? draft.length;
    const needsSpace = caret > 0 && !/\s$/.test(draft.slice(0, caret));
    const insert = `${needsSpace ? " " : ""}@`;
    const nextCaret = caret + insert.length;
    onDraftChange(`${draft.slice(0, caret)}${insert}${draft.slice(caret)}`);
    setActiveMention(0);
    setMention({ start: nextCaret - 1, query: "" });
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const remaining = MAX_BODY - draft.length;
  const canSend = Boolean(draft.trim() || file) && !pending;

  return (
    <div
      className="relative"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        attach(event.dataTransfer.files?.[0]);
      }}
    >
      {mentionOpen && (
        <div className="absolute bottom-full left-0 z-[55] mb-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-surgical-steel bg-monolith-surface shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)]">
          <p className="border-b border-surgical-steel px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
            Notify
          </p>
          <ul role="listbox" id={listboxId} aria-label="Mention suggestions" className="max-h-56 overflow-y-auto p-1">
            {suggestions.map((option, index) => (
              <li key={option.label}>
                <button
                  type="button"
                  role="option"
                  id={`${listboxId}-${index}`}
                  aria-selected={index === activeMention}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => applyMention(option.label)}
                  onMouseMove={() => setActiveMention(index)}
                  className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left transition ${
                    index === activeMention ? "bg-surface-container-high text-white" : "text-on-surface-variant"
                  }`}
                >
                  <span className="font-label text-[13px] text-primary-container">{option.label}</span>
                  <span className="truncate text-xs text-fog-muted">{option.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {emojiOpen && (
        <div
          ref={emojiRef}
          className="absolute bottom-full left-0 z-[55] mb-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-surgical-steel bg-monolith-surface p-2 shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)]"
        >
          <div className="grid grid-cols-6 gap-1">
            {REACTION_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                aria-label={`Insert ${emoji}`}
                className="focus-ring grid size-9 place-items-center rounded-lg text-lg transition hover:bg-surface-container-high"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={`overflow-hidden rounded-xl border bg-surface-container-low transition-colors ${
          isDragging ? "border-primary-container" : "border-surgical-steel focus-within:border-primary-container/60"
        }`}
      >
        {file && (
          <div className="flex items-center gap-3 border-b border-surgical-steel px-3 py-2">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="size-10 shrink-0 rounded-lg border border-surgical-steel object-cover"
              />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-surgical-steel text-fog-muted">
                <Paperclip size={16} aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">{file.name}</span>
              <span className="block font-label text-[11px] text-fog-muted">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </span>
            <button
              type="button"
              onClick={clearAttachment}
              aria-label={`Remove attachment ${file.name}`}
              className="focus-ring grid size-9 shrink-0 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <label htmlFor="community-composer" className="sr-only">
          Write a message in {channelName}
        </label>
        <textarea
          ref={textareaRef}
          id="community-composer"
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
          onPaste={(event) => {
            const pasted = event.clipboardData.files?.[0];
            if (pasted) {
              event.preventDefault();
              attach(pasted);
            }
          }}
          maxLength={MAX_BODY}
          rows={1}
          disabled={pending}
          role="combobox"
          aria-expanded={mentionOpen}
          aria-controls={mentionOpen ? listboxId : undefined}
          aria-activedescendant={mentionOpen ? `${listboxId}-${activeMention}` : undefined}
          aria-autocomplete="list"
          placeholder={`Message ${channelName}`}
          className="block max-h-[200px] w-full resize-none bg-transparent px-3.5 py-3 text-base leading-6 text-white outline-none placeholder:text-fog-muted disabled:opacity-60"
        />

        <div className="flex items-center gap-1 border-t border-surgical-steel px-2 py-2">
          <label
            title="Attach an image or video"
            className="grid size-10 cursor-pointer place-items-center rounded-lg text-fog-muted transition hover:bg-surface-container-high hover:text-white"
          >
            <Paperclip size={17} aria-hidden="true" />
            <span className="sr-only">Attach an image or video</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(event) => attach(event.target.files?.[0])}
            />
          </label>

          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setEmojiOpen((open) => !open)}
            aria-expanded={emojiOpen}
            aria-label="Insert emoji"
            className={`focus-ring grid size-10 place-items-center rounded-lg transition hover:bg-surface-container-high hover:text-white ${
              emojiOpen ? "bg-surface-container-high text-white" : "text-fog-muted"
            }`}
          >
            <Smile size={17} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={openMentionMenu}
            aria-label="Mention a tier or the whole community"
            className="focus-ring grid size-10 place-items-center rounded-lg text-fog-muted transition hover:bg-surface-container-high hover:text-white"
          >
            <AtSign size={17} aria-hidden="true" />
          </button>

          <p className="ml-2 hidden min-w-0 flex-1 truncate text-xs text-fog-muted sm:block">
            <kbd className="font-label">Enter</kbd> to send · <kbd className="font-label">Shift</kbd>+
            <kbd className="font-label">Enter</kbd> for a new line
          </p>

          <span className="flex-1 sm:hidden" />

          {draft.length >= COUNTER_FROM && (
            <span
              aria-live="polite"
              className={`mr-1 shrink-0 font-label text-[11px] ${remaining < 0 ? "text-error" : "text-fog-muted"}`}
            >
              {remaining.toLocaleString()}
            </span>
          )}

          <button
            type="submit"
            disabled={!canSend}
            className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-semibold text-on-primary-fixed transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? (
              <Loader2 size={16} aria-hidden="true" className="animate-spin" />
            ) : (
              <SendHorizontal size={16} aria-hidden="true" />
            )}
            {pending ? "Sending" : "Send"}
          </button>
        </div>
      </form>

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl border border-primary-container bg-surface-container-lowest/90">
          <p className="text-sm font-semibold text-primary-container">Drop to attach</p>
        </div>
      )}
    </div>
  );
}
