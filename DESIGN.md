# Stoicverse Design System

**Last updated:** August 2, 2026

This document describes the system **as it is implemented**. Tokens are defined in
`src/app/globals.css` (`@theme` block); fonts are loaded in `src/app/layout.tsx`.
When code and this document disagree, the code is the source of truth — update
this file rather than letting them drift.

## Direction

Stoicverse uses a quiet editorial interface built on visible hairline structure:
serious, cold, and precise. Deep navy canvas, a single emerald accent reserved
for progression and primary action, and 1px rules that carry the layout before
any decoration does. It should feel like dependable learning infrastructure, not
a social feed, trading terminal, or generic SaaS dashboard.

## Palette

Tailwind utilities are generated from the `@theme` block, so `--color-surface`
is used as `bg-surface`, `text-surface`, etc.

| Token | Value | Use |
| --- | --- | --- |
| `surface` | `#051424` | Page background |
| `surface-container-lowest` | `#010f1f` | Deepest recess: inputs, `<body>` |
| `surface-container-low` | `#0D1C2D` | Recessed panels, sidebars, footers |
| `monolith-surface` | `#1E293B` | Cards and primary panels |
| `surface-container-high` | `#1c2b3c` | Raised rows, hover fills, panel headers |
| `surgical-steel` | `#334155` | Hairlines, borders, grid dividers |
| `on-surface` | `#d4e4fa` | Body text |
| `on-surface-variant` | `#c6c6cd` | Supporting copy |
| `fog-muted` | `#94A3B8` | Metadata and tertiary copy |
| `primary-container` | `#10B981` | Accent: focus, progress, primary action |
| `on-primary-fixed` | `#131b2e` | Text on the emerald accent |
| `error` | `#ffb4ab` | Error text and borders |

Plain `text-white` is used for headings sitting above `on-surface`.

Verified contrast on `surface`: `on-surface-variant` 11.1:1, `fog-muted` 7.2:1,
`primary-container` 7.2:1. `on-primary-fixed` on `primary-container` is 6.8:1.
All pass AA for body text.

## Typography

Both faces are self-hosted through `next/font/google` and exposed as
`--font-inter` and `--font-jetbrains-mono`.

- **Inter** — everything: display, headings, body, navigation, controls, forms,
  labels, metadata. Reached via `font-headline`, `font-body`, `font-display`,
  `font-body-lg`, and the `font-*-md`/`font-*-sm` variants.
- **JetBrains Mono** — reached via `font-label`, `font-label-md`, `font-label-sm`,
  and `font-code-block`.

Mono is for code, data, and measurement. Do not use it as a costume for
"technical" — nav links, buttons, and section eyebrows belong in Inter. The
public surfaces (landing, auth) use Inter throughout for this reason; the app
interior still applies mono via the `font-label-*` tokens.

Display type uses `clamp()` with tight tracking (`-0.02em` to `-0.035em`) and
caps around 4.75rem. Body measure stays in the 65–75 character band.

## Layout and components

- Hairline structure first: 1px `surgical-steel` rules define regions before any
  card, fill, or shadow is added.
- Cards and panels use `rounded-lg` to `rounded-2xl`. Buttons, tags, and inputs
  are pill-shaped (`rounded-full`) except form inputs, which use `rounded-lg`.
- Content is capped at `max-w-7xl` with `px-4 / md:px-8 / lg:px-12` gutters.
- Minimum 44px touch targets for controls and navigation links. Inline links
  inside running text are the one exception.
- A faint 1px grid field (`surgical-steel`, 60–88px cells) appears on hero and
  auth surfaces as a background material. Fade it with a `mask-image` rather
  than letting it hard-cut at a section edge.

### Identity command center

Member settings are a dedicated workspace, not a modal stack. At wide desktop
sizes they use three visible regions: a compact category rail, one focused
editor, and a live identity preview. Medium layouts retain the rail and editor;
the preview is supporting context and may collapse first. The rail owns global
settings navigation and keeps logout visually separated below the categories.

The editor shows one category at a time and divides related forms with hairlines
instead of nesting every form in a separate card. The live preview is a truthful
read-only mirror of account identity: avatar, display name, email, membership
status, and cosmetic community badges. A cosmetic badge communicates identity
only; it must never be presented as a permission, lock, or progression tier.

### Notification preview and inbox

