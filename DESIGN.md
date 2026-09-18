# Stoicverse Design System — Monolith

Last updated: September 13, 2026

This describes the system **as it is implemented**. When code and this document disagree, the
code is the source of truth and this document is the bug. Exact token values live in
`src/app/globals.css`; this file explains what they mean and when to reach for them.

> **Rewritten for the Monolith direction.** Rules this document previously carried that are now
> *reversed* — pill-shaped buttons, `text-white` headings, emerald as accent, gradient panels —
> are listed under "Reversed rules" so nobody re-introduces them from memory or an older branch.

---

## Direction

Stoicverse is a precise instrument, not a loud trading terminal, a generic SaaS dashboard, or a
social feed. The product is dense, quiet, and achromatic; colour is information, never decoration.

- **Achromatic surfaces.** Near-black greys carry every panel, header, menu and list. A surface's
  meaning comes from its depth in the stack, not from a hue.
- **Hairlines before fills.** Structure is drawn with 1px rules. Reach for a border before a
  background, and a background before a shadow.
- **One accent, and it means something.** Electric lime marks progression, focus, state and the
  primary action. If a lime pixel is not telling the reader something, it is wrong.
- **4px corners.** Sharp enough to read as an instrument, soft enough not to be brutalist.
- **Two rhythms, one language.** Chrome is dense. Reading content is generous. See "Density".

Banned: gradients, glassmorphism, decorative hero metrics, grids of identical icon-heading-text
cards, coloured glows, and any colour used because a section "needed some life".

---

## Palette

All values are semantic roles. Components name the role, never the literal.

### Surfaces

| Token | Value | Use |
| --- | --- | --- |
| `--surface-sunken` | `#050506` | Wells the eye sits *below*: the rail, scroll containers, the composer, inputs |
| `--surface-canvas` | `#0A0A0B` | The page |
| `--surface-panel` | `#141416` | Cards, panels, dialog bodies, popovers |
| `--surface-raised` | `#1F1F23` | Hover fills, table headers, row-raise, active list items |

`sunken` is deliberately **darker than canvas**. The rail and the composer read as recessed, not
elevated. Inverting that relationship flattens the rail against the page.

### Borders

| Token | Value | Use |
| --- | --- | --- |
| `--border-hairline` | `#242427` | The default rule. Almost every border in the product |
| `--border-strong` | `#35353A` | Emphasis, hover, an input at rest |

### Text

Measured contrast, not estimated:

| Token | Value | On canvas | On panel | On raised | Use |
| --- | --- | --- | --- | --- | --- |
| `--text-strong` | `#F2F2F3` | 17.69:1 | 16.45:1 | 14.68:1 | Headings, active nav, emphasis |
| `--text-default` | `#C9C9CE` | 12.00:1 | 11.15:1 | 9.96:1 | Body |
| `--text-muted` | `#8E8E97` | 6.09:1 | 5.67:1 | 5.06:1 | Metadata, labels, **placeholders**, rest-state nav |
| `--text-faint` | `#5A5A62` | 2.90:1 | 2.69:1 | 2.40:1 | **Disabled controls only** |

`--text-faint` does not meet AA and must never carry information a reader needs. A placeholder is
information, so placeholders use `--text-muted`. WCAG exempts disabled controls, and that is the
only thing `faint` is for.

`--text-muted` was set at `#8E8E97` rather than a darker grey on purpose: roughly 600 call sites
resolve to this one value, so it must clear AA on the *brightest* surface (`raised`, 5.06:1), not
merely on canvas. Any downward tweak for "quiet" is a product-wide accessibility regression from
a single CSS line.

Do not use `text-white`. Pure `#FFF` on `#0A0A0B` is 20.4:1 and reads as glare against an
achromatic ground.

### Accent and status

