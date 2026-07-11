# UI/UX Design System: Ask Stoic

## 1. Design Strategy & Vibe

Strategy: Committed Dark Editorial.

Register: product-first community and learning UI with editorial marketing moments.

Physical scene: a cold, precise control room with surgical hairlines separating dark monolithic surfaces. The interface should feel like quiet infrastructure, stripped of noise, using a single mint accent for absolute clarity.

## 2. Color Palette

A near-black canvas divided by surgical hairlines, with one mint accent threading focus, active state, progress, and primary actions.

| Role | Color Name | OKLCH | Fallback HEX | Usage |
|---|---|---|---|---|
| Body Background | Cold Void | `oklch(0.12 0.005 260)` | `#0C0E10` | Whole application canvas |
| Surface | Monolith | `oklch(0.18 0.005 260)` | `#16181A` | Panels, cards, terminal blocks |
| Hairline Borders | Surgical Steel | `oklch(0.25 0.005 260)` | `#2A2C2E` | Dividers, grid lines, structural borders |
| Ink | Bone White | `oklch(0.95 0.005 260)` | `#F0F1F2` | Headings and important text |
| Muted Text | Fog | `oklch(0.65 0.01 260)` | `#8B8E91` | Secondary text and placeholders |
| Accent | Glacial Mint | `oklch(0.85 0.12 160)` | `#A7E5C5` | Primary actions, focus rings, active states |

## 3. Typography

Display and headings use Cormorant for the editorial Stoic voice. Body, UI controls, navigation, and dense product text use Inter. Technical details, small labels, logs, prices, and metadata use JetBrains Mono.

Use balanced wrapping for display headings, keep body line length to 65-75ch, and avoid fluid product UI type except in true landing-page hero copy.

## 4. Layout & Rhythm

Use strict grids, hairline dividers, and dark surfaces. Product screens should favor dense but calm layouts: side navigation, top bars, tables, feeds, status panels, progress bars, and role-aware controls. Cards are allowed for repeated records, events, lessons, payment summaries, and dashboard panels, but should not be nested or over-rounded.

## 5. Components

Buttons and inputs are pill-shaped only where they are compact controls. Larger panels use modest radius. Every interactive element needs default, hover, focus-visible, disabled, and active treatment. Locked, paid, pending, completed, live, and suspended states must include text labels or icons in addition to color.

## 6. Motion

Motion is quiet and stateful: 150-250ms transitions for hover, active, disclosure, and loading states. No bounce, no decorative page-load choreography. Respect `prefers-reduced-motion`.

## 7. Accessibility

Muted text must maintain AA contrast on the dark background. Minimum tap targets are 44px. Focus rings use the mint accent. Avoid color-only meaning, keep form labels visible, and ensure dense tables and feeds remain readable at mobile widths.
