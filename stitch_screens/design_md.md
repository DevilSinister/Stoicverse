# UI/UX Design System: Ask Stoic

This document outlines the visual identity, UX guidelines, and interaction principles for the Ask Stoic platform, utilizing the `/impeccable` methodology inspired by the "Cairn" visual language.

## 1. Design Strategy & Vibe
**Strategy:** "Committed Dark Editorial"
**Register:** Editorial, Infrastructure, Serious, Quiet, Cold Air
**Physical Scene:** A cold, precise control room with surgical hairlines separating dark monolithic surfaces. The interface should feel like quiet infrastructure, stripped of all noise, using a single mint accent for absolute clarity.

### Anti-Patterns to Refuse & Avoid
- **NO AI Slop:** No purple/blue neon gradients. No "glassmorphism as default".
- **NO Generic Light Themes:** Avoid warm AI-default cream/sand/beige entirely.
- **NO "Hero-Metric" Clichés:** Avoid the standard SaaS oversized numbers with gradients.
- **NO Ghost Cards:** No combining `border: 1px solid` with `box-shadow: 0 16px...` on the same element.
- **NO Over-rounding:** Strict brutalist editorial feel. Border radius should be `0px` (sharp corners) or maximum `4px` for small interactive elements. No pill cards.

## 2. Color Palette
A near-black canvas divided by surgical hairlines, with a single mint accent threading every bullet, focus, and active state.

| Role | Color Name | OKLCH | Fallback HEX | Usage |
|---|---|---|---|---|
| **Body Background** | Cold Void | `oklch(0.12 0.005 260)` | `#0C0E10` | The near-black canvas for the entire application. |
| **Surface** | Monolith | `oklch(0.18 0.005 260)` | `#16181A` | Cards, terminal blocks, secondary backgrounds. |
| **Hairline Borders**| Surgical Steel | `oklch(0.25 0.005 260)` | `#2A2C2E` | 1px solid dividers, grid lines, structural borders. |
| **Ink (Text Primary)**| Bone White | `oklch(0.95 0.005 260)` | `#F0F1F2` | Primary headings and important text. |
| **Muted Text** | Fog | `oklch(0.65 0.01 260)` | `#8B8E91` | Secondary text, placeholders. (Maintains >4.5:1 contrast). |
| **Accent** | Glacial Mint | `oklch(0.85 0.12 160)` | `#A7E5C5` | Bullets, focus rings, active states, primary CTA accents. |

## 3. Typography
One didone-style serif for display, one grotesk for everything else, and a monospaced font for technical details.

### Font Pairing
- **Display & Headings:** **Cormorant** (Didone-style Serif)
  - *Usage:* H1, H2, Hero text, profound statements, pricing numbers.
  - *Rules:* `text-wrap: balance`. Generous sizing. Letter-spacing floor: `-0.02em` to `-0.03em`.
- **Body & UI Elements:** **Inter** (Grotesk Sans-Serif)
  - *Usage:* Paragraphs, buttons, metadata, UI controls.
  - *Rules:* Cap line length at 65–75ch. Clean, highly legible, tight letter-spacing for UI.
- **Code & Technical:** **JetBrains Mono**
  - *Usage:* Terminal blocks, logs, numbers, technical metadata.

## 4. Layout & Rhythm
- **Surgical Hairlines:** Use 1px borders (`border-gray-800` or equivalent) to divide sections strictly. 
- **Grids:** Strict CSS Grid layouts with hairline borders acting as the grid lines themselves, creating a monolithic dashboard feel.
- **Z-Index Scale:** Semantic only. `10` (dropdown) → `20` (sticky) → `30` (modal-backdrop) → `40` (modal).
- **Viewport:** Ensure `width=device-width, initial-scale=1`.

## 5. Interaction & Motion
- **Quiet Motion:** Only animate when strictly necessary. Use `ease-out-expo` (150-300ms). No bouncy/elastic effects.
- **Hover States:** Subtle background color shifts or the mint accent appearing. No scale transforms that shift layout.
- **Focus States:** The mint accent must thread every focus state. Visible, sharp, 1px or 2px outline.
- **Cursor:** Always add `cursor-pointer` to clickable elements.

## 6. Accessibility & UX Quality (CRITICAL)
- **Contrast:** Muted text must hit ≥ 4.5:1 against the near-black background.
- **Touch Targets:** Minimum `44x44px` on mobile.
- **Loading States:** Disable buttons during async operations. Minimalist spinners in mint green.
- **Icons:** Thin, minimal SVG icons matching the Inter weight. *No emojis.* Fixed `viewBox` (24x24) and uniform sizing (`w-5 h-5`).
