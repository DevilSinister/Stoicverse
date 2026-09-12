"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hash } from "lucide-react";

import { useCommunity } from "@/components/channels/CommunityProvider";

/**
 * Ctrl+K — go to a channel by typing its name.
 *
 * Locked channels are left out. There is nothing behind one for this person,
 * so offering it as a destination only produces a door that does not open.
 *
 * The highlighted row is an index into the *filtered* list and is reset
 * whenever the filter changes, because a selection pointing at the fourth of
 * four results is pointing at nothing once a keystroke leaves two.
 */
export function QuickSwitcher({ onClose }: { onClose: () => void }) {
  const { channels } = useCommunity();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return channels
      .filter((channel) => !channel.isLocked)
      .filter((channel) => (needle ? channel.name.toLowerCase().includes(needle) : true))
      .slice(0, 20);
  }, [channels, query]);

  const go = (channelId: string) => {
    onClose();
    router.push(`/channels/${channelId}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Go to a channel"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActive((current) => (matches.length === 0 ? 0 : (current + 1) % matches.length));
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActive((current) => (matches.length === 0 ? 0 : (current - 1 + matches.length) % matches.length));
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const target = matches[active];
          if (target) go(target.id);
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-surgical-steel bg-surface-container-low">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          placeholder="Go to a channel"
          aria-label="Go to a channel"
          className="w-full border-b border-surgical-steel bg-transparent px-4 py-3 text-sm text-on-surface outline-none placeholder:text-fog-muted"
        />

        <ul className="max-h-72 overflow-y-auto p-1.5">
          {matches.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-fog-muted">No channel of that name.</li>
          ) : (
            matches.map((channel, index) => (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => go(channel.id)}
                  onMouseEnter={() => setActive(index)}
                  className={`focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                    index === active ? "bg-surface-container-high text-on-surface" : "text-fog-muted"
                  }`}
                >
                  <Hash size={14} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{channel.name}</span>
                  <span className="ml-auto shrink-0 truncate text-[11px] text-fog-muted">{channel.categoryName}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <p className="border-t border-surgical-steel px-4 py-2 text-[11px] text-fog-muted">
          Up and down to choose, Enter to go, Escape to close.
        </p>
      </div>
    </div>
  );
}
