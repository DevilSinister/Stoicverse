"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

import { StructureForm } from "@/components/community/structure/StructureForm";
import { StructureList, type StructureSelection } from "@/components/community/structure/StructureList";
import { useStructureOrder } from "@/components/community/structure/useStructureOrder";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import type { CommunityRole } from "@/lib/community-settings/role-model";
import type { ChannelOverride } from "@/lib/community-settings/structure";

type StructureEditorProps = {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  /** Empty where the caller has no permissions data; the Permissions tab then hides. */
  roles?: CommunityRole[];
  overrides?: ChannelOverride[];
  onNotice: (value: string) => void;
} & ({ variant: "modal"; onClose: () => void } | { variant: "inline"; onClose?: never });

/**
 * The single home for category and channel editing.
 *
 * `/dashboard/community` and `/creator/channels` render it as a modal from the
 * sidebar; `/creator/settings` renders the same panes inline. Only the chrome
 * differs — two copies of this editor would drift the moment either surface
 * gained a field.
 */
export function StructureEditor(props: StructureEditorProps) {
  const { categories, channels, roles = [], overrides = [], onNotice } = props;
  const modal = props.variant === "modal";
  const onClose = props.variant === "modal" ? props.onClose : undefined;

  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const panes = (
    <StructurePanes
      categories={categories}
      channels={channels}
      roles={roles}
      overrides={overrides}
      onNotice={onNotice}
    />
  );

  if (!modal) return panes;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage channel structure"
      className="fixed inset-0 z-[70] sm:grid sm:place-items-center sm:p-4"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/75" />

      <div className="relative flex h-full w-full flex-col overflow-hidden border-surgical-steel bg-surface-container-low sm:h-[min(44rem,90vh)] sm:max-w-4xl sm:rounded-xl sm:border">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-surgical-steel px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white sm:text-lg">Channel structure</h2>
            <p className="mt-0.5 text-xs leading-5 text-fog-muted">
              Name, group, and gate every channel members can open.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring grid size-10 shrink-0 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-high hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        {panes}
      </div>
    </div>
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
  onNotice: (value: string) => void;
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
        className={`flex min-h-0 flex-col border-surgical-steel md:flex md:border-r ${
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

        <div className="shrink-0 border-t border-surgical-steel px-3 py-2">
          {/* One polite region carries both the move announcement and the save
              result. A second region would interleave with it unpredictably. */}
          <p role="status" aria-live="polite" className="min-h-5 text-xs leading-5 text-fog-muted">
            <span className="sr-only">{announcement}</span>
            {status === "saving" && "Saving order…"}
            {status === "saved" && "Order saved."}
          </p>
          {status === "failed" && (
            <p role="alert" className="flex items-center gap-2 text-xs leading-5 text-error">
              Order not saved.
              <button type="button" onClick={retry} className="focus-ring min-h-9 rounded font-semibold underline">
                Retry
              </button>
            </p>
          )}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${showEditorOnMobile ? "" : "hidden md:block"}`}>
        <button
          type="button"
          onClick={() => setSelection({ kind: "new-category" })}
          className="focus-ring mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-semibold text-fog-muted transition hover:text-white md:hidden"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          All categories
        </button>

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
