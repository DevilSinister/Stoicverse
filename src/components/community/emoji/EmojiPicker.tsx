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
  buildIndex,
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

async function loadIndex(): Promise<EmojiIndex> {
  if (cachedIndex) return cachedIndex;
  if (!pendingIndex) {
    pendingIndex = Promise.all([
      import("emojibase-data/en/compact.json"),
      import("emojibase-data/en/shortcodes/emojibase.json"),
    ])
      .then(([data, shortcodes]) => {
        cachedIndex = buildIndex(data.default, shortcodes.default);
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

  const jumpTo = (group: number) => {
    setQuery("");
    setActiveGroup(group);
    requestAnimationFrame(() => {
      const node = groupRefs.current.get(group);
      const scroller = scrollerRef.current;
      if (node && scroller) scroller.scrollTo({ top: node.offsetTop - scroller.offsetTop, behavior: "auto" });
    });
  };

  // Scroll spy: the rail highlights the group whose heading last crossed the top.
  const onScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || results) return;
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
              {EMOJI_GROUPS.map((group) => (
                <section
                  key={group.id}
                  ref={(node) => {
                    if (node) groupRefs.current.set(group.id, node);
                  }}
                  aria-labelledby={`emoji-group-${group.key}`}
                  style={{ contentVisibility: "auto", containIntrinsicSize: "0 320px" }}
                >
                  {heading(`emoji-group-${group.key}`, group.label)}
                  <div className="grid grid-cols-9 gap-0.5">
                    {(index.byGroup.get(group.id) ?? []).map(renderGlyphButton)}
                  </div>
                </section>
              ))}
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
