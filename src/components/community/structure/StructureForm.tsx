"use client";

import { useState, useTransition } from "react";
import { Loader2, Settings2, Trash2 } from "lucide-react";

import {
  deleteCommunityStructure,
  saveCategory,
  saveChannel,
  setCommunityStructureArchived,
} from "@/app/creator/channels/actions";
import { CHANNEL_TYPES, channelMeta, channelSlug } from "@/components/community/channel-meta";
import { AccessFields } from "@/components/community/structure/AccessFields";
import { ChannelPermissionsTab, SlowModeField } from "@/components/community/structure/ChannelPermissionsTab";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import type { CommunityRole } from "@/lib/community-settings/role-model";
import type { ChannelOverride } from "@/lib/community-settings/structure";

/** Create or edit one category or channel. Every write goes through the creator channel actions. */
export function StructureForm({
  kind,
  category,
  channel,
  categoryId,
  channelCount = 0,
  roles = [],
  overrides = [],
  onNotice,
  onDeleted,
}: {
  kind: "category" | "channel";
  category?: CommunityCategory;
  channel?: CommunityChannel;
  categoryId?: string;
  channelCount?: number;
  /** Empty until the phase-3 migration is applied, which hides the tab entirely. */
  roles?: CommunityRole[];
  overrides?: ChannelOverride[];
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

  // Permissions belong to a row that exists. Offering the tab while creating
  // one would be a grid with nothing to attach to.
  const [tab, setTab] = useState<"overview" | "permissions">("overview");
  const showPermissions = !isNew && roles.length > 0;

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

  if (showPermissions && tab === "permissions") {
    return (
      <div className="space-y-6">
        <FormHeader isNew={isNew} kind={kind} hint={kind === "category" ? CATEGORY_HINT : meta.hint} />
        <StructureTabs tab={tab} onChange={setTab} />
        <ChannelPermissionsTab
          target={kind}
          channel={channel}
          category={category}
          roles={roles}
          overrides={overrides}
          canSave
          onNotice={onNotice}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-strong">{isNew ? `New ${kind}` : `Edit ${kind}`}</h3>
        <p className="mt-1 text-xs leading-5 text-fog-muted">
          {kind === "category"
            ? "A category groups channels in the sidebar and sets the default access for channels added to it."
            : meta.hint}
        </p>
      </div>

      {showPermissions && <StructureTabs tab={tab} onChange={setTab} />}

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
            className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none placeholder:text-fog-muted"
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
            className="focus-ring mt-2 h-11 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-text-strong outline-none placeholder:text-fog-muted"
          />
        </div>

        <AccessFields rule={subject} />

        {kind === "channel" && channel && (
          <SlowModeField
            channelId={channel.id}
            seconds={channel.slowModeSeconds}
            disabled={pending}
            onNotice={onNotice}
          />
        )}

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
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-surgical-steel px-4 text-sm font-semibold text-text-strong transition hover:border-primary-container disabled:opacity-40"
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

const CATEGORY_HINT =
  "A category groups channels in the sidebar and sets the default access for channels added to it.";

function FormHeader({ isNew, kind, hint }: { isNew: boolean; kind: string; hint: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-strong">{isNew ? `New ${kind}` : `Edit ${kind}`}</h3>
      <p className="mt-1 text-xs leading-5 text-fog-muted">{hint}</p>
    </div>
  );
}

function StructureTabs({
  tab,
  onChange,
}: {
  tab: "overview" | "permissions";
  onChange: (next: "overview" | "permissions") => void;
}) {
  return (
    <div role="tablist" aria-label="Channel settings" className="flex gap-1 border-b border-surgical-steel">
      {(["overview", "permissions"] as const).map((entry) => (
        <button
          key={entry}
          type="button"
          role="tab"
          aria-selected={tab === entry}
          onClick={() => onChange(entry)}
          className={`focus-ring -mb-px min-h-11 rounded-t-lg px-4 text-sm font-semibold capitalize transition ${
            tab === entry
              ? "border-b-2 border-primary-container text-text-strong"
              : "text-on-surface-variant hover:text-text-strong"
          }`}
        >
          {entry}
        </button>
      ))}
    </div>
  );
}
