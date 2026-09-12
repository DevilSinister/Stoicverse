"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";

import { sendChannelMessage } from "@/app/community/actions";
import { useCommunity, type ChannelRow } from "@/components/channels/CommunityProvider";
import { encodeMentions } from "@/lib/channels/mentions";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_PER_MESSAGE,
  isAllowedAttachmentType,
  MESSAGE_COUNTER_FROM,
  MESSAGE_MAX_CHARS,
} from "@/lib/community/constants";
import type { ChannelMessage } from "@/lib/community/messages";
import { createClient } from "@/lib/supabase/client";

/**
 * The message box.
 *
 * Two things it does that are worth stating:
 *
 *   * **It sends display text and stores ids.** `encodeMentions` turns the
 *     `@Ada` somebody typed into `<@uuid>` at the boundary, so renaming a
 *     member never breaks the message.
 *   * **It renders the message before the server confirms it.** The bubble
 *     carries a `clientNonce`, and the row that comes back over realtime
 *     carries the same one, which is how the two are reconciled instead of
 *     rendering twice. A refused message puts the draft back rather than
 *     losing what somebody typed.
 */

type PendingAttachment = { path: string; mimeType: string; byteSize: number; name: string };

export function Composer({
  channel,
  replyTo,
  onClearReply,
  onOptimistic,
  onSettled,
  onAttachmentUrl,
}: {
  channel: ChannelRow;
  replyTo: ChannelMessage | null;
  onClearReply: () => void;
  onOptimistic: (message: ChannelMessage) => void;
  onSettled: () => void;
  onAttachmentUrl: (path: string, url: string) => void;
}) {
  const { viewer, dictionary, affordances } = useCommunity();
  const permissions = affordances(channel.id);

  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const tooLong = body.length > MESSAGE_MAX_CHARS;
  const canSend = (body.trim() !== "" || attachments.length > 0) && !tooLong && !sending && !uploading;

  const attach = async (files: FileList | null) => {
    if (!files || files.length === 0 || !viewer) return;
    setError(null);

    if (attachments.length + files.length > ATTACHMENTS_PER_MESSAGE) {
      setError(`A message can carry at most ${ATTACHMENTS_PER_MESSAGE} attachments.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      // Checked here rather than through `accept=`, because drag-and-drop and
      // paste both bypass `accept` entirely.
      if (!isAllowedAttachmentType(file.type)) {
        setError(`${file.name} is not a file type this community allows.`);
        continue;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setError(`${file.name} is larger than 25 MB.`);
        continue;
      }

      // The upload policy reads the channel out of the path, so the path has
      // to carry it: {uid}/{channelId}/{file}.
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${viewer.userId}/${channel.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("community-posts").upload(path, file);
      if (uploadError) {
        setError(`${file.name} could not be uploaded.`);
        continue;
      }

      setAttachments((current) => [...current, { path, mimeType: file.type, byteSize: file.size, name: file.name }]);
      onAttachmentUrl(path, supabase.storage.from("community-posts").getPublicUrl(path).data.publicUrl);
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    if (!canSend || !viewer) return;
    setError(null);
    setSending(true);

    const clientNonce = crypto.randomUUID();
    const encoded = encodeMentions(body.trim(), dictionary);
    const sentAttachments = attachments;

    onOptimistic({
      id: `optimistic-${clientNonce}`,
      authorId: viewer.userId,
      authorName: viewer.profile?.fullName ?? "You",
      authorAvatar: viewer.profile?.avatarUrl ?? null,
      authorColor: viewer.roles[0]?.color ?? null,
      body: encoded,
      postType: "post",
      isPinned: false,
      createdAt: new Date().toISOString(),
      editedAt: null,
      clientNonce,
      replyToPostId: replyTo?.id ?? null,
      replyAuthorName: replyTo?.authorName ?? null,
      replyExcerpt: replyTo?.body?.slice(0, 140) ?? null,
      threadId: null,
      threadName: null,
      threadMessageCount: null,
      attachments: sentAttachments.map((attachment, index) => ({
        id: `optimistic-${index}`,
        path: attachment.path,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        width: null,
        height: null,
      })),
      reactions: [],
    });

    setBody("");
    setAttachments([]);
    onClearReply();

    const result = await sendChannelMessage({
      channelId: channel.id,
      body: encoded,
      replyToPostId: replyTo?.id,
      attachments: sentAttachments.map(({ path, mimeType, byteSize }) => ({ path, mimeType, byteSize })),
      clientNonce,
    });

    setSending(false);

    if (result.error) {
      // Put the draft back: losing what somebody typed because the send failed
      // is worse than the failure itself.
      setBody(encoded);
      setAttachments(sentAttachments);
      setError(result.error);
    } else if (result.blocked) {
      setError(result.blocked);
    }

    onSettled();
  };

  return (
    <div className="border-t border-surgical-steel px-4 py-3">
      {replyTo ? (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-1.5 text-xs text-fog-muted">
          <span className="truncate">{`Replying to ${replyTo.authorName}`}</span>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="focus-ring ml-auto rounded p-0.5 hover:text-on-surface"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.path}
              className="flex items-center gap-2 rounded-lg border border-surgical-steel px-2 py-1 text-xs text-on-surface-variant"
            >
              <span className="max-w-40 truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((current) => current.filter((entry) => entry.path !== attachment.path))}
                aria-label={`Remove ${attachment.name}`}
                className="focus-ring rounded p-0.5 hover:text-on-surface"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2 rounded-xl border border-surgical-steel bg-surface-container-lowest px-3 py-2">
        {permissions.canAttach ? (
          <>
            <input ref={fileRef} type="file" multiple hidden onChange={(event) => void attach(event.target.files)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Attach a file"
              className="focus-ring shrink-0 rounded-lg p-1.5 text-fog-muted hover:text-on-surface disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Paperclip size={16} aria-hidden="true" />
              )}
            </button>
          </>
        ) : null}

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter is a newline — the convention every chat
            // client shares, and the one people's hands already know.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={`Message #${channel.name}`}
          aria-label={`Message ${channel.name}`}
          className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-sm leading-6 text-on-surface outline-none placeholder:text-fog-muted"
        />

        <button
          type="button"
          onClick={() => void send()}
          disabled={!canSend}
          className="focus-ring shrink-0 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-semibold text-monolith-surface disabled:opacity-40"
        >
          {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Send"}
        </button>
      </div>

      <div className="mt-1 flex items-center gap-3">
        {body.length >= MESSAGE_COUNTER_FROM ? (
          <span className={`text-[11px] ${tooLong ? "text-red-300" : "text-fog-muted"}`}>
            {`${body.length.toLocaleString("en-US")} / ${MESSAGE_MAX_CHARS.toLocaleString("en-US")}`}
          </span>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
