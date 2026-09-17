"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";

import { createEmoji, deleteEmoji, renameEmoji } from "@/app/community/emoji-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CUSTOM_EMOJI_LIMITS, isAllowedEmojiType, parseEmojiName, type CustomEmoji } from "@/lib/community/emojis";
import { createClient } from "@/lib/supabase/client";

/**
 * Adding, renaming and removing the community's emoji.
 *
 * The image is uploaded straight from the browser to the bucket, whose insert
 * policy asks `manage_emojis` — so the bytes never pass through a server action
 * and a person without the permission is refused by storage, not by a form.
 *
 * The name is offered from the filename, because that is almost always what
 * somebody wants it called, and retyping `stoic_owl` after choosing
 * `stoic-owl.png` is work the page can do.
 *
 * Monolith, phase 12c. Three things beyond the palette.
 *
 * **Deleting an emoji destroyed reactions with no question asked.** The row's
 * bin was a 28px button wired straight to the action, and the only mention of
 * what had been lost arrived afterwards, in the past tense: "…and so are 14
 * reactions that used it." It is a `ConfirmDialog` at `tone="danger"` now, the
 * same guard every other destructive control in the product has. The count
 * still cannot appear in the question, because only the RPC knows it — so the
 * dialog names the consequence rather than a number.
 *
 * **One `useTransition` flag was read by every row.** Deleting one emoji
 * disabled the rename field and the bin on all of them, and renaming one did
 * the same. The write was always correct and nothing ever broke, which is why
 * it survived — `00 - Shared/Cross-Project Lessons.md` lesson 100, found in
 * phase 12b's bans list and living here too. The transition is now keyed to the
 * row being acted on, and that row is the only one that says it is working.
 *
 * **The rename field had no border, no fill and no visible label.** It was an
 * `<input>` painted to look like text, so the only way to discover a name could
 * be edited was to click it. It is `ui/input`, which is what the rest of
 * settings uses and looks like a field.
 */
