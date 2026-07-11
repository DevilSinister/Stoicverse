---
name: AskStoic Design System
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#001c10'
  on-tertiary-container: '#009365'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  data-point:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  stack-xl: 64px
---

## Brand & Style

The design system is engineered for **AskStoic**, a platform where financial discipline meets elite mentorship. The brand personality is **Institutional, Stoic, and Methodical**. It avoids the frenetic energy of retail "meme-stock" apps in favor of the focused, high-stakes environment of a professional trading floor.

The visual style is **Corporate Modern with subtle Glassmorphism**. It utilizes a dark, high-contrast theme to reduce eye strain during long research sessions while maintaining a premium, "Executive Suite" aesthetic. The interface communicates authority through precise alignment, generous whitespace, and a monochromatic foundation punctuated by high-intent emerald accents.

## Colors

The palette is built on a "Terminal Dark" logic:
- **Primary Background (#0F172A):** A deep, near-black navy that provides an infinite depth for content.
- **Surface/Secondary (#1E293B):** Used for cards, navigation bars, and structural layering to create a sense of physical stacks.
- **Accent Emerald (#10B981):** Reserved strictly for growth indicators, successful trade signals, and primary calls-to-action. It represents the "Go" signal in a disciplined environment.
- **Typography:** Headlines are rendered in Pure White for maximum legibility, while body text uses Muted Slate to establish a clear information hierarchy.

## Typography

This design system uses **Inter** for its systematic, neutral, and highly legible characteristics. To lean into the "Trading Terminal" aesthetic, **JetBrains Mono** is introduced for metadata, labels, and numerical data points, providing a technical edge.

- **Headlines:** Set with tight letter-spacing and heavy weights to appear "fixed" and authoritative.
- **Body:** Open line heights (1.6) are used to ensure that dense educational content remains digestible.
- **Labels:** Monospaced and all-caps labels are used for categories and status indicators to differentiate "Data" from "Instruction."

## Layout & Spacing

The layout philosophy follows a **Fixed-Width Professional Grid** on desktop (12 columns) and a **Disciplined Stack** on mobile.

- **Desktop:** Emphasize wide horizontal gutters and large side margins (64px) to create an "Editorial" feel. Content should feel anchored, not floating.
- **Vertical Rhythm:** Use a strict 8px base grid. Sections are separated by `stack-xl` (64px) to allow the eye to rest between complex financial concepts.
- **Mobile:** Reflow content into a single column. Horizontal padding reduces to 20px, and typography scales down to maintain a maximum of 3 lines for headlines.

## Elevation & Depth

In a dark theme, depth is communicated through **Tonal Layering and Border Definition** rather than traditional shadows.

- **Level 0 (Background):** Deep Navy (#0F172A).
- **Level 1 (Cards/Panels):** Slate Gray (#1E293B). These surfaces should have a 1px solid border (#334155).
- **Level 2 (Popovers/Modals):** Lighter Slate (#334155) with a subtle backdrop blur (12px) to suggest a glass-like overlay.
- **Interactive States:** Use a "Glow" effect for active elements—a low-opacity emerald outer glow (0px 0px 15px rgba(16, 185, 129, 0.2)) to signify focus.

## Shapes

The design system adopts a **Soft Geometric** approach. By using `roundedness: 1` (4px base), we maintain the professional "sharpness" of institutional software while avoiding the aggressive feel of 90-degree corners.

- **Small Components (Tags, Inputs):** 4px radius.
- **Medium Components (Cards, Modals):** 8px (rounded-lg).
- **CTA Buttons:** 4px radius to feel like physical hardware keys.

## Components

### Buttons
- **Primary:** Emerald Green background with Pure White text. Use bold, all-caps typography for a high-contrast "Execute" feel.
- **Secondary:** Ghost style. Transparent background with a 1px Slate border. Text in Pure White.

### Cards
- Cards must use the `surface_hex` background. 
- **Learning Paths:** Feature a subtle top-border gradient (Emerald to Transparent) to indicate progress or premium status.
- Padding inside cards should be generous (min 24px).

### Input Fields
- Dark backgrounds (#0F172A) with a 1px border (#334155). 
- On focus, the border transitions to Emerald Green with a subtle glow. 
- Use JetBrains Mono for the input text to emphasize the data-entry nature.

### Chips & Status Indicators
- Statuses (e.g., "Market Open," "Completed") use the Monospaced label font.
- Success states use Emerald Green text on a 10% opacity Emerald background.

### Data Visualization
- Line charts should be minimal, removing all grid lines except for the X/Y axis.
- Use a 2px Emerald stroke for growth trends.