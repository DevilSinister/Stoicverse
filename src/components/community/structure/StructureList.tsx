"use client";

import { useRef } from "react";
import { ChevronDown, ChevronUp, FolderPlus, Plus } from "lucide-react";

import { channelMeta } from "@/components/community/channel-meta";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import { canMove, type MoveDirection } from "@/lib/community-settings/order";

/** What the structure editor is currently showing in its detail pane. */
export type StructureSelection =
  | { kind: "category"; id: string }
  | { kind: "channel"; id: string }
  | { kind: "new-category" }
  | { kind: "new-channel"; categoryId: string };

/** The category/channel tree on the left of the structure editor. Selection only — it writes nothing. */
export function StructureList({
  categories,
  channels,
  selection,
  onSelect,
  onMoveCategory,
  onMoveChannel,
  className = "",
}: {
  categories: CommunityCategory[];
  channels: CommunityChannel[];
  selection: StructureSelection;
  onSelect: (selection: StructureSelection) => void;
  onMoveCategory?: (id: string, direction: MoveDirection) => void;
  onMoveChannel?: (id: string, direction: MoveDirection) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Categories and channels" className={className}>
      {categories.map((category) => {
        const items = channels.filter((channel) => channel.categoryId === category.id);
        const isCurrent = selection.kind === "category" && selection.id === category.id;
        return (
          <div key={category.id} className="mb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect({ kind: "category", id: category.id })}
                aria-current={isCurrent ? "true" : undefined}
                className={`focus-ring flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                  isCurrent ? "bg-surface-container-high text-text-strong" : "text-fog-muted hover:text-on-surface-variant"
                }`}
              >
                <span className="truncate">{category.name}</span>
                {category.isArchived && (
                  <span className="ml-auto shrink-0 font-label text-[10px] normal-case tracking-normal">archived</span>
                )}
              </button>
              {onMoveCategory && !category.isArchived && (
                <MoveGroup
                  label={category.name}
                  canUp={canMove(categories, category.id, "up")}
                  canDown={canMove(categories, category.id, "down")}
                  onMove={(direction) => onMoveCategory(category.id, direction)}
                />
              )}
            </div>

            <ul className="mt-0.5 space-y-px pl-2">
              {items.map((channel) => {
                const Icon = channelMeta(channel.type).icon;
                const isActive = selection.kind === "channel" && selection.id === channel.id;
                return (
                  <li key={channel.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: "channel", id: channel.id })}
                      aria-current={isActive ? "true" : undefined}
                      className={`focus-ring flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left transition ${
                        isActive
                          ? "bg-surface-container-high font-semibold text-text-strong"
                          : "text-on-surface-variant hover:bg-surface-container-high/50"
                      } ${channel.isArchived ? "opacity-60" : ""}`}
                    >
                      <Icon size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />
                      <span className="truncate text-sm">{channel.name}</span>
                    </button>
                    {onMoveChannel && !channel.isArchived && (
                      <MoveGroup
                        label={channel.name}
                        canUp={canMove(items, channel.id, "up")}
                        canDown={canMove(items, channel.id, "down")}
                        onMove={(direction) => onMoveChannel(channel.id, direction)}
                      />
                    )}
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: "new-channel", categoryId: category.id })}
                  className="focus-ring flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-fog-muted transition hover:text-primary-container"
                >
                  <Plus size={14} aria-hidden="true" className="shrink-0" />
                  Add channel
                </button>
              </li>
            </ul>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onSelect({ kind: "new-category" })}
        className="focus-ring mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-surgical-steel text-sm font-semibold text-fog-muted transition hover:border-primary-container hover:text-primary-container"
      >
        <FolderPlus size={15} aria-hidden="true" />
        New category
      </button>
    </nav>
  );
}

/**
 * Move up / Move down for one row.
 *
 * No drag-and-drop library: the content security policy forbids CDNs, and the
 * keyboard requirement is met more directly this way. Pointer dragging can be
 * layered on later without changing this contract.
 */
function MoveGroup({
  label,
  canUp,
  canDown,
  onMove,
}: {
  label: string;
  canUp: boolean;
  canDown: boolean;
  onMove: (direction: MoveDirection) => void;
}) {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);

  const press = (direction: MoveDirection) => {
    onMove(direction);
    // A button that just became disabled cannot keep focus: the browser drops
    // it to <body> and the creator silently loses their place in the list.
    requestAnimationFrame(() => {
      const pressed = direction === "up" ? upRef.current : downRef.current;
      const sibling = direction === "up" ? downRef.current : upRef.current;
      if (pressed?.disabled) sibling?.focus();
    });
  };

  const buttonClass =
    "focus-ring grid size-11 shrink-0 place-items-center rounded-lg text-fog-muted transition hover:bg-surface-container-high hover:text-text-strong disabled:pointer-events-none disabled:opacity-30";

  return (
    <div role="group" aria-label={`Reorder ${label}`} className="flex shrink-0">
      <button
        ref={upRef}
        type="button"
        disabled={!canUp}
        onClick={() => press("up")}
        aria-label={`Move ${label} up`}
        className={buttonClass}
      >
        <ChevronUp size={15} aria-hidden="true" />
      </button>
      <button
        ref={downRef}
        type="button"
        disabled={!canDown}
        onClick={() => press("down")}
        aria-label={`Move ${label} down`}
        className={buttonClass}
      >
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
