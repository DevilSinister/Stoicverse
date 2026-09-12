"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";

import { createEmoji, deleteEmoji, renameEmoji } from "@/app/community/emoji-actions";
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
 */

const field =
  "focus-ring h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-sm text-on-surface outline-none";

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

  const remove = (emoji: CustomEmoji) =>
    startRow(async () => {
      const result = await deleteEmoji(emoji.id);
      if (result.error) {
        notify(result.error);
        return;
      }
      const reactions = result.reactionsRemoved ?? 0;
      notify(
        reactions > 0
          ? `:${emoji.name}: is gone, and so are ${reactions} ${reactions === 1 ? "reaction" : "reactions"} that used it.`
          : `:${emoji.name}: is gone.`,
        "success",
      );
    });

  const rename = (emoji: CustomEmoji, next: string) =>
    startRow(async () => {
      if (next.trim() === "" || next === emoji.name) return;
      const result = await renameEmoji(emoji.id, next, emoji.roleIds);
      if (result.error) {
        notify(result.error);
        return;
      }
      // Messages are untouched: they carry the id, not the name.
      notify(`Renamed to :${next}:. Messages that used it are unchanged.`, "success");
    });

  return (
    <div className="max-w-2xl space-y-8">
      {canManage ? (
        <section className="space-y-3 rounded-xl border border-surgical-steel p-4">
          <h3 className="text-sm font-semibold text-on-surface">Add an emoji</h3>
          <p className="text-xs leading-5 text-fog-muted">
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
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={full || busy}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-surgical-steel px-3 py-2 text-xs text-on-surface-variant disabled:opacity-50"
            >
              <Upload size={14} aria-hidden="true" />
              {file ? file.name : "Choose an image"}
            </button>

            <label className="min-w-40 flex-1">
              <span className="sr-only">Emoji name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="stoic_owl"
                disabled={full}
                className={field}
              />
            </label>
          </div>

          {roles.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-xs text-fog-muted">
                Leave every role unticked and anyone who may use custom emoji can use this one.
              </legend>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const on = restricted.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setRestricted((current) =>
                          on ? current.filter((id) => id !== role.id) : [...current, role.id],
                        )
                      }
                      className={`focus-ring rounded-lg border px-2 py-1 text-[11px] ${
                        on
                          ? "border-primary-container bg-primary-container/10 text-primary-container"
                          : "border-surgical-steel text-on-surface-variant"
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <button
            type="button"
            onClick={add}
            disabled={full || busy || !file}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-monolith-surface disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {full ? "Every slot is used" : "Add it"}
          </button>
        </section>
      ) : null}

      {emojis.length === 0 ? (
        <p className="text-sm text-fog-muted">No custom emoji yet.</p>
      ) : (
        <ul className="space-y-2">
          {emojis.map((emoji) => (
            <li
              key={emoji.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-surgical-steel px-3 py-2"
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
                <input
                  defaultValue={emoji.name}
                  disabled={!canManage || pending}
                  onBlur={(event) => rename(emoji, event.target.value)}
                  className="focus-ring w-full rounded-lg bg-transparent px-2 py-1 text-sm text-on-surface outline-none disabled:opacity-70"
                />
              </label>

              <span className="shrink-0 text-[11px] text-fog-muted">
                {emoji.roleIds.length === 0
                  ? "Everyone"
                  : `${emoji.roleIds.length} ${emoji.roleIds.length === 1 ? "role" : "roles"}`}
              </span>

              {canManage ? (
                <button
                  type="button"
                  onClick={() => remove(emoji)}
                  disabled={pending}
                  aria-label={`Delete ${emoji.name}`}
                  className="focus-ring shrink-0 rounded-lg p-1.5 text-fog-muted hover:text-error disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