The AppShell bell opens a compact, bounded preview (up to 24rem wide) of the five
newest notifications. It includes the unread count, distinct unread markers,
loading/error/empty states, and one persistent “View all notifications” exit.
Keep this surface scan-first: title, at most two lines of body copy, timestamp,
and direction affordance. Opening the preview may acknowledge the visible five;
it must not visually imply that the entire inbox was cleared.

The full notification inbox is a quiet chronological queue. Use the All, Unread,
and Mentions controls as a roving tablist, group rows under Today, Yesterday, and
Earlier, and append history with “Load older” rather than infinite scroll. Every
data state is a first-class composition: skeleton rows for initial loading, a
retry action for failure, view-specific empty copy, and an inline alert when a
refresh fails while usable rows remain.

## Interaction and accessibility

- Motion is quiet and purposeful, 150–300ms for state changes and up to ~1s for
  a single page entrance. Exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Entrance animations must start from a **visible** default: animate transform
  and blur, never opacity to zero, and use no fill mode. A page whose animation
  never runs must render finished, not blank. See `.settle` / `.draw-down`.
- All motion is disabled under `prefers-reduced-motion: reduce`.
- Focus uses the shared `.focus-ring` utility: a 2px emerald outline at 2px
  offset, on `:focus-visible` only. Do not hand-roll focus styles.
- Temporary shell surfaces move focus into their first action when opened, trap
  Tab within the surface, close on Escape, and restore focus to the trigger.
  Mobile settings detail moves focus to its back control, then restores focus to
  the category that launched it when returning to the category list.
- Tab sets use one tab stop and support Left/Right Arrow, Home, and End. Async
  results use `status` or `alert` semantics and must remain understandable when
  pulse, spin, and transition animation are suppressed.
- Shadows carry a real offset and blur. `.emerald-glow` is the primary-action
  shadow: `0 8px 24px -12px` emerald plus a 1px inset top highlight. Zero-offset
  colored halos are not part of the system.
- `scroll-padding-top: 5rem` on `html` keeps in-page anchors clear of the fixed
  header; smooth scrolling is enabled only when motion is allowed.
- Avoid gradients, glassmorphism, warm themes, decorative hero metrics, and
  grids of identically-sized icon-plus-heading-plus-text cards.

## Surfaces

- **Landing** (`src/components/screens/LandingScreen.tsx`) — Persuade. A server
  component with no client bundle; it must never import from the app's
  `"use client"` screen modules, which would ship admin and checkout internals
  to anonymous visitors.
- **Auth** (`src/components/auth/AuthForm.tsx`) — Operate. Signup carries a
  four-step context rail so the email-confirmation step is not a surprise; the
  rail is `hidden lg:flex`, so phones get the same sequence as a segmented
  stepper rather than losing it.
- **Member settings** (`AccountSettingsWorkspace`) — Operate. An identity command
  center with a category rail, focused editor, and supporting live preview.
- **Member notifications** (`NotificationCenter` and the AppShell bell preview) —
  Operate. A compact recency preview opens into a filterable chronological inbox;
  state changes are communicated by copy, color, and semantics, never motion alone.

## Mobile

- Full-height auth and hero surfaces use `100svh`, not `100vh`. Mobile browser
  chrome makes `vh` taller than the visible area, which pushes primary actions
  under the URL bar.
- Form inputs must compute to **16px or larger**. Below that, iOS Safari zooms
  the page on focus and does not zoom back out.
- Full-bleed surfaces pad with `max(<value>, env(safe-area-inset-*))` so content
  clears notches and the home indicator.
- Anything hidden behind `lg:` must have a mobile equivalent, not simply vanish.
- Member settings become list-to-detail navigation below `md`: begin with the
  category list, push into one section, and provide an explicit “All settings”
  back control. Preserve the selected category and restore keyboard focus when
  returning; do not compress the desktop rail and editor side by side.
- **Checkout** (`src/components/checkout/CheckoutScreen.tsx`) — Operate. Payment
  happens on Stripe Checkout. This surface reviews the order and hands off; it
  must never render card, CVC, or billing-address inputs. Cardholder data must
  not touch a page that is not PCI-scoped, and fields that are collected but
  never transmitted misrepresent what the button does.
- **App interior** (`AppShell` and the dashboard/community/course views) — Operate.

## Two-pane auth and checkout layout

Auth and checkout share one shell: a `hidden lg:flex` context rail on the left
and the task column on the right. Two rules follow from the rail being desktop-only:

- The page's single `<h1>` belongs in the **task column**, never in the rail —
  otherwise phones render a page with no top-level heading.
- Anything the rail explains needs a mobile equivalent in the task column.
