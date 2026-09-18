"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Hash, Loader2, MessageSquareText, Search, User } from "lucide-react";

import { useCommunity } from "@/components/channels/CommunityProvider";
import { Overlay, OverlayBody, OverlayContent, OverlayTitle } from "@/components/ui/overlay";
import { describeFilters, parseSearchQuery } from "@/lib/channels/search-query";
import { localCandidates, rankLocal, type RankedResult, type SearchKind } from "@/lib/channels/search-index";
import { SEARCH_QUERY_LIMITS } from "@/lib/community/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * One search over everything: channels, categories, members and messages.
 *
 * **It is also the quick switcher.** Ctrl+K used to mean two different things —
 * a channel-name switcher inside /channels and global search everywhere else —
 * one key with two meanings depending on which half of the product you happened
 * to be looking at. The switcher was a strict subset of this: channels are
 * already ranked here, instantly and locally. So this opens on the channel list,
 * which is what the switcher showed, and typing widens the question rather than
 * changing tool. `QuickSwitcher.tsx` is deleted rather than restyled.
 *
 * **Three of the four kinds never leave the browser.** Channels, categories
 * and members are already in the provider, so they are ranked on the keystroke
 * and appear instantly. Only messages are a request, and it is debounced: a
 * search per character would mean five round trips to answer one question.
 *
 * The `from: in: has: before: after:` filters still work and still belong to
 * the message half — `parseSearchQuery` owns them and is tested on its own.
 */

type Hit = {
  id: string;
  channel_id: string;
  channel_name: string;
  author_name: string | null;
  body: string | null;
  created_at: string;
};

/** Long enough that typing a word is one request, short enough to feel immediate. */
const DEBOUNCE_MS = 220;

/** What the switcher showed on an empty box, and what this shows now. */
const DEFAULT_CHANNELS = 20;

const KIND_LABEL: Record<SearchKind, string> = {
  channel: "Channels",
  category: "Categories",
  member: "Members",
};

const KIND_ORDER = ["channel", "category", "member"] as const;

/** One navigable row, whichever half of the results it came from. */
type Row = { kind: "local"; result: RankedResult } | { kind: "hit"; hit: Hit };

function KindIcon({ kind }: { kind: SearchKind }) {
  if (kind === "channel") return <Hash size={14} aria-hidden="true" className="shrink-0 text-text-faint" />;
  if (kind === "category") return <Folder size={14} aria-hidden="true" className="shrink-0 text-text-faint" />;
  return <User size={14} aria-hidden="true" className="shrink-0 text-text-faint" />;
}

