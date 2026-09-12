"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, SendHorizontal, Smile, X } from "lucide-react";

import { sendChannelMessage } from "@/app/community/actions";
import { useCommunity, type ChannelRow } from "@/components/channels/CommunityProvider";
import { VoiceRecorder, type Recording } from "@/components/channels/VoiceRecorder";
import { EmojiPicker } from "@/components/community/emoji/EmojiPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { encodeMentions } from "@/lib/channels/mentions";
import { emojiToken } from "@/lib/community/emojis";
import { signAttachmentUrls } from "@/lib/channels/attachment-urls";
import { resolveShortcut } from "@/lib/channels/shortcuts";
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

type PendingAttachment = {
  path: string;
  mimeType: string;
  byteSize: number;
  name: string;
  /** Set for a voice note, so the bubble can show its length before it loads. */
  durationSeconds?: number;
};

export function Composer({
  channel,
  replyTo,
  threadId = null,
  placeholder,
  mentionSeed,
  onClearReply,
  onOptimistic,
  onSettled,
  onAttachmentUrl,
  onEditLast,
}: {
  channel: ChannelRow;
  replyTo: ChannelMessage | null;
  /** Set when this composer sits in a thread panel rather than under the channel. */
  threadId?: string | null;
  placeholder?: string;
  /**
   * A name to drop in from the member list. Carries an `at` stamp because
   * mentioning the same person twice in a row is a real thing to do, and a
   * bare name would look unchanged the second time.
   */
  mentionSeed?: { name: string; at: number } | null;
  onClearReply: () => void;
  /**
   * Up arrow on an empty box edits your last message. The composer is the
   * only thing that knows the box is empty, and the list is the only thing
   * that knows which message was yours, so the two halves meet here.
   */
  onEditLast?: () => void;
  onOptimistic: (message: ChannelMessage) => void;
  onSettled: () => void;
  onAttachmentUrl: (path: string, url: string) => void;
}) {
  const { viewer, dictionary, affordances, announceTyping, emojis } = useCommunity();
  const permissions = affordances(channel.id);
  const label = placeholder ?? `Message #${channel.name}`;
  // Every failure here is a toast. Rendered under the box, a refused upload
  // grew the composer and shoved the conversation up by a line — a message
  // about a problem should not create a second one.
  const notify = useToast();

  const [body, setBody] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  // True while the recorder owns the composer row.
  const [recorderActive, setRecorderActive] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Adjusting state during render on a changed prop, which is React's own
  // documented shape for exactly this — and the only one that satisfies both
  // rules here: a ref may not be read or written during render, and setState
  // may not be called synchronously from an effect.
  //
  // Appended rather than replacing: clicking a member halfway through a
  // sentence means "and also mention them", not "start again".
  const [seenSeed, setSeenSeed] = useState(0);
  if (mentionSeed && mentionSeed.at !== seenSeed) {
    setSeenSeed(mentionSeed.at);
    setBody((current) => (current === "" ? `@${mentionSeed.name} ` : `${current.trimEnd()} @${mentionSeed.name} `));
  }

  const tooLong = body.length > MESSAGE_MAX_CHARS;
  const canSend = (body.trim() !== "" || attachments.length > 0) && !tooLong && !sending && !uploading;

  const attach = async (files: FileList | null) => {
    if (!files || files.length === 0 || !viewer) return;

    if (attachments.length + files.length > ATTACHMENTS_PER_MESSAGE) {
      notify(`A message can carry at most ${ATTACHMENTS_PER_MESSAGE} attachments.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      // Checked here rather than through `accept=`, because drag-and-drop and
      // paste both bypass `accept` entirely.
      if (!isAllowedAttachmentType(file.type)) {
        notify(`${file.name} is not a file type this community allows.`);
        continue;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        notify(`${file.name} is larger than 25 MB.`);
        continue;
      }

      // The upload policy reads the channel out of the path, so the path has
      // to carry it: {uid}/{channelId}/{file}.
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${viewer.userId}/${channel.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("community-posts").upload(path, file);
      if (uploadError) {
        notify(`${file.name} could not be uploaded.`);
        continue;
      }

      setAttachments((current) => [...current, { path, mimeType: file.type, byteSize: file.size, name: file.name }]);
      // Signed, not public: the bucket is private, and a public URL here gave
      // the sender a broken preview of the image they had just uploaded.
      const signed = await signAttachmentUrls(supabase, [path]);
      const href = signed.get(path);
      if (href) onAttachmentUrl(path, href);
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  /**
   * Upload a finished recording and send it, in one movement.
   *
   * Deliberately the same path as a picked file — same bucket, same
   * `{uid}/{channel}/` prefix the upload policy reads, same signing — because
   * a voice note is an attachment and nothing downstream should have to know
   * where it came from. What differs is the ending: it goes straight out
   * rather than landing in the draft, because finishing a recording *is* the
   * decision to send it, and the bin in the recorder is the other answer.
   */
  const uploadRecording = async (recording: Recording) => {
    if (!viewer) return;
    setUploading(true);

    const extension = recording.mimeType.includes("mp4") ? "m4a" : recording.mimeType.includes("ogg") ? "ogg" : "webm";
    const path = `${viewer.userId}/${channel.id}/${crypto.randomUUID()}-voice.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("community-posts")
      .upload(path, recording.blob, { contentType: recording.mimeType });

    if (uploadError) {
      setUploading(false);
      notify("That recording could not be uploaded.");
      return;
    }

    const attachment: PendingAttachment = {
      path,
      mimeType: recording.mimeType,
      byteSize: recording.blob.size,
      name: `Voice note (${Math.round(recording.durationSeconds)}s)`,
      durationSeconds: Number(recording.durationSeconds.toFixed(1)),
    };

    // Signed before the send rather than after it, so the bubble that appears
    // can be played straight away instead of waiting for the next refresh.
    const signed = await signAttachmentUrls(supabase, [path]);
    const href = signed.get(path);
    if (href) onAttachmentUrl(path, href);

    setUploading(false);
    // A refused send puts it back into the draft as an ordinary attachment,
    // which is exactly where retrying it belongs.
    await send([attachment]);
  };

  /**
   * Drop an emoji where the caret is, not at the end.
   *
   * Somebody who has clicked back into the middle of a sentence to add a
   * smiley means it to land there. The caret is then put after what was
   * inserted, so typing continues from the right place rather than jumping to
   * the end of the line.
   */
  const insertAtCaret = (text: string) => {
    const field = textRef.current;
    if (!field) {
      setBody((current) => current + text);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? start;
    setBody(body.slice(0, start) + text + body.slice(end));
    // After React has written the new value; setting it now would be undone by
    // the re-render that follows.
    requestAnimationFrame(() => {
      field.focus();
      const caret = start + text.length;
      field.setSelectionRange(caret, caret);
    });
  };

  // What the trailing button is for: with nothing drafted it stays a
  // microphone, and the moment there is a word or a file it becomes Send.
  const hasDraft = body.trim() !== "" || attachments.length > 0;

  /**
   * @param extraAttachments Uploaded outside the draft — today, a finished
   *   recording. It arrives with its upload already done, which is why this
   *   re-derives its own readiness instead of trusting `canSend`: that one is
   *   computed for the button, from a render where `uploading` was still true.
   */
  const send = async (extraAttachments: PendingAttachment[] = []) => {
    const outgoing = [...attachments, ...extraAttachments];
    const ready = (body.trim() !== "" || outgoing.length > 0) && !tooLong && !sending;
    if (!ready || !viewer || (uploading && extraAttachments.length === 0)) return;

    setSending(true);

    const clientNonce = crypto.randomUUID();
    const encoded = encodeMentions(body.trim(), dictionary);
    const sentAttachments = outgoing;

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
      threadId,
      threadName: null,
      threadMessageCount: null,
      attachments: sentAttachments.map((attachment, index) => ({
        id: `optimistic-${index}`,
        path: attachment.path,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        width: null,
        height: null,
        durationSeconds: attachment.durationSeconds ?? null,
      })),
      reactions: [],
      // The composer never forwards. Forwarding goes through the message
      // menu and its own RPC, and lands as a message the list re-reads.
      forwarded: null,
    });

    setBody("");
    setAttachments([]);
    onClearReply();

    const result = await sendChannelMessage({
      channelId: channel.id,
      body: encoded,
      threadId: threadId ?? undefined,
      replyToPostId: replyTo?.id,
      attachments: sentAttachments.map(({ path, mimeType, byteSize, durationSeconds }) => ({
        path,
        mimeType,
        byteSize,
        durationSeconds,
      })),
      clientNonce,
    });

    setSending(false);

    if (result.error) {
      // Put the draft back: losing what somebody typed because the send failed
      // is worse than the failure itself.
      setBody(encoded);
      setAttachments(sentAttachments);
      notify(result.error);
    } else if (result.blocked) {
      notify(result.blocked);
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

      <div
        className={
          recorderActive
            ? "flex items-center gap-2"
            : "flex items-end gap-2 rounded-xl border border-surgical-steel bg-surface-container-lowest px-3 py-2"
        }
      >
        {/*
          While a recording is running, paused or being reviewed it is the
          whole row. Everything else is hidden rather than disabled: a text box
          beside a running recording is a box nobody is typing in.
        */}
        {recorderActive ? null : (
        <>
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

        {/*
          The emoji button sits with the attachment button rather than inside
          the box: it is a thing you do to the message, like attaching a file,
          and putting it in the text area would move the caret target as the
          box grows.
        */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger
            aria-label="Insert an emoji"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-fog-muted hover:text-on-surface"
          >
            <Smile size={16} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <EmojiPicker
              mode="insert"
              customEmojis={emojis}
              onSelect={(selection) => {
                setEmojiOpen(false);
                // A custom emoji goes into the body as its token. The id
                // travels with the name, so renaming it later never rewrites
                // this message and deleting it leaves a readable `:name:`.
                insertAtCaret(
                  selection.kind === "unicode"
                    ? selection.glyph
                    : emojiToken({ id: selection.id, name: selection.name }),
                );
              }}
              onClose={() => setEmojiOpen(false)}
            />
          </PopoverContent>
        </Popover>

        <textarea
          ref={textRef}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            // Only while there is something to see. Announcing on the
            // keystroke that empties the box tells everyone somebody is
            // typing when they have just given up.
            if (event.target.value.trim() !== "") announceTyping(channel.id);
          }}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter is a newline — the convention every chat
            // client shares, and the one people's hands already know.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
            // Only on an empty box: with anything typed, Up is the caret
            // moving through what somebody is still writing.
            if (
              onEditLast &&
              body === "" &&
              resolveShortcut({
                key: event.key,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                altKey: event.altKey,
                shiftKey: event.shiftKey,
                typing: true,
              }) === "editLastMessage"
            ) {
              event.preventDefault();
              onEditLast();
            }
          }}
          rows={1}
          placeholder={label}
          aria-label={label}
          className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-sm leading-6 text-on-surface outline-none placeholder:text-fog-muted"
        />

        </>
        )}

        {/*
          The trailing slot, and the only one either of these ever occupies:
          with an empty box the useful action is to speak, and with a drafted
          message it is to send. Both live at the end of the row, so the button
          under the reader's thumb does not move when it changes what it does.

          The recorder sits outside the branch above because a running
          recording takes the whole row — unmounting it there would stop the
          recording the moment it started.
        */}
        {permissions.canAttach && (recorderActive || !hasDraft) ? (
          <VoiceRecorder
            disabled={uploading || sending}
            onRecorded={(recording) => void uploadRecording(recording)}
            onActiveChange={setRecorderActive}
          />
        ) : null}

        {hasDraft || !permissions.canAttach ? (
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            aria-label="Send"
            className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-monolith-surface disabled:opacity-40"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <SendHorizontal size={16} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      {/*
        The counter stays: it describes what is in the box, it belongs beside
        the box, and it appears well before the limit rather than at the
        moment of failure. Failures themselves are toasts.
      */}
      {body.length >= MESSAGE_COUNTER_FROM ? (
        <span className={`mt-1 block text-[11px] ${tooLong ? "text-error" : "text-fog-muted"}`}>
          {`${body.length.toLocaleString("en-US")} / ${MESSAGE_MAX_CHARS.toLocaleString("en-US")}`}
        </span>
      ) : null}
    </div>
  );
}
