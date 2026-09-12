"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { useCommunity } from "@/components/channels/CommunityProvider";
import { describeFilters, parseSearchQuery } from "@/lib/channels/search-query";
import { SEARCH_QUERY_LIMITS } from "@/lib/community/constants";
import { createClient } from "@/lib/supabase/client";

/**
 * Search, with `from: in: has: before: after:` resolved before the query
 * leaves the browser.
 *
 * The parse lives in `search-query.ts` and is tested there. What this adds is
 * the part a unit test cannot check: a filter that matched nobody is shown as
 * a sentence and the search is *not* run — a search that quietly drops
 * `from:someone` returns everybody's messages and looks like it worked.
 *
 * A result is a jump to `?jump=`, which the channel view already knows how to
 * scroll to and flash.
 */

type Hit = {
  id: string;
  channel_id: string;
  channel_name: string;
  author_name: string | null;
  body: string | null;
  created_at: string;
};

export function SearchBar() {
  const { dictionary } = useCommunity();
  const router = useRouter();

  const [raw, setRaw] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // Only the newest search may write results: a slow first request must not
  // land on top of a fast second one and answer the previous question.
  const runRef = useRef(0);

  const run = useCallback(async () => {
    const parsed = parseSearchQuery(raw, dictionary);
    setProblems(parsed.problems);
    setChips(describeFilters(parsed.filters, dictionary));
    setFailed(null);

    if (!parsed.runnable) {
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
      setFailed("That search could not be run.");
      setHits([]);
      return;
    }
    setHits((data ?? []) as Hit[]);
  }, [raw, dictionary]);

  const clear = () => {
    runRef.current += 1;
    setRaw("");
    setHits(null);
    setProblems([]);
    setChips([]);
    setFailed(null);
  };

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
        className="flex items-center gap-1 rounded-lg border border-surgical-steel bg-surface-container-lowest px-2 py-1"
      >
        <Search size={14} aria-hidden="true" className="shrink-0 text-fog-muted" />
        <input
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") clear();
          }}
          placeholder="Search"
          aria-label="Search messages. Filters: from: in: has: before: after:"
          className="min-w-0 flex-1 bg-transparent text-xs text-on-surface outline-none placeholder:text-fog-muted"
        />
        {busy ? <Loader2 size={12} className="shrink-0 animate-spin text-fog-muted" aria-hidden="true" /> : null}
        {raw !== "" && !busy ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear the search"
            className="focus-ring shrink-0 rounded p-0.5 text-fog-muted hover:text-on-surface"
          >
            <X size={12} aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {problems.length > 0 ? (
        <ul role="alert" className="mt-1 space-y-0.5">
          {problems.map((problem) => (
            <li key={problem} className="text-[11px] text-red-300">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      {hits !== null && problems.length === 0 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-lg border border-surgical-steel bg-surface-container-low shadow-lg">
          <p className="flex items-center gap-2 border-b border-surgical-steel px-2 py-1.5 text-[11px] text-fog-muted">
            <span>{failed ?? `${hits.length}${hits.length === SEARCH_QUERY_LIMITS.pageSize ? "+" : ""} found`}</span>
            {chips.map((chip) => (
              <span key={chip} className="rounded border border-surgical-steel px-1 text-[10px]">
                {chip}
              </span>
            ))}
          </p>

          {hits.length === 0 && !failed ? (
            <p className="px-2 py-4 text-center text-[11px] text-fog-muted">Nothing matched.</p>
          ) : null}

          {hits.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => {
                clear();
                // The channel view honours `?jump=` once, scrolling to the
                // message and flashing it.
                router.push(`/channels/${hit.channel_id}?jump=${hit.id}`);
              }}
              className="focus-ring block w-full border-b border-surgical-steel/40 px-2 py-1.5 text-left last:border-0 hover:bg-surface-container-lowest"
            >
              <span className="flex items-baseline gap-1.5">
                <span className="truncate text-[11px] font-medium text-on-surface">
                  {hit.author_name ?? "Former member"}
                </span>
                <span className="shrink-0 text-[10px] text-fog-muted">{`#${hit.channel_name}`}</span>
                <time dateTime={hit.created_at} className="ml-auto shrink-0 text-[10px] text-fog-muted">
                  {new Date(hit.created_at).toLocaleDateString()}
                </time>
              </span>
              {/*
                Plain text, not markdown: a result is a pointer to a message,
                and rendering a spoiler inside a search result would hide the
                very words that matched.
              */}
              <span className="mt-0.5 line-clamp-2 block text-[11px] text-on-surface-variant">
                {hit.body ?? "(no text)"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
