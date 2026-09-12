"use client";

import {
  Cat,
  Clock,
  Flag,
  Hash,
  Lightbulb,
  Pizza,
  Plane,
  Search,
  Smile,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applySkinTone,
  EMOJI_PAYLOAD_URL,
  EMOJI_PAYLOAD_VERSION,
  fromPayload,
  type EmojiPayload,
  EMOJI_GROUPS,
  frequentlyUsed,
  isSkinTone,
  recordUse,
  searchEmoji,
  SKIN_TONE_SAMPLES,
  type EmojiEntry,
  type EmojiIndex,
  type FrecencyRecord,
  type SkinTone,
} from "@/components/community/emoji/emoji-index";
import { QUICK_REACTIONS } from "@/lib/community/constants";

/**
 * The one emoji picker: Discord's layout (search, category rail, grouped grid
 * of native glyphs, hover preview, skin tone) on the Stoicverse tokens. Used
 * by the composer, the reaction bar, the role icon field and the custom-emoji
 * manager, so there is exactly one place emoji are chosen.
 *
 * The dataset is fetched from the bundle on first open (`import()` of the
 * emojibase JSON), never from a CDN — the content security policy forbids one.
 */

export type CustomEmojiOption = { id: string; name: string; url: string };

export type EmojiSelection =
  | { kind: "unicode"; glyph: string; shortcode: string | null }
  | { kind: "custom"; id: string; name: string };

export type EmojiPickerProps = {
  /** "insert" puts a glyph in text; "react" adds a reaction. Only the copy differs. */
  mode: "insert" | "react";
  customEmojis?: readonly CustomEmojiOption[];
  onSelect: (selection: EmojiSelection) => void;
  /** Called on Escape. The parent owns open state. */
  onClose?: () => void;
  autoFocus?: boolean;
  className?: string;
};

const TONE_KEY = "sv-emoji-tone";
const FRECENCY_KEY = "sv-emoji-frecency";
const CUSTOM_GROUP = -1;
const FREQUENT_GROUP = -2;
const COLUMNS = 9;

const GROUP_ICONS: Record<string, LucideIcon> = {
  smileys: Smile,
  people: Users,
  nature: Cat,
  food: Pizza,
  travel: Plane,
  activities: Trophy,
  objects: Lightbulb,
  symbols: Hash,
  flags: Flag,
};

let cachedIndex: EmojiIndex | null = null;
let pendingIndex: Promise<EmojiIndex> | null = null;

/**
 * Fetched, not imported.
 *
 * This used to `import()` emojibase's `compact.json` and its shortcodes — 830
 * KB of JSON as JavaScript chunks, filtered and merged on every first open,
 * measured at 500 ms from click to grid. `scripts/build-emoji-index.mjs` does
 * that work once and commits the result; what arrives here is 179 KB of
 * already-sorted, already-merged index that the browser caches like any other
 * static file and never has to parse as code.
 *
 * Same-origin, which `connect-src 'self'` allows. Still module-scoped, so the
 * second picker on a page pays nothing.
 */
async function loadIndex(): Promise<EmojiIndex> {
  if (cachedIndex) return cachedIndex;
  if (!pendingIndex) {
    pendingIndex = fetch(EMOJI_PAYLOAD_URL, { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`emoji index ${response.status}`);
        const payload = (await response.json()) as EmojiPayload;
        if (payload.v !== EMOJI_PAYLOAD_VERSION) {
          // The filename carries the version too, so this only fires if the
          // two disagree — a stale file served under a fresh name.
          throw new Error(`emoji index version ${String(payload.v)}`);
        }
        cachedIndex = fromPayload(payload);
        return cachedIndex;
      })
      .catch((error: unknown) => {
        pendingIndex = null;
        throw error;
      });
  }
  return pendingIndex;
}

