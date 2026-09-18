"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { StructureForm } from "@/components/community/structure/StructureForm";
import { StructureList, type StructureSelection } from "@/components/community/structure/StructureList";
import { useStructureOrder } from "@/components/community/structure/useStructureOrder";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import { Button } from "@/components/ui/button";
import { Overlay, OverlayContent, OverlayDescription, OverlayHeader, OverlayTitle } from "@/components/ui/overlay";
import type { CommunityRole } from "@/lib/community-settings/role-model";
import type { ChannelOverride } from "@/lib/community-settings/structure";
import type { Notify } from "@/components/ui/toast";

type StructureEditorProps = {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  /** Empty where the caller has no permissions data; the Permissions tab then hides. */
  roles?: CommunityRole[];
  overrides?: ChannelOverride[];
  onNotice: Notify;
} & ({ variant: "modal"; onClose: () => void } | { variant: "inline"; onClose?: never });

/**
 * The single home for category and channel editing.
 *
 * `/creator/settings` renders the panes inline; the modal variant is the same
 * panes inside a dialog. Only the chrome differs — two copies of this editor
 * would drift the moment either surface gained a field.
 *
 * Monolith, phase 12c. This file held **the last hand-rolled overlay in the
 * product**, and it carried the whole set of defects that primitive exists to
 * remove: a `fixed inset-0` layer at `z-[70]`, a `<button>` painted as the
 * scrim, an Escape listener bound to `window` by hand, and no focus trap, no
 * focus restore, no scroll lock and no portal — so it rendered in-tree and had
 * to out-rank whatever ancestor it happened to sit inside, which is what the
 * arbitrary z-index was for. It is `ui/overlay` now, and every one of those
 * comes from Base UI.
 *
 * **The modal variant has no caller today.** A grep of `src` finds only
 * `variant="inline"`, in `SettingsSectionBody`. It was therefore repainted
 * unseen, which is the situation `00 - Shared/Cross-Project Lessons.md` lesson
 * 86 is about: a surface nobody can reach says whatever it was last told to
 * say. What is claimed here is that it is built from the same primitive as
 * every other dialog in the product — not that it was watched opening.
 */
export function StructureEditor(props: StructureEditorProps) {
  const { categories, channels, roles = [], overrides = [], onNotice } = props;
  const onClose = props.variant === "modal" ? props.onClose : undefined;

  const panes = (
    <StructurePanes
      categories={categories}
      channels={channels}
      roles={roles}
      overrides={overrides}
      onNotice={onNotice}
    />
  );

  if (props.variant === "inline") return panes;

  return (
    <Overlay
      open
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <OverlayContent size="full" aria-label="Manage channel structure" className="h-[92svh] sm:h-[min(44rem,85svh)]">
        <OverlayHeader>
          <OverlayTitle>Channel structure</OverlayTitle>
          <OverlayDescription>Name, group, and gate every channel members can open.</OverlayDescription>
        </OverlayHeader>
        {panes}
      </OverlayContent>
    </Overlay>
  );
}

/** List and detail, identical in both variants. */
function StructurePanes({
  categories: serverCategories,
  channels: serverChannels,
  roles,
  overrides,
  onNotice,
}: {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  roles: CommunityRole[];
  overrides: ChannelOverride[];
  onNotice: Notify;
}) {
  const { categories, channels, status, announcement, moveCategory, moveChannel, retry } = useStructureOrder(
    serverCategories,
    serverChannels,
  );
  const [selection, setSelection] = useState<StructureSelection>(
    categories[0] ? { kind: "category", id: categories[0].id } : { kind: "new-category" },
  );

  const selectedCategory =
    selection.kind === "category" ? categories.find((category) => category.id === selection.id) : undefined;
  const selectedChannel =
    selection.kind === "channel" ? channels.find((channel) => channel.id === selection.id) : undefined;
  const showEditorOnMobile = selection.kind !== "category" || Boolean(selectedCategory);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <div
        className={`flex min-h-0 flex-col border-border-hairline md:flex md:border-r ${
          showEditorOnMobile ? "hidden md:flex" : "flex-1"
        }`}
      >
        <StructureList
          categories={categories}
          channels={channels}
          selection={selection}
          onSelect={setSelection}
          onMoveCategory={moveCategory}
          onMoveChannel={moveChannel}
          className="min-h-0 flex-1 overflow-y-auto p-2"
        />

        <div className="shrink-0 border-t border-border-hairline px-3 py-2">
          {/* One polite region carries both the move announcement and the save
              result. A second region would interleave with it unpredictably. */}
          <p role="status" aria-live="polite" className="min-h-5 text-chrome-base text-text-muted">
            <span className="sr-only">{announcement}</span>
            {status === "saving" && "Saving order…"}
            {status === "saved" && "Order saved."}
          </p>
          {status === "failed" && (
            <p role="alert" className="flex items-center gap-2 text-chrome-base text-status-danger">
              Order not saved.
              <Button type="button" variant="link" size="sm" onClick={retry} className="text-status-danger">
                Retry
              </Button>
            </p>
          )}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${showEditorOnMobile ? "" : "hidden md:block"}`}>
        <Button
          type="button"
          variant="ghost"
          size="chrome"
          onClick={() => setSelection({ kind: "new-category" })}
          className="mb-4 md:hidden"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          All categories
        </Button>

        {selection.kind === "new-category" && <StructureForm key="new-category" kind="category" onNotice={onNotice} />}
        {selectedCategory && (
          <StructureForm
            key={selectedCategory.id}
            kind="category"
            category={selectedCategory}
            channelCount={channels.filter((channel) => channel.categoryId === selectedCategory.id).length}
            roles={roles}
            overrides={overrides}
            onNotice={onNotice}
            onDeleted={() => setSelection({ kind: "new-category" })}
          />
        )}
        {selection.kind === "new-channel" && (
          <StructureForm
            key={`new-channel-${selection.categoryId}`}
            kind="channel"
            categoryId={selection.categoryId}
            onNotice={onNotice}
          />
        )}
        {selectedChannel && (
          <StructureForm
            key={selectedChannel.id}
            kind="channel"
            categoryId={selectedChannel.categoryId}
            channel={selectedChannel}
            roles={roles}
            overrides={overrides}
            onNotice={onNotice}
            onDeleted={() => setSelection({ kind: "category", id: selectedChannel.categoryId })}
          />
        )}
      </div>
    </div>
  );
}
