# UI/UX Design System: Ask Stoic (Trading Floor Style)

This document outlines the visual identity, UX guidelines, and interaction principles for the Ask Stoic platform, utilizing the `/impeccable` methodology.

## 1. Design Strategy & Vibe
**Strategy:** "Committed Dark Institutional"
**Register:** Product-first community and learning UI with professional trading floor energy.
**Physical Scene:** A professional, focused trading terminal with sharp hairlines separating dark navy and slate surfaces. Monochromatic foundation punctuated by high-intent emerald green accents for growth and execution states.

### Anti-Patterns to Refuse & Avoid
- **NO AI Slop:** No purple/blue neon gradients. No "glassmorphism as default".
- **NO Generic Light Themes:** Avoid warm AI-default cream/sand/beige entirely.
- **NO "Hero-Metric" Clichés:** Avoid the standard SaaS oversized numbers with gradients.
- **NO Ghost Cards:** No combining `border: 1px solid` with `box-shadow: 0 16px...` on the same element.
- **NO Over-rounding:** Strict systematic feel. Border radius should be `4px` (rounded-sm) for CTAs and small controls, and maximum `8px` (rounded-lg) for cards/panels.

## 2. Color Palette
A deep navy canvas divided by clean slate-gray borders, with a single emerald accent representing execution, active states, progress, and primary actions.

| Role | Color Name | Hex Code | Usage |
|---|---|---|---|
| **Body Background** | Deep Navy | `#051424` | The dark canvas for the entire application. |
| **Surface** | Container Low | `#0D1C2D` | Side navigation, panel backgrounds. |
| **Monolith Surface** | Slate Gray | `#1E293B` | Cards, popovers, active dialog panels. |
| **Hairline Borders**| Surgical Border | `#334155` | 1px solid dividers, grid lines, structural borders. |
| **Ink (Text Primary)**| Pure White | `#FFFFFF` | Primary headings and important text. |
| **Muted Text** | Muted Slate | `#94A3B8` | Secondary text, placeholders. |
| **Accent** | Accent Emerald | `#10B981` | Focus rings, active states, primary CTA accents. |
| **Hover Accent** | Bright Emerald | `#4EDE93` | Hover states and highlight details. |

## 3. Typography
This design system uses Inter for headings and body to keep a neutral, systematic appearance, and JetBrains Mono for metadata, labels, and data points to provide a trading-terminal feel.

- **Display & Headings:** **Inter**
  - *Usage:* H1, H2, Hero text, and key metrics.
  - *Rules:* Heavy weights, tight letter-spacing (`-0.02em` to `-0.01em`).
- **Body & UI Elements:** **Inter**
  - *Usage:* Paragraphs, buttons, metadata, UI controls.
  - *Rules:* Cap line length at 65–75ch. Clean, highly legible, open line height (`1.6`).
- **Labels & Numbers:** **JetBrains Mono**
  - *Usage:* Categories, monospaced status labels, chart values, prices.

## 4. Layout & Spacing
- **Surgical Grid:** Use 1px borders (`border-[#334155]` or `border-slate-700`) to divide dashboard sections cleanly.
- **Vertical Rhythm:** 8px base grid.
- **Desktop:** Emphasize wide horizontal gutters and side margins (64px).
- **Mobile:** Reflow content into a single column. Horizontal padding reduces to 20px, typography scales down.

## 5. Interaction & Motion
- **Quiet Motion:** Only animate when strictly necessary. Use `ease-out-expo` (150-250ms). No bouncy/elastic effects.
- **Hover States:** Subtle background shifts or the emerald accent glow. No scale transforms.
- **Focus States:** Emerald border with a low-opacity emerald outer glow (`0px 0px 15px rgba(16, 185, 129, 0.2)`).
