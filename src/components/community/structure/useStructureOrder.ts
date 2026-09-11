"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { reorderCommunityStructure } from "@/app/creator/channels/actions";
import type { CommunityCategory, CommunityChannel } from "@/components/community/types";
import { describeMove, moveWithin, type MoveDirection } from "@/lib/community-settings/order";

export type OrderState = "idle" | "saving" | "saved" | "failed";

const COMMIT_DELAY_MS = 600;

/**
 * Local order with a debounced commit.
 *
 * A keyboard reorder has to feel immediate, so the list moves on keypress and
 * the write follows. The debounce matters more than it looks: holding Move up
 * through a seven-channel category would otherwise fire seven writes, each of
 * which is N sequential UPDATEs in `reorderCommunityStructure`.
 *
 * On failure the list snaps back to the server order rather than leaving the
 * creator looking at an arrangement that was never saved.
 */
export function useStructureOrder(serverCategories: CommunityCategory[], serverChannels: CommunityChannel[]) {
  const [categories, setCategories] = useState(serverCategories);
  const [channels, setChannels] = useState(serverChannels);
  const [status, setStatus] = useState<OrderState>("idle");
  const [announcement, setAnnouncement] = useState("");

  // Re-seed during render, not in an effect, so a revalidated page paints the
  // server's order immediately instead of one frame of the stale local one.
  const [seededCategories, setSeededCategories] = useState(serverCategories);
  const [seededChannels, setSeededChannels] = useState(serverChannels);
  if (serverCategories !== seededCategories || serverChannels !== seededChannels) {
    setSeededCategories(serverCategories);
    setSeededChannels(serverChannels);
    setCategories(serverCategories);
    setChannels(serverChannels);
    setStatus("idle");
  }

  const timer = useRef<number | null>(null);
  const lastCommit = useRef<{ kind: "category" | "channel"; ids: string[] } | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const commit = useCallback(
    (kind: "category" | "channel", ids: string[]) => {
      lastCommit.current = { kind, ids };
      if (timer.current !== null) window.clearTimeout(timer.current);
      setStatus("saving");
      timer.current = window.setTimeout(async () => {
        timer.current = null;
        const result = await reorderCommunityStructure(kind, ids);
        if (result.error) {
          setStatus("failed");
          setCategories(serverCategories);
          setChannels(serverChannels);
          return;
        }
        setStatus("saved");
      }, COMMIT_DELAY_MS);
    },
    [serverCategories, serverChannels],
  );

  const moveCategory = useCallback(
    (id: string, direction: MoveDirection) => {
      const next = moveWithin(categories, id, direction);
      if (next === categories) return;
      setCategories(next);
      const position = next.findIndex((category) => category.id === id);
      setAnnouncement(describeMove(next[position].name, position + 1, next.length));
      commit(
        "category",
        next.map((category) => category.id),
      );
    },
    [categories, commit],
  );

  const moveChannel = useCallback(
    (id: string, direction: MoveDirection) => {
      const subject = channels.find((channel) => channel.id === id);
      if (!subject) return;
      const siblings = channels.filter((channel) => channel.categoryId === subject.categoryId);
      const next = moveWithin(siblings, id, direction);
      if (next === siblings) return;

      // Splice the reordered slice back into the flat list in place, so the
      // other categories keep the positions they already had.
      const queue = next.slice();
      setChannels(channels.map((channel) => (channel.categoryId === subject.categoryId ? queue.shift()! : channel)));

      const position = next.findIndex((channel) => channel.id === id);
      const container = categories.find((category) => category.id === subject.categoryId)?.name;
      setAnnouncement(describeMove(subject.name, position + 1, next.length, container));
      commit(
        "channel",
        next.map((channel) => channel.id),
      );
    },
    [categories, channels, commit],
  );

  const retry = useCallback(() => {
    if (lastCommit.current) commit(lastCommit.current.kind, lastCommit.current.ids);
  }, [commit]);

  return { categories, channels, status, announcement, moveCategory, moveChannel, retry };
}