export function SearchOverlay({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { channels, members, dictionary, openProfile } = useCommunity();
  const router = useRouter();

  const [raw, setRaw] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Only the newest search may write results: a slow first request must not
  // land on top of a fast second one and answer the previous question.
  const runRef = useRef(0);

  /*
    Locked channels are not destinations.

    The switcher left them out and this did not, so one Ctrl+K offered a door
    that does not open and the other did not, depending on where it was pressed.
    They go on being *shown* in the sidebar — "there is more here at a higher
    tier" is the point — but a search result is a place to go. Dropping them
    here also drops any category left with nothing in it, which is what
    `localCandidates` already says is right: a category whose every channel is
    invisible is a category this person cannot open.
  */
  const reachable = useMemo(() => channels.filter((channel) => !channel.isLocked), [channels]);
  const candidates = useMemo(() => localCandidates(reachable, members), [reachable, members]);
  const ranked = useMemo(() => rankLocal(candidates, raw), [candidates, raw]);

  // An empty box is the switcher: the channels this person can open, in the
  // order the creator arranged them.
  const local = useMemo<RankedResult[]>(() => {
    if (raw.trim() !== "") return ranked;
    return candidates
      .filter((candidate) => candidate.kind === "channel")
      .slice(0, DEFAULT_CHANNELS)
      .map((candidate) => ({ ...candidate, score: 0 }));
  }, [raw, ranked, candidates]);

  const grouped = useMemo(() => {
    const byKind = new Map<SearchKind, RankedResult[]>();
    for (const result of local) {
      const existing = byKind.get(result.kind);
      if (existing) existing.push(result);
      else byKind.set(result.kind, [result]);
    }
    return byKind;
  }, [local]);

  // One flat sequence in the order the eye reads it, so the arrow keys cross a
  // section boundary rather than stopping at it.
  const rows = useMemo<Row[]>(() => {
    const ordered: Row[] = [];
    for (const kind of KIND_ORDER) {
      for (const result of grouped.get(kind) ?? []) ordered.push({ kind: "local", result });
    }
    if (problems.length === 0) {
      for (const hit of hits ?? []) ordered.push({ kind: "hit", hit });
    }
    return ordered;
  }, [grouped, hits, problems]);

  // Clamped at read time rather than reset in an effect: message results arrive
  // asynchronously and a shorter list must not leave the cursor past its end.
  const selectedIndex = cursor < rows.length ? cursor : 0;

  const runMessages = useCallback(
    async (text: string) => {
      const parsed = parseSearchQuery(text, dictionary);
      setProblems(parsed.problems);
      setChips(describeFilters(parsed.filters, dictionary));
      setFailed(null);

      if (!parsed.runnable) {
        // A filter that matched nobody is shown and the search is *not* run: a
        // search that quietly drops `from:someone` returns everybody's
        // messages and looks like it worked.
        setHits(parsed.problems.length > 0 ? [] : null);
        return;
      }

      const ticket = runRef.current + 1;
      runRef.current = ticket;
      setBusy(true);

      const supabase = createClient();
      const { data, error } = await supabase.rpc("community_search_messages", {
        query: parsed.filters.text,
        channel: parsed.filters.channelId,
        before_created_at: parsed.filters.before,
        page_size: SEARCH_QUERY_LIMITS.pageSize,
        author: parsed.filters.authorId,
        after_created_at: parsed.filters.after,
        has: parsed.filters.has,
      });
      if (ticket !== runRef.current) return;

      setBusy(false);
      if (error) {
        setFailed("Messages could not be searched.");
        setHits([]);
        return;
      }
      setHits((data ?? []) as Hit[]);
    },
    [dictionary],
  );

  // Typing drives the message search on a timer; the local sections above it
  // have already re-ranked synchronously by the time this is scheduled.
  //
  // Only the scheduling is an effect. Emptying the box clears the message half
  // in the handler below, because that is a consequence of the keystroke and
  // not of a render — doing it here would be a setState inside an effect, and
  // a cascading render on every character.
  useEffect(() => {
    if (!open || raw.trim() === "") return;
    const timer = window.setTimeout(() => void runMessages(raw), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, raw, runMessages]);

  /*
    Keep the highlighted row on screen.

    The switcher never needed it — twenty rows in a 288px box, and arrowing past
    the fold simply lost the highlight. Written against the DOM rather than a ref
    per row because the rows come from two separately rendered lists.
  */
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, rows]);

  /** Forget the message half, and make any request still in flight irrelevant. */
  const clearMessages = useCallback(() => {
    runRef.current += 1;
    setHits(null);
    setProblems([]);
    setChips([]);
    setBusy(false);
  }, []);

  function setOpen(next: boolean) {
    if (!next) {
      setRaw("");
      setCursor(0);
      clearMessages();
    }
    onOpenChange(next);
  }

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const openLocal = (result: RankedResult) => {
    if (result.kind === "member") {
      setOpen(false);
      openProfile(result.id);
      return;
    }
    if (result.kind === "channel") {
      go(`/channels/${result.id}`);
      return;
    }
    // A category is not a page. Opening its first channel is what somebody
    // means by choosing one, and it is what clicking it in the sidebar does.
    const first = reachable.find((channel) => channel.categoryId === result.id);
    if (first) go(`/channels/${first.id}`);
  };

  const activate = (row: Row) => {
    if (row.kind === "local") {
      openLocal(row.result);
      return;
    }
    // The channel view honours `?jump=` once, scrolling to the message and
    // flashing it.
    go(`/channels/${row.hit.channel_id}?jump=${row.hit.id}`);
  };

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (rows.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((index) => (index + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((index) => (index - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = rows[selectedIndex];
      if (target) activate(target);
    }
  }

  const indexOfLocal = (result: RankedResult) =>
    rows.findIndex((row) => row.kind === "local" && row.result.kind === result.kind && row.result.id === result.id);
  const indexOfHit = (hit: Hit) => rows.findIndex((row) => row.kind === "hit" && row.hit.id === hit.id);
  const isSelected = (index: number) => index >= 0 && index === selectedIndex;

  const searching = raw.trim() !== "";
  const emptyHanded =
    searching && problems.length === 0 && local.length === 0 && hits !== null && hits.length === 0 && !busy;

  return (
    <Overlay open={open} onOpenChange={setOpen}>
      <OverlayContent placement="responsive" size="md" density="chrome" showCloseButton={false}>
        <OverlayTitle className="sr-only">Search the community</OverlayTitle>

        <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border-hairline px-chrome-x">
          <Search size={16} aria-hidden="true" className="shrink-0 text-text-faint" />
          <input
            autoFocus
            value={raw}
            onChange={(event) => {
              const next = event.target.value;
              setRaw(next);
              setCursor(0);
              if (next.trim() === "") clearMessages();
            }}
            onKeyDown={onKeyDown}
            placeholder="Go to a channel, or search people and messages"
            aria-label="Search channels, categories, members and messages. Filters: from: in: has: before: after:"
            // `self-stretch`, not a taller row: the row is already 44px and the
            // input was 24px of it, so the top and bottom 10px of the field did
            // nothing when tapped. Filling the row makes the target the row.
            className="min-w-0 flex-1 self-stretch bg-transparent text-content-base text-text-strong outline-none placeholder:text-text-faint"
          />
          {busy ? <Loader2 size={14} aria-hidden="true" className="shrink-0 animate-spin text-text-faint" /> : null}
        </div>

        <OverlayBody ref={listRef} className="px-0 py-1.5">
          {KIND_ORDER.map((kind) => {
            const results = grouped.get(kind);
            if (!results || results.length === 0) return null;
            return (
              <section key={kind} aria-label={KIND_LABEL[kind]}>
                <h2 className="px-chrome-x pt-2.5 pb-1.5 font-mono text-mono-xs tracking-widest text-text-faint uppercase">
                  {KIND_LABEL[kind]}
                </h2>
                {results.map((result) => {
                  const index = indexOfLocal(result);
                  const selected = isSelected(index);
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      data-selected={selected || undefined}
                      aria-current={selected ? true : undefined}
                      onClick={() => openLocal(result)}
                      onPointerMove={() => setCursor(index)}
                      className={`focus-ring relative flex min-h-11 w-full items-center gap-2.5 px-chrome-x text-left transition-colors sm:min-h-[34px] ${
                        selected ? "bg-surface-raised text-text-strong" : "text-text-default hover:bg-surface-raised"
                      }`}
                    >
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 left-0 h-[18px] w-0.5 -translate-y-1/2 bg-primary"
                        />
                      ) : null}
                      <KindIcon kind={result.kind} />
                      <span className="truncate text-content-sm">{result.name}</span>
                      {result.detail ? (
                        <span className="ml-auto shrink-0 truncate text-chrome-sm text-text-faint">
                          {result.detail}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            );
          })}

          {/*
            Everything the parser complains about belongs to this section and
            nowhere else. Shown at the top it read as a failed search: typing
            one letter put "search for at least 2 characters" in red above a
            list of channels and people that had already answered.
          */}
          {problems.length > 0 && searching ? (
            <section aria-label="Messages">
              <h2 className="flex items-center gap-2 px-chrome-x pt-2.5 pb-1.5 font-mono text-mono-xs tracking-widest text-text-faint uppercase">
                <MessageSquareText size={12} aria-hidden="true" />
                Messages
              </h2>
              <ul role="status" className="space-y-0.5 px-chrome-x py-1.5">
                {problems.map((problem) => (
                  <li key={problem} className="text-chrome-sm text-text-muted">
                    {problem}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hits !== null && problems.length === 0 ? (
            <section aria-label="Messages">
              <h2 className="flex items-center gap-2 px-chrome-x pt-2.5 pb-1.5 font-mono text-mono-xs tracking-widest text-text-faint uppercase">
                <MessageSquareText size={12} aria-hidden="true" />
                {failed ?? `Messages — ${hits.length}${hits.length === SEARCH_QUERY_LIMITS.pageSize ? "+" : ""}`}
                {chips.map((chip) => (
                  <span key={chip} className="rounded-sm border border-border-hairline px-1 text-chrome-xs normal-case">
                    {chip}
                  </span>
                ))}
              </h2>

              {hits.map((hit) => {
                const index = indexOfHit(hit);
                const selected = isSelected(index);
                return (
                  <button
                    key={hit.id}
                    type="button"
                    data-selected={selected || undefined}
                    aria-current={selected ? true : undefined}
                    onClick={() => go(`/channels/${hit.channel_id}?jump=${hit.id}`)}
                    onPointerMove={() => setCursor(index)}
                    className={`focus-ring relative block min-h-11 w-full px-chrome-x py-2 text-left transition-colors ${
                      selected ? "bg-surface-raised" : "hover:bg-surface-raised"
                    }`}
                  >
                    {selected ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 left-0 h-[18px] w-0.5 -translate-y-1/2 bg-primary"
                      />
                    ) : null}
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-chrome-base font-medium text-text-strong">
                        {hit.author_name ?? "Former member"}
                      </span>
                      <span className="shrink-0 text-chrome-sm text-text-faint">{`#${hit.channel_name}`}</span>
                      <time dateTime={hit.created_at} className="ml-auto shrink-0 text-chrome-sm text-text-faint">
                        {new Date(hit.created_at).toLocaleDateString()}
                      </time>
                    </span>
                    {/*
                      Plain text, not markdown: a result is a pointer to a
                      message, and rendering a spoiler inside a search result
                      would hide the very words that matched.
                    */}
                    <span className="mt-0.5 line-clamp-2 block text-chrome-base text-text-default">
                      {hit.body ?? "(no text)"}
                    </span>
                  </button>
                );
              })}
            </section>
          ) : null}

          {emptyHanded ? <p className="py-8 text-center text-chrome-base text-text-muted">Nothing matched.</p> : null}

          {!searching && local.length === 0 ? (
            <p className="py-8 text-center text-chrome-base text-text-muted">There is no channel here you can open.</p>
          ) : null}
        </OverlayBody>

        <div className="hidden h-chrome-row shrink-0 items-center gap-4 border-t border-border-hairline px-chrome-x font-mono text-mono-xs text-text-faint sm:flex">
          <span>
            <Key>↑</Key>
            <Key>↓</Key> move
          </span>
          <span>
            <Key>↵</Key> open
          </span>
          <span>
            <Key>esc</Key> close
          </span>
          <span className="ml-auto">from: in: has: before: after:</span>
        </div>
      </OverlayContent>
    </Overlay>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-1 inline-block rounded-sm border border-border-hairline px-1 text-text-muted">{children}</kbd>
  );
}