function readTone(): SkinTone {
  try {
    const raw = Number(window.localStorage.getItem(TONE_KEY));
    return isSkinTone(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

function readFrecency(): FrecencyRecord {
  try {
    const raw = window.localStorage.getItem(FRECENCY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as FrecencyRecord) : {};
  } catch {
    return {};
  }
}

function persist(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable; the picker still works for this session.
  }
}

type Preview = { glyph: string; label: string; shortcode: string | null };

export function EmojiPicker({ mode, customEmojis = [], onSelect, onClose, autoFocus = true, className }: EmojiPickerProps) {
  const [index, setIndex] = useState<EmojiIndex | null>(cachedIndex);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  // Lazy initialisers: the picker only ever mounts on the client, after a click,
  // so reading storage here cannot cause a hydration mismatch.
  const [tone, setTone] = useState<SkinTone>(readTone);
  const [toneOpen, setToneOpen] = useState(false);
  const [frecency, setFrecency] = useState<FrecencyRecord>(readFrecency);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [activeGroup, setActiveGroup] = useState<number>(EMOJI_GROUPS[0].id);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Which groups have been built. Only ever grows.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set<number>());
  const searchRef = useRef<HTMLInputElement>(null);
  const groupRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (index) return;
    let cancelled = false;
    loadIndex()
      .then((loaded) => {
        if (!cancelled) setIndex(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [index, attempt]);

  useEffect(() => {
    if (autoFocus) searchRef.current?.focus();
  }, [autoFocus]);


  const results = useMemo(() => (index && query.trim() ? searchEmoji(index, query) : null), [index, query]);

  // Frequently used, or the platform quick-picks until this member has a history.
  const frequent = useMemo(() => {
    if (!index) return [];
    const used = frequentlyUsed(frecency);
    const glyphs = used.length > 0 ? used : [...QUICK_REACTIONS];
    return glyphs.map((glyph) => index.byUnicode.get(glyph)).filter((entry): entry is EmojiEntry => Boolean(entry));
  }, [frecency, index]);

  const choose = useCallback(
    (entry: EmojiEntry) => {
      const glyph = applySkinTone(entry, tone);
      const next = recordUse(frecency, entry.unicode, Date.now());
      setFrecency(next);
      persist(FRECENCY_KEY, JSON.stringify(next));
      onSelect({ kind: "unicode", glyph, shortcode: entry.shortcodes[0] ?? null });
    },
    [frecency, onSelect, tone],
  );

  const chooseTone = (next: SkinTone) => {
    setTone(next);
    persist(TONE_KEY, String(next));
    setToneOpen(false);
  };

  /**
   * Build every group within a screen-and-a-bit of the viewport.
   *
   * Read from the scroller's own offsets, which are exact because an unbuilt
   * group already occupies the height it will have. Called on scroll, after a
   * jump, and once the index arrives — the three moments the answer can change.
   */
  const expandVisible = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = scroller.scrollTop - EXPAND_MARGIN_PX;
    const bottom = scroller.scrollTop + scroller.clientHeight + EXPAND_MARGIN_PX;
    const reached: number[] = [];
    for (const [group, node] of groupRefs.current) {
      if (group < 0) continue;
      const start = node.offsetTop - scroller.offsetTop;
      if (start + node.offsetHeight >= top && start <= bottom) reached.push(group);
    }
    if (reached.length === 0) return;
    setExpanded((current) => {
      if (reached.every((group) => current.has(group))) return current;
      const next = new Set(current);
      for (const group of reached) next.add(group);
      return next;
    });
  };

  const jumpTo = (group: number) => {
    setQuery("");
    setActiveGroup(group);
    requestAnimationFrame(() => {
      const node = groupRefs.current.get(group);
      const scroller = scrollerRef.current;
      if (node && scroller) scroller.scrollTo({ top: node.offsetTop - scroller.offsetTop, behavior: "auto" });
      // After the scroll, or the jump lands on a group that is still a
      // placeholder and stays one until something else moves.
      expandVisible();
    });
  };

  // Kept current in an effect rather than assigned during render, the same
  // way `useChannelLive` carries its handlers. `expandVisible` is a plain
  // function — memoising it bought nothing and cost the React compiler the
  // ability to optimise this component at all.
  const expandRef = useRef(expandVisible);
  useEffect(() => {
    expandRef.current = expandVisible;
  });

  /**
   * The first groups, once there is something to measure.
   *
   * Runs after the placeholders have laid out, so their offsets are real. It
   * only ever adds, and `expandVisible` returns the same Set when nothing
   * changed, so this settles in one pass rather than re-rendering forever.
   */
  useEffect(() => {
    if (!index || results) return;
    expandRef.current();
  }, [index, results]);

  // Scroll spy: the rail highlights the group whose heading last crossed the top.
  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || results) return;
    expandVisible();
    const top = scroller.scrollTop + scroller.offsetTop + 8;
    let current = activeGroup;
    for (const [group, node] of groupRefs.current) {
      if (node.offsetTop <= top) current = group;
    }
    if (current !== activeGroup) setActiveGroup(current);
  };

  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName !== "BUTTON") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-emoji]"));
    const position = buttons.indexOf(target as HTMLButtonElement);
    if (position < 0) return;
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };
    const delta = step[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, position + delta))]?.focus();
  };

  const show = (next: Preview) => () => setPreview(next);

  const renderGlyphButton = (entry: EmojiEntry) => {
    const glyph = applySkinTone(entry, tone);
    const next: Preview = { glyph, label: entry.label, shortcode: entry.shortcodes[0] ?? null };
    return (
      <button
        key={entry.hexcode}
        type="button"
        data-emoji={entry.unicode}
        aria-label={entry.label}
        onClick={() => choose(entry)}
        onMouseEnter={show(next)}
        onFocus={show(next)}
        className="focus-ring grid size-9 place-items-center rounded-lg text-[22px] leading-none transition hover:bg-surface-container-high"
      >
        {glyph}
      </button>
    );
  };

  const renderCustomButton = (emoji: CustomEmojiOption) => {
    const next: Preview = { glyph: "", label: `:${emoji.name}:`, shortcode: null };
    return (
      <button
        key={emoji.id}
        type="button"
        data-emoji={`<:${emoji.name}:${emoji.id}>`}
        aria-label={`:${emoji.name}:`}
        onClick={() => onSelect({ kind: "custom", id: emoji.id, name: emoji.name })}
        onMouseEnter={show(next)}
        onFocus={show(next)}
        className="focus-ring grid size-9 place-items-center rounded-lg transition hover:bg-surface-container-high"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- storage URL, sized by the button */}
        <img src={emoji.url} alt="" className="size-6 object-contain" loading="lazy" />
      </button>
    );
  };

  const heading = (id: string, label: string) => (
    <h3
      id={id}
      className="terminal-label sticky top-0 z-[1] bg-monolith-surface px-1 py-1.5 text-[11px] uppercase tracking-wider text-fog-muted"
    >
      {label}
    </h3>
  );

  const railGroups = [
    ...(frequent.length > 0 ? [{ id: FREQUENT_GROUP, key: "frequent", label: "Frequently used" }] : []),
    ...(customEmojis.length > 0 ? [{ id: CUSTOM_GROUP, key: "custom", label: "Custom" }] : []),
    ...EMOJI_GROUPS,
  ];

  return (
    <div
      role="dialog"
      aria-label={mode === "react" ? "Add a reaction" : "Insert an emoji"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose?.();
        }
      }}
      className={`flex h-[26rem] w-[min(22.5rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-surgical-steel bg-monolith-surface text-on-surface shadow-[0_18px_48px_-24px_rgba(0,0,0,0.9)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-surgical-steel p-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-fog-muted" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "react" ? "Find the perfect reaction" : "Find the perfect emoji"}
            aria-label="Search emoji"
            className="focus-ring h-9 w-full rounded-lg border border-surgical-steel bg-surface-container-low pl-8 pr-2 text-base text-on-surface placeholder:text-fog-muted sm:text-sm"
          />
        </label>
        <div className="relative">
          <button
            type="button"
            aria-label={`Skin tone: ${tone === 0 ? "default" : `tone ${tone}`}`}
            aria-expanded={toneOpen}
            aria-haspopup="listbox"
            onClick={() => setToneOpen((open) => !open)}
            className="focus-ring grid size-9 place-items-center rounded-lg text-xl hover:bg-surface-container-high"
          >
            {SKIN_TONE_SAMPLES[tone]}
          </button>
          {toneOpen && (
            <ul
              role="listbox"
              aria-label="Skin tone"
              className="absolute right-0 top-full z-10 mt-1 flex gap-0.5 rounded-lg border border-surgical-steel bg-monolith-surface p-1 shadow-lg"
            >
              {SKIN_TONE_SAMPLES.map((sample, value) => (
                <li key={sample}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={tone === value}
                    aria-label={value === 0 ? "Default tone" : `Tone ${value}`}
                    onClick={() => chooseTone(value as SkinTone)}
                    className={`focus-ring grid size-9 place-items-center rounded-lg text-xl hover:bg-surface-container-high ${
                      tone === value ? "bg-surface-container-high" : ""
                    }`}
                  >
                    {sample}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Emoji categories"
          className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-surgical-steel py-2"
        >
          {railGroups.map((group) => {
            const Icon = group.id === FREQUENT_GROUP ? Clock : group.id === CUSTOM_GROUP ? Sparkles : GROUP_ICONS[group.key];
            const isActive = !results && activeGroup === group.id;
            return (
              <button
                key={group.key}
                type="button"
                aria-label={group.label}
                aria-current={isActive ? "true" : undefined}
                title={group.label}
                onClick={() => jumpTo(group.id)}
                className={`focus-ring grid size-9 place-items-center rounded-lg transition ${
                  isActive
                    ? "bg-surface-container-high text-white"
                    : "text-fog-muted hover:bg-surface-container-high/60 hover:text-white"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        <div ref={scrollerRef} onScroll={onScroll} onKeyDown={onGridKeyDown} className="min-w-0 flex-1 overflow-y-auto px-2 py-1">
          {failed && (
            <div className="p-4 text-sm text-on-surface-variant" role="alert">
              Emoji could not be loaded.
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setAttempt((count) => count + 1);
                }}
                className="focus-ring ml-2 rounded px-1 font-semibold text-primary-container"
              >
                Try again
              </button>
            </div>
          )}

          {!index && !failed && (
            <div aria-busy="true" aria-label="Loading emoji" className="grid grid-cols-9 gap-1 p-1">
              {Array.from({ length: 63 }, (_, i) => (
                <div key={i} className="size-9 animate-pulse rounded-lg bg-surface-container-high/50" />
              ))}
            </div>
          )}

          {index && results && (
            <section aria-label="Search results">
              {results.length === 0 ? (
                <p className="p-4 text-sm text-on-surface-variant">No emoji match that.</p>
              ) : (
                <div className="grid grid-cols-9 gap-0.5">{results.map(renderGlyphButton)}</div>
              )}
            </section>
          )}

          {index && !results && (
            <>
              {frequent.length > 0 && (
                <section
                  ref={(node) => {
                    if (node) groupRefs.current.set(FREQUENT_GROUP, node);
                  }}
                  aria-labelledby="emoji-group-frequent"
                >
                  {heading("emoji-group-frequent", "Frequently used")}
                  <div className="grid grid-cols-9 gap-0.5">{frequent.map(renderGlyphButton)}</div>
                </section>
              )}
              {customEmojis.length > 0 && (
                <section
                  ref={(node) => {
                    if (node) groupRefs.current.set(CUSTOM_GROUP, node);
                  }}
                  aria-labelledby="emoji-group-custom"
                >
                  {heading("emoji-group-custom", "Custom")}
                  <div className="grid grid-cols-9 gap-0.5">{customEmojis.map(renderCustomButton)}</div>
                </section>
              )}
              {EMOJI_GROUPS.map((group) => {
                const rows = index.byGroup.get(group.id) ?? [];
                return (
                  <LazyGroup
                    key={group.id}
                    shown={expanded.has(group.id)}
                    count={rows.length}
                    sectionRef={(node) => {
                      if (node) groupRefs.current.set(group.id, node);
                    }}
                    labelledBy={`emoji-group-${group.key}`}
                  >
                    {heading(`emoji-group-${group.key}`, group.label)}
                    <div className="grid grid-cols-9 gap-0.5">{rows.map(renderGlyphButton)}</div>
                  </LazyGroup>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="flex h-12 items-center gap-3 border-t border-surgical-steel px-3" aria-live="polite">
        {preview ? (
          <>
            {preview.glyph && <span className="text-2xl leading-none">{preview.glyph}</span>}
            <span className="truncate text-sm font-semibold text-on-surface">
              {preview.shortcode ? `:${preview.shortcode}:` : preview.label}
            </span>
            {preview.shortcode && <span className="truncate font-label text-xs text-fog-muted">{preview.label}</span>}
          </>
        ) : (
          <span className="text-sm text-fog-muted">{mode === "react" ? "Pick a reaction" : "Pick an emoji"}</span>
        )}
      </div>
    </div>
  );
}

/** One button: 36 px tall on a 2 px gap. */
const GLYPH_ROW_PX = 38;
const HEADING_PX = 28;
/** How far beyond the viewport a group is built. */
const EXPAND_MARGIN_PX = 600;

/** The height a group will occupy once it is built, so the scrollbar is right before it is. */
function groupHeight(count: number): number {
  return Math.ceil(count / COLUMNS) * GLYPH_ROW_PX + HEADING_PX;
}

/**
 * A group that holds its place until it is worth building.
 *
 * Rendering all nine is 2,008 buttons and, measured, 298 ms of it — paid every
 * time the picker opens, long after the data is cached. `content-visibility`
 * already skipped painting them; it does not skip creating them, and creating
 * them was the cost.
 *
 * Which groups are built is decided by the scroller, not by an
 * IntersectionObserver: an observer rooted on this scroller never fired here,
 * not even for a section sitting on screen, and the picker already tracks
 * scroll position for its group rail. One mechanism, already working, rather
 * than a second one that has to be trusted.
 *
 * A built group is never taken down again — scrolling back up must not rebuild
 * what was just built.
 */
function LazyGroup({
  shown,
  count,
  sectionRef,
  labelledBy,
  children,
}: {
  shown: boolean;
  count: number;
  sectionRef: (node: HTMLElement | null) => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={sectionRef}
      aria-labelledby={shown ? labelledBy : undefined}
      aria-busy={shown ? undefined : true}
      style={shown ? undefined : { height: groupHeight(count) }}
    >
      {shown ? children : null}
    </section>
  );
}