| Token | Value | On canvas | Use |
| --- | --- | --- | --- |
| `--accent` | `#C6F24E` | 15.28:1 | Progression, focus, state, primary action, brand |
| `--accent-contrast` | `#0A0A0B` | 15.28:1 on accent | Text and icons *on* an accent fill |
| `--accent-soft` | `color-mix(in oklab, accent 12%, transparent)` | — | Active rows, selected states |
| `--status-danger` | `#FF6B6B` | 7.13:1 | Destructive action, error |
| `--status-warn` | `#F5A524` | 9.70:1 | Warning, pending, expiring |
| `--status-ok` | `#4ADE9B` | 11.51:1 | Success, healthy, complete |
| `--scrim` | `rgb(0 0 0 / .72)` | — | Behind every overlay |

The accent is not a success colour. A completed course is `--status-ok`; a course you are
*currently progressing through* is `--accent`. Keeping those distinct is why both exist.

> **`tests/community-settings-ui.contract.mjs:50` pinned the old emerald accent**
> (`assert.match(dark, /--primary: #10B981;/)`). Changing the accent means changing that
> assertion in the same commit, with a comment saying what it now pins. It is a design decision
> under test, which is correct — it simply means the decision is changed deliberately, never
> incidentally.

---

## Typography

**Geist** for everything. **JetBrains Mono** for data, measurement, timestamps, counts, IDs and
code — never as a costume for "technical".

| Ramp | Tokens | Sizes | Line height |
| --- | --- | --- | --- |
| Chrome | `--text-chrome-xs / -sm / -base` | 11 / 12 / 13px | 1.3–1.4 |
| Content | `--text-content-sm / -base / -lg` | 14 / 15 / 17px | 1.6 |
| Titles | `--text-title-sm / -md / -lg` | 16 / 20 / 28px | tracking −0.01 to −0.02em |
| Display | `--text-display` | `clamp(2rem, 1.2rem + 3vw, 3.25rem)` | 1.1 |
| Mono | `--text-mono-xs / -sm` | 11 / 12px | tabular figures |

Two weights: 400 and 500. There is no 600 or 700 — weight is carried by colour and size, and a
heavier face on a near-black ground blooms rather than emphasises.

Body measure stays 65–75ch on reading surfaces.

---

## Density — two rhythms, one language

Enforced by *which token family a component names*, not by judgement.

**Chrome** — the rail, headers, toolbars, menus, context menus, tables, lists, the member column,
the channel list, dialog headers and footers. Dense, scannable, many things visible at once.

```
--spacing-chrome-x    12px      --spacing-chrome-row   32px
--spacing-chrome-y     8px      --spacing-chrome-bar   48px
--spacing-chrome-gap   8px
```

**Content** — courses, lessons, events, analytics narrative, settings bodies, marketing, auth.
Generous, one idea at a time, comfortable to read for minutes.

```
--spacing-content-x   24px      --spacing-section      48px
--spacing-content-y   32px      --spacing-gutter-page  16px (20px at sm and up)
--spacing-content-gap 20px
```

Shared components (`Card`, `PageHeader`, `Section`, `DataTable`, `EmptyState`) take
`density?: "chrome" | "content"`, defaulting to `"content"`. A contract test asserts chrome
surfaces use only `*-chrome-*` spacing and reading surfaces only `*-content-*`.

Mixed surfaces are legitimate: `ChannelView` is chrome (dense header, dense list) wrapping content
(message bodies are reading text). The tokens make that choice nameable and reviewable; they do
not make it automatic.

---

## Shape and elevation

**Radii are flat, not derived.** A derived scale off a 4px base produces 5.6px and 7.2px corners,
which shimmer on non-retina displays.

```
--radius-sm 2px   --radius-md 4px   --radius-lg 4px
--radius-xl 6px   --radius-2xl 6px  --radius-3xl 8px   --radius-4xl 8px
```

`rounded-full` survives for exactly four things: avatars, presence dots, unread badges, and the
rail's active marker. Buttons, inputs, chips and tags are **4px**. They were pill-shaped in the
previous system; they are not any more.

**Shadows are near-black and low-spread.** Elevation comes from the hairline, not the blur.

```
--shadow-xs   0 1px 0 0 rgb(0 0 0 / .40)
--shadow-sm   0 1px 2px 0 rgb(0 0 0 / .50)
--shadow-md   0 4px 12px -4px rgb(0 0 0 / .65)
--shadow-lg   0 12px 28px -12px rgb(0 0 0 / .75)
--shadow-xl   0 20px 48px -20px rgb(0 0 0 / .82)
--shadow-2xl  0 28px 72px -28px rgb(0 0 0 / .88)
```