export function EmojiSection({
  emojis,
  roles,
  canManage,
}: {
  emojis: CustomEmoji[];
  roles: { id: string; name: string; color: string | null }[];
  canManage: boolean;
}) {
  const notify = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [restricted, setRestricted] = useState<string[]>([]);
  const [busy, startUpload] = useTransition();
  const [pending, startRow] = useTransition();
  /** Which row the transition above belongs to. Null while nothing is in flight. */
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<CustomEmoji | null>(null);

  const full = emojis.length >= CUSTOM_EMOJI_LIMITS.slots;

  const choose = (chosen: File | null) => {
    if (!chosen) return;
    if (!isAllowedEmojiType(chosen.type)) {
      notify("An emoji is a PNG, a WebP or a GIF.");
      return;
    }
    if (chosen.size > CUSTOM_EMOJI_LIMITS.bytes) {
      notify(`That image is ${Math.round(chosen.size / 1024)} KB. The limit is 256 KB.`);
      return;
    }
    setFile(chosen);
    // Only when the box is empty: somebody who has already typed a name meant
    // it, and a second file must not overwrite what they chose.
    if (name.trim() === "") {
      try {
        setName(parseEmojiName(chosen.name.replace(/\.[^.]+$/, "")));
      } catch {
        // A filename that cannot become a name is not an error yet — they can
        // still type one, and saying so before they have tried would be noise.
      }
    }
  };

  const add = () =>
    startUpload(async () => {
      if (!file) {
        notify("Choose an image first.");
        return;
      }
      let cleaned: string;
      try {
        cleaned = parseEmojiName(name);
      } catch (error) {
        notify(error instanceof Error ? error.message : "That name cannot be used.");
        return;
      }

      const supabase = createClient();
      const extension = file.type === "image/gif" ? "gif" : file.type === "image/webp" ? "webp" : "png";
      const path = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("community-emojis")
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        notify("That image could not be uploaded.");
        return;
      }

      const result = await createEmoji({
        name: cleaned,
        path,
        mimeType: file.type,
        animated: file.type === "image/gif",
        roleIds: restricted,
      });
      if (result.error) {
        // The row was refused, so the object is litter. Remove it rather than
        // leaving 256 KB behind for every rejected name.
        await supabase.storage.from("community-emojis").remove([path]);
        notify(result.error);
        return;
      }

      setFile(null);
      setName("");
      setRestricted([]);
      if (fileRef.current) fileRef.current.value = "";
      notify(`:${cleaned}: is ready to use.`, "success");
    });

  const remove = (emoji: CustomEmoji) => {
    setActingId(emoji.id);
    startRow(async () => {
      const result = await deleteEmoji(emoji.id);
      setConfirming(null);
      if (result.error) {
        notify(result.error);
        setActingId(null);
        return;
      }
      const reactions = result.reactionsRemoved ?? 0;
      notify(
        reactions > 0
          ? `:${emoji.name}: is gone, and so are ${reactions} ${reactions === 1 ? "reaction" : "reactions"} that used it.`
          : `:${emoji.name}: is gone.`,
        "success",
      );
      setActingId(null);
    });
  };

  const rename = (emoji: CustomEmoji, next: string) => {
    if (next.trim() === "" || next === emoji.name) return;
    setActingId(emoji.id);
    startRow(async () => {
      const result = await renameEmoji(emoji.id, next, emoji.roleIds);
      if (result.error) {
        notify(result.error);
        setActingId(null);
        return;
      }
      // Messages are untouched: they carry the id, not the name.
      notify(`Renamed to :${next}:. Messages that used it are unchanged.`, "success");
      setActingId(null);
    });
  };

  return (
    <div className="max-w-2xl space-y-8">
      {canManage ? (
        <section className="space-y-3 rounded-xl border border-border-hairline p-4">
          <h3 className="text-content-sm font-medium text-text-strong">Add an emoji</h3>
          <p className="text-chrome-base text-text-muted">
            {`PNG, WebP or GIF, up to 256 KB. It is shown at about ${CUSTOM_EMOJI_LIMITS.pixels} pixels, so anything larger is detail nobody sees. ${emojis.length} of ${CUSTOM_EMOJI_LIMITS.slots} slots used.`}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={CUSTOM_EMOJI_LIMITS.types.join(",")}
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
              className="hidden"
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={full || busy}>
              <Upload size={14} aria-hidden="true" />
              <span className="max-w-48 truncate">{file ? file.name : "Choose an image"}</span>
            </Button>

            <label className="min-w-40 flex-1">
              <span className="sr-only">Emoji name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="stoic_owl"
                disabled={full}
              />
            </label>
          </div>

          {roles.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-chrome-base text-text-muted">
                Leave every role unticked and anyone who may use custom emoji can use this one.
              </legend>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const on = restricted.includes(role.id);
                  return (
                    <Button
                      key={role.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-pressed={on}
                      onClick={() =>
                        setRestricted((current) =>
                          on ? current.filter((id) => id !== role.id) : [...current, role.id],
                        )
                      }
                      className={on ? "border-primary bg-accent-soft text-primary hover:bg-accent-soft" : undefined}
                    >
                      {role.name}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <Button type="button" onClick={add} disabled={full || busy || !file}>
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {full ? "Every slot is used" : "Add it"}
          </Button>
        </section>
      ) : null}

      {emojis.length === 0 ? (
        <p className="text-content-sm text-text-muted">No custom emoji yet.</p>
      ) : (
        <ul className="space-y-2">
          {emojis.map((emoji) => {
            const acting = pending && actingId === emoji.id;
            return (
              <li
                key={emoji.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border-hairline px-3 py-2"
              >
                {/*
                  A plain img, not next/image: these are already capped at 256 KB
                  and sized by the upload, so a loader round trip per emoji would
                  cost more than it saves.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img src={emoji.url} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />

                <label className="min-w-32 flex-1">
                  <span className="sr-only">{`Name for ${emoji.name}`}</span>
                  <Input
                    defaultValue={emoji.name}
                    disabled={!canManage || acting}
                    onBlur={(event) => rename(emoji, event.target.value)}
                  />
                </label>

                <span className="shrink-0 text-chrome-xs text-text-muted">
                  {emoji.roleIds.length === 0
                    ? "Everyone"
                    : `${emoji.roleIds.length} ${emoji.roleIds.length === 1 ? "role" : "roles"}`}
                </span>

                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setConfirming(emoji)}
                    disabled={acting}
                    aria-label={`Delete ${emoji.name}`}
                    className="shrink-0 hover:text-status-danger"
                  >
                    {acting ? (
                      <Loader2 size={16} aria-hidden="true" className="animate-spin" />
                    ) : (
                      <Trash2 size={16} aria-hidden="true" />
                    )}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={confirming ? `Delete :${confirming.name}:?` : "Delete this emoji?"}
        description="Every reaction that used it is removed with it. Messages that typed it keep readable text."
        confirmLabel="Delete it"
        tone="danger"
        busy={pending}
        onConfirm={() => {
          if (confirming) remove(confirming);
        }}
      />
    </div>
  );
}
