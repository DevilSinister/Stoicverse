"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Hash, Loader2, MessageSquareText, Search, User, X } from "lucide-react";

import { useCommunity } from "@/components/channels/CommunityProvider";
import { describeFilters, parseSearchQuery } from "@/lib/channels/search-query";
import { localCandidates, rankLocal, type RankedResult, type SearchKind } from "@/lib/channels/search-index";
import { SEARCH_QUERY_LIMITS } from "@/lib/community/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * One search over everything: channels, categories, members and messages.
 *
 * It is a modal rather than a dropdown because of where it now lives. In the
 * channel header there is no room beneath it to hang a panel, and on a phone
 * there is no room beside it either — so it takes the screen, which is also
 * what it deserves when somebody is looking for something.
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

const KIND_LABEL: Record<SearchKind, string> = {
  channel: "Channels",
  category: "Categories",
  member: "Members",
};

function KindIcon({ kind }: { kind: SearchKind }) {
  if (kind === "channel") return <Hash size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />;
  if (kind === "category") return <Folder size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />;
  return <User size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />;
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { channels, members, dictionary, openProfile } = useCommunity();
  const router = useRouter();

  const [raw, setRaw] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Only the newest search may write results: a slow first request must not
  // land on top of a fast second one and answer the previous question.
  const runRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const candidates = useMemo(() => localCandidates(channels, members), [channels, members]);
  const local = useMemo(() => rankLocal(candidates, raw), [candidates, raw]);

  const grouped = useMemo(() => {
    const byKind = new Map<SearchKind, RankedResult[]>();
    for (const result of local) {
      const existing = byKind.get(result.kind);
      if (existing) existing.push(result);
      else byKind.set(result.kind, [result]);
    }
    return byKind;
  }, [local]);

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
    if (raw.trim() === "") return;
    const timer = window.setTimeout(() => void runMessages(raw), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [raw, runMessages]);

  /** Forget the message half, and make any request still in flight irrelevant. */
  const clearMessages = () => {
    runRef.current += 1;
    setHits(null);
    setProblems([]);
    setChips([]);
    setBusy(false);
  };

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const open = (result: RankedResult) => {
    if (result.kind === "member") {
      onClose();
      openProfile(result.id);
      return;
    }
    if (result.kind === "channel") {
      go(`/channels/${result.id}`);
      return;
    }
    // A category is not a page. Opening its first channel is what somebody
    // means by choosing one, and it is what clicking it in the sidebar does.
    const first = channels.find((channel) => channel.categoryId === result.id);
    if (first) go(`/channels/${first.id}`);
  };

  const nothingYet = raw.trim() === "";
  const emptyHanded =
    !nothingYet && problems.length === 0 && local.length === 0 && hits !== null && hits.length === 0 && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search the community"
      className="fixed inset-0 z-70 flex items-start justify-center bg-scrim p-0 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {/*
        Full height on a phone and a panel below the top on anything larger: a
        sheet that covers the screen is the only shape that leaves room for
        results on a small one, and a full-screen dialog on a desktop would be
        a lot of black for one line of typing.
      */}
      <div className="flex h-full w-full flex-col overflow-hidden border-surgical-steel bg-surface-container-low sm:mt-12 sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-xl sm:border sm:shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-surgical-steel px-3 py-3">
          <Search size={16} aria-hidden="true" className="shrink-0 text-fog-muted" />
          <input
            ref={inputRef}
            value={raw}
            onChange={(event) => {
              const next = event.target.value;
              setRaw(next);
              if (next.trim() === "") clearMessages();
            }}
            placeholder="Search channels, people and messages"
            aria-label="Search channels, categories, members and messages. Filters: from: in: has: before: after:"
            className="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-fog-muted"
          />
          {busy ? <Loader2 size={14} className="shrink-0 animate-spin text-fog-muted" aria-hidden="true" /> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="focus-ring hit-target relative shrink-0 rounded-lg p-1 text-fog-muted hover:text-on-surface"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {nothingYet ? (
            <p className="px-3 py-8 text-center text-xs text-fog-muted">
              Channels, categories and people answer as you type. Messages follow a moment behind.
            </p>
          ) : null}

          {(["channel", "category", "member"] as const).map((kind) => {
            const rows = grouped.get(kind);
            if (!rows || rows.length === 0) return null;
            return (
              <section key={kind} aria-label={KIND_LABEL[kind]}>
                <h2 className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                  {KIND_LABEL[kind]}
                </h2>
                {rows.map((result) => (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    onClick={() => open(result)}
                    className="focus-ring min-h-11 flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-container-lowest"
                  >
                    <KindIcon kind={result.kind} />
                    <span className="truncate text-sm text-on-surface">{result.name}</span>
                    {result.detail ? (
                      <span className="ml-auto shrink-0 truncate text-[11px] text-fog-muted">{result.detail}</span>
                    ) : null}
                  </button>
                ))}
              </section>
            );
          })}

          {/*
            Everything the parser complains about belongs to this section and
            nowhere else. Shown at the top it read as a failed search: typing
            one letter put "search for at least 2 characters" in red above a
            list of channels and people that had already answered.
          */}
          {problems.length > 0 && !nothingYet ? (
            <section aria-label="Messages">
              <h2 className="flex items-center gap-2 px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                <MessageSquareText size={12} aria-hidden="true" />
                Messages
              </h2>
              <ul role="status" className="space-y-0.5 px-3 py-1.5">
                {problems.map((problem) => (
                  <li key={problem} className="text-[11px] text-on-surface-variant">
                    {problem}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hits !== null && problems.length === 0 ? (
            <section aria-label="Messages">
              <h2 className="flex items-center gap-2 px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-muted">
                <MessageSquareText size={12} aria-hidden="true" />
                {failed ?? `Messages — ${hits.length}${hits.length === SEARCH_QUERY_LIMITS.pageSize ? "+" : ""}`}
                {chips.map((chip) => (
                  <span key={chip} className="rounded border border-surgical-steel px-1 text-[10px] normal-case">
                    {chip}
                  </span>
                ))}
              </h2>

              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  // The channel view honours `?jump=` once, scrolling to the
                  // message and flashing it.
                  onClick={() => go(`/channels/${hit.channel_id}?jump=${hit.id}`)}
                  className="focus-ring min-h-11 block w-full px-3 py-2 text-left hover:bg-surface-container-lowest"
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-xs font-medium text-on-surface">
                      {hit.author_name ?? "Former member"}
                    </span>
                    <span className="shrink-0 text-[10px] text-fog-muted">{`#${hit.channel_name}`}</span>
                    <time dateTime={hit.created_at} className="ml-auto shrink-0 text-[10px] text-fog-muted">
                      {new Date(hit.created_at).toLocaleDateString()}
                    </time>
                  </span>
                  {/*
                    Plain text, not markdown: a result is a pointer to a
                    message, and rendering a spoiler inside a search result
                    would hide the very words that matched.
                  */}
                  <span className="mt-0.5 line-clamp-2 block text-xs text-on-surface-variant">
                    {hit.body ?? "(no text)"}
                  </span>
                </button>
              ))}
            </section>
          ) : null}

          {emptyHanded ? <p className="px-3 py-8 text-center text-xs text-fog-muted">Nothing matched.</p> : null}
        </div>
      </div>
    </div>
  );
}