Arbitrary `shadow-[...]` values are banned and gated by a contract test. Zero-offset coloured
halos are banned; there is no accent glow in this system.

---

## Layering

There is no `--z-*` namespace in Tailwind v4, so the scale is custom utilities:

| Utility | z | Use |
| --- | --- | --- |
| `z-base` | 0 | In-flow |
| `z-raised` | 10 | Sticky rows, in-flow layering |
| `z-sticky` | 20 | Sticky headers, composer |
| `z-rail` | 30 | The rail |
| `z-drawer` | 40 | Mobile panes |
| `z-scrim` | 50 | Overlay backdrop |
| `z-overlay` | 60 | Dialog and sheet popups |
| `z-menu` | 70 | A menu or popover opened *over* a dialog |
| `z-toast` | 90 | Toasts |

Arbitrary `z-[...]` and bare `z-50` are banned outside `globals.css`.

**This scale only works because overlays portal to `<body>`.** The previous ladder reached
`z-[81]` and `z-100` because `createPortal` appeared **zero times** in `src/` — every overlay
rendered in-tree and had to out-rank whatever ancestor it happened to sit inside. If you need a
number above 90, the real bug is that something is not portalling.

---

## Overlays

**One primitive: `src/components/ui/overlay.tsx`**, built on `@base-ui/react`'s Dialog, which
owns portalling, scroll lock, focus trap, focus restore and Escape. Do not hand-roll any of those
— a contract test bans `fixed inset-0` outside that file and bans keydown-Tab traps outside
`src/components/ui/`.

```
<Overlay open onOpenChange>
  <OverlayContent placement="responsive" size="md" density="content">
    <OverlayHeader/> <OverlayBody/> <OverlayFooter/>
  </OverlayContent>
</Overlay>
```

- `placement="responsive"` is the default: a bottom sheet below `sm`, a centred dialog at and
  above it. Written once, here, not re-derived per screen.
- Safe-area bottom padding and `max-h-[100svh]` live on `OverlayContent`.
- `alert-dialog` stays separate — `role="alertdialog"` and no dismiss-on-outside-click are
  genuinely different semantics, not a style variant.
- Destructive confirmation is `ui/confirm-dialog.tsx`. **`window.confirm`, `window.alert` and
  `window.prompt` are banned** and gated by a contract test. Transient failures are toasts, not
  in-flow error blocks — an error that reflows the page costs the reader their place.
- A dialog raised from *inside another dialog's dismiss path* (the unsaved-changes guard) must
  compose without a manual `z-[60]`. That is the primitive's hardest requirement.

---

## Interaction and accessibility

- **Focus is the shared `.focus-ring` only** — 2px accent at 2px offset, on `:focus-visible`.
  Do not hand-roll focus styles.
- **Touch targets are ≥44×44.** Dense chrome achieves this without growing visually: the
  `hit-target` utility centres a `::before` of `max(100%, 44px)` on the control, so a 26px icon
  button still takes a full 44px box. This belongs in the component, never in call sites.
  (It was documented here as `inset: -6px`, which is what it used to be and would give that
  button 38px; the utility in `globals.css` is the rule.)
- **A hit box wider than the pitch is an ambiguous target, not a bigger one.** Four 28px
  controls at an 8px gap are a 36px pitch under a 44px box, so each pair overlaps by 8px and a
  tap near a midpoint lands on whichever sibling paints later. Size the control so the pitch
  reaches 44: at an 8px chrome gap that is a 36px control. Measured on the channel header,
  phase 13a.
- **Temporary surfaces trap Tab, close on Escape, and restore focus to their trigger.** Because
  every overlay is the shared primitive, this is free — which is why hand-rolling one is banned
  rather than discouraged.
- Escape unwinds **one layer at a time**, outermost last.
- **Motion begins with visible content.** 150–300ms for a state change, up to ~1s for a page
  entrance, `cubic-bezier(0.16, 1, 0.3, 1)`. Entrances animate transform and blur, **never
  opacity from zero, and never with a fill-mode** — a page whose animation does not run must
  still render finished. `prefers-reduced-motion` is honoured in `globals.css`.
