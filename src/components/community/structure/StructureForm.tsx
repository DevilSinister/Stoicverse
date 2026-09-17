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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CommunityRole } from "@/lib/community-settings/role-model";
import type { ChannelOverride } from "@/lib/community-settings/structure";
import type { Notify } from "@/components/ui/toast";

/**
 * Create or edit one category or channel. Every write goes through the creator
 * channel actions.
 *
 * Monolith, phase 12c. Two things beyond the palette.
 *
 * **The tabs were a `role="tablist"` no assistive technology could follow.**
 * Two buttons carried `role="tab"` and `aria-selected`, and nothing else: no
 * `aria-controls`, no element with `role="tabpanel"` for them to point at, and
 * no arrow-key movement — the pattern's whole keyboard contract is that Left
 * and Right move between tabs, and here they did nothing. The "permissions"
 * branch also returned early, so the panel the tabs claimed to switch between
 * was a separate subtree with its own duplicate header. It is `ui/tabs` now:
 * the roles, the `aria-controls` wiring, the roving focus and the panel come
 * from Base UI, and this file only says which panel holds what. That primitive
 * had no call site in the product, and this is a deliberate first one — the
 * hand-rolled version was not a working control moved for tidiness, it was an
 * ARIA promise that was never kept.
 *
 * **Delete has no confirmation, and that is the server's doing rather than an
 * omission.** `deleteCommunityStructure` refuses a category that still holds
 * channels and a channel that still holds posts, so this button can only ever
 * destroy something already empty, and it returns a sentence saying so when it
 * refuses. A dialog here would be asking about a loss that cannot happen.
 */
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
  onNotice: Notify;
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
  const [tab, setTab] = useState("overview");
  const showPermissions = !isNew && roles.length > 0;

  const submit = (data: FormData) =>
    startTransition(async () => {
      const result = kind === "category" ? await saveCategory(data) : await saveChannel(data);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      onNotice(`${kind === "category" ? "Category" : "Channel"} saved.`, "success");
      if (isNew) setName("");
    });

  const setArchived = (archived: boolean) =>
    startTransition(async () => {
      const result = await setCommunityStructureArchived(kind, subject!.id, archived);
      if (result.error) onNotice(result.error, "error");
      else onNotice(`${kind === "category" ? "Category" : "Channel"} ${archived ? "archived" : "restored"}.`, "success");
    });

  const destroy = () =>
    startTransition(async () => {
      const result = await deleteCommunityStructure(kind, subject!.id);
      if (result.error) {
        onNotice(result.error, "error");
        return;
      }
      onNotice(`${kind === "category" ? "Category" : "Channel"} deleted.`, "success");
      onDeleted?.();
    });

  const overview = (
    <div className="space-y-6">
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
            <legend className="terminal-label">Type</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHANNEL_TYPES.map((option) => {
                const optionMeta = channelMeta(option);
                const OptionIcon = optionMeta.icon;
                return (
                  <label
                    key={option}
                    className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-content-sm font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                      type === option
                        ? "border-primary bg-accent-soft text-primary"
                        : "border-border-hairline text-text-default hover:border-text-muted"
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
          <label htmlFor="structure-name" className="terminal-label block">
            Name
          </label>
          <Input
            id="structure-name"
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={kind === "category" ? "Foundations" : meta.namePlaceholder}
            className="mt-2"
          />
          {kind === "channel" && (
            <p className="mt-2 min-h-5 text-chrome-base text-text-muted">
              {slug ? (
                <>
                  Members will see{" "}
                  <span className="font-mono text-primary">
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
          <label htmlFor="structure-description" className="terminal-label block">
            Description <span className="font-normal normal-case tracking-normal">· optional</span>
          </label>
          <Input
            id="structure-description"
            name="description"
            defaultValue={subject?.description ?? ""}
            placeholder={kind === "category" ? "What this group of channels covers." : meta.descriptionPlaceholder}
            className="mt-2"
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

        <div className="flex items-center justify-end border-t border-border-hairline pt-4">
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending && <Loader2 size={15} aria-hidden="true" className="animate-spin" />}
            {isNew ? `Create ${kind}` : "Save changes"}
          </Button>
        </div>
      </form>

      {subject && (
        <div className="space-y-3 border-t border-border-hairline pt-5">
          <h4 className="terminal-label">Availability</h4>
          <p className="text-chrome-base text-text-muted">
            {subject.isArchived
              ? "Archived. Members cannot see it, and its history is kept."
              : "Live. Archiving hides it from members without deleting anything."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setArchived(!subject.isArchived)}>
              <Settings2 size={15} aria-hidden="true" />
              {subject.isArchived ? "Restore" : "Archive"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || (kind === "category" && channelCount > 0)}
              onClick={destroy}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete permanently
            </Button>
          </div>
          {kind === "category" && channelCount > 0 && (
            <p className="text-chrome-base text-text-muted">
              This category still holds {channelCount} {channelCount === 1 ? "channel" : "channels"}. Archive or delete
              them first.
            </p>
          )}
          {kind === "channel" && (
            <p className="text-chrome-base text-text-muted">
              A channel that already has messages can only be archived.
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <FormHeader isNew={isNew} kind={kind} hint={kind === "category" ? CATEGORY_HINT : meta.hint} />

      {showPermissions ? (
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList
            variant="line"
            className="w-full justify-start rounded-none border-b border-border-hairline p-0"
          >
            <StructureTab value="overview">Overview</StructureTab>
            <StructureTab value="permissions">Permissions</StructureTab>
          </TabsList>
          <TabsContent value="overview" className="pt-2">
            {overview}
          </TabsContent>
          <TabsContent value="permissions" className="pt-2">
            <ChannelPermissionsTab
              target={kind}
              channel={channel}
              category={category}
              roles={roles}
              overrides={overrides}
              canSave
              onNotice={onNotice}
            />
          </TabsContent>
        </Tabs>
      ) : (
        overview
      )}
    </div>
  );
}

const CATEGORY_HINT =
  "A category groups channels in the sidebar and sets the default access for channels added to it.";

function FormHeader({ isNew, kind, hint }: { isNew: boolean; kind: string; hint: string }) {
  return (
    <div>
      <h3 className="text-title-sm font-medium text-text-strong">{isNew ? `New ${kind}` : `Edit ${kind}`}</h3>
      <p className="mt-1 text-chrome-base text-text-muted">{hint}</p>
    </div>
  );
}

/**
 * Two corrections to the primitive, both measured rather than assumed.
 *
 * **The underline is the accent, not `--foreground`.** `ui/tabs` carries
 * shadcn's `after:bg-foreground`, which on Monolith is the body grey — a
 * selected tab marked in the same colour as the text beside it. The accent is
 * what means state in this system, and a selected tab is state.
 *
 * **The height belongs on the trigger.** `TabsList` sets its height through
 * `group-data-horizontal/tabs:h-8`, and an `h-11` passed to the list does not
 * beat it: twMerge reads a variant-prefixed class and a bare one as different
 * groups, keeps both, and the compiled stylesheet order decides — the tabs
 * measured 30px. Setting it here instead is a plain `h-*` against the trigger's
 * own `h-[calc(100%-1px)]`, which twMerge does resolve. Same family as
 * `00 - Shared/Cross-Project Lessons.md` lessons 85, 96 and 98.
 */
function StructureTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 flex-none px-4 text-content-sm data-active:text-text-strong data-active:after:bg-primary"
    >
      {children}
    </TabsTrigger>
  );
}