- Transition specific properties with intent (`transition-colors`), not blanket `transition-all`.
- Hover must not shift layout.
- Destructive actions are explicit and, where possible, reversible.

---

## Mobile

- `export const viewport` in `src/app/layout.tsx` sets `viewportFit: "cover"`. **Without it every
  `env(safe-area-inset-*)` resolves to `0px`.** Before Monolith this export did not exist, so the
  four files that appeared to handle safe area — `MemberModalShell.tsx`, `MemberDetailModal.tsx`,
  `AuthForm.tsx`, `CheckoutScreen.tsx` — were silently no-ops on every notched device.
- Use `100svh` / `h-svh`. `100vh` is banned.
- Fixed chrome uses the `safe-t` / `safe-b` / `safe-x` utilities. This includes the channel
  composer, which otherwise sits under the home indicator.
- Inputs compute to ≥16px so iOS does not zoom on focus.
- Page gutter is 16px, 20px at `sm` and up.
- Nothing hidden at a desktop breakpoint may simply vanish — it needs a mobile equivalent.

### Breakpoint contract

| Token | Width | Meaning |
| --- | --- | --- |
| `sm` | 640px | Phone → large phone; single column becomes two |
| `md` | 768px | **The drawer boundary.** The rail becomes permanent; side regions stop being drawers |
| `lg` | 1024px | A third column becomes possible |
| `xl` | 1280px | Content max-width reached; the member column appears |

**`md` is the drawer boundary.** Below it, every side region is a `MobilePane`. At and above, it
is a column.

---

## Components

`src/components/ui/` is the only place a primitive lives. A screen that hand-rolls a modal, a
select, a status badge or a table row is a bug, not a style choice — that divergence is what
produced two design languages in this product once already.

**New primitives are built *on top of* the existing shadcn set, never beside it.** `DataTable`
composes `ui/table`; `Overlay` composes `ui/dialog`'s base-ui root; `PresenceAvatar` composes
`ui/avatar`; `Field`/`Section` compose `ui/field`. Eighteen primitives sat unimported before
Monolith, including `avatar`, `field`, `table`, `badge`, `select`, `tabs` and `skeleton` — the
exact set the redesign needs. Building new files beside them would have produced a graveyard and
a third dialect.

> `tests/community-settings-ui.contract.mjs:56` asserts `files.length >= 25` for
> `src/components/ui/*.tsx`, and `:10` reads `SettingsOverlayShell.tsx`. Neither the unused
> primitives nor that shell can be deleted without editing that test. Composing on top of them
> satisfies the assertion honestly rather than working around it.

`ui/dialog.tsx` and `ui/sheet.tsx` are thin shims over `ui/overlay.tsx`, kept so the familiar
shadcn API still works.

**Do not run `shadcn add` without restyling the result.** The CLI fetches default styling and
would quietly re-introduce a second design language.

---

## Per-surface specifications

The previous version of this document carried detailed specifications for the identity command
center, the member operations registry, the notification preview and inbox, and the two-pane auth
and checkout layout. Those described pre-Monolith implementations of screens being redesigned
phase by phase.

**Each screen phase writes its own section here as it lands**, describing what shipped rather than
what was intended. A section describing an unshipped intention is worse than no section.

### The channel spine (phase 13a)

`/channels` mounts no `AppShell`, which is why it drifted furthest from the system.

- The page is `surface-canvas`. It had been an alias onto `--surface-panel`, so the conversation
  was card-coloured and the rail, the channel column and the composer were wells cut into a card.
  Depth reads correctly only when the page is the middle of the three.
- Both headers are `h-chrome-bar`. The safe-area inset is added to the height rather than
  replacing the padding, so the bar is 48px of content wherever it is drawn.
- The channel list has three signals, not three weights of one: `text-muted` at rest,
  `text-strong` for unread, `bg-accent-soft` for the open channel. That leaves `surface-panel`
  free to be the hover fill, which is what the rail already uses it for.
- A message row lifts to `surface-panel` on hover. Darkening to the sunken well reads as disabled
  once the page is the canvas.
- Chrome ramp throughout, except the message body, which is `text-content-sm`. Timestamps and
  counts are JetBrains Mono. This is the mixed surface named under "Density", said in tokens.
- Header controls are 36px painted at an 8px gap - a 44px pitch, which is the box `hit-target`
  draws.

### Composing and acting (phase 13b)

- A composite input takes its focus indicator on the box: the composer's textarea keeps
  `outline-none` and the row around it carries `has-[:focus-visible]:border-primary`, the shape
  `ui/input-group` uses. A ring drawn inside a bordered box reads as a mistake; no ring at all,
  which is what was there, is a control with no focus state.
- The message hover bar is `surface-raised`, one step above the `surface-panel` of the row it
  floats over. Two elements at the same depth separated by a hairline is not elevation.
- The bar's buttons carry **no** `hit-target`, and that is deliberate. Four 26px controls two
  pixels apart cannot each own 44px - the boxes overlap by 16px and the click goes to whichever
  paints later. Dropping the expanded area is correct only where touch has another route: this bar
  is hover-revealed, so a phone never sees it, and its context menu opens on a 500ms long press.
  Where there is no second route, grow the control until the pitch reaches 44 instead.
- Timers, durations and counters are `font-mono text-mono-xs`. `tabular-nums` beside a monospace
  face is redundant and has gone.

### The people column (phase 13c)

- A drawer is a touch surface and a column is not, and one list that serves both says so in its
  row: 44px in the drawer, dense in the column. The channel list already did this; the member list
  did not, so its rows were 28px targets on the only surface where that drawer is the way to reach
  anybody.
- `opacity-0` without `pointer-events-none` is a control nobody can see and anybody can press. Off
  a pointer, reveal it; where it does hide, make it inert until revealed. Both halves, always.
- Faded is not quiet: an offline member's name was muted at 60% opacity, under AA. The presence dot
  carries the state, so the name is muted at full strength.
- Moderation controls are `buttonVariants({ variant: "outline" | "destructive", size: "sm" })`, not
  hand-rolled chips. A 26px chip on a card that bans people is a missing hit area, a missing focus
  ring and a second danger palette in one.
- Never write `focus-ring` and `outline-none` on the same element. The ring currently survives only
  because `.focus-ring` is emitted later in the stylesheet.

---

## A note on contract tests and copy

Fifteen contract files assert on component **source text**, including user-visible strings —
`tests/creator-events.contract.mjs` alone pins `Save Draft`, `Publish Event`, `RSVP Metrics`,
`Members Registered`, `Event Details` and `Masters`. A copy change in one component therefore
breaks a test in a different file.

The convention, which holds for every phase of this redesign: **when a label changes, the
assertion changes in the same commit, with a one-line comment saying what it now pins and why.**
Without that audit trail the suite erodes into assertions that pass because they assert nothing.

---

## Reversed rules

Explicitly reversed from the previous system. If you find one of these in code or an older
branch, it is stale, not a precedent.

| Was | Now |
| --- | --- |
| Buttons, tags and inputs are pill-shaped (`rounded-full`) | 4px. `rounded-full` is avatars, presence dots, unread badges and the rail marker only |
| Plain `text-white` for headings | `--text-strong` `#F2F2F3` |
| Deep navy surfaces (`#051424`) with `surgical-steel` `#334155` rules | Achromatic near-black with `--border-hairline` `#242427` |
| Emerald `#10B981` as the accent, also used decoratively | Electric lime `#C6F24E`, state and primary action only |
| `.emerald-glow` is the primary-action shadow | No coloured glows. Elevation is hairline plus a near-black shadow |
| `.terminal-card` — a 135° gradient panel | `ui/card.tsx`. Gradients are banned |
| Inter for display, body, navigation and forms | Geist. JetBrains Mono unchanged, for data and measurement |
| Radii derived from one `--radius` via `calc()` | Flat, explicit, integer values |
| `--color-primary` defined in two places, the later silently winning | One semantic system; `--color-primary` resolves once |
