# Stoicverse Design System

**Last updated:** July 12, 2026

## Direction

Stoicverse uses a quiet editorial interface: serious, cold, and precise. It should feel like dependable learning infrastructure, not a social feed, trading terminal, or generic SaaS dashboard.

## Palette

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#0C0E10` | Page background |
| Surface | `#16181A` | Cards and secondary panels |
| Border | `#2A2C2E` | Hairlines and grid dividers |
| Primary text | `#F0F1F2` | Headings and essential actions |
| Muted text | `#8B8E91` | Supporting copy and metadata |
| Accent | `#A7E5C5` | Focus, active state, progress, and primary calls to action |

## Typography

- **Cormorant:** display and headings. Use for page titles, important statements, and pricing; apply tight tracking and balanced wrapping.
- **Inter:** body, navigation, controls, forms, labels, and metadata.

Do not use JetBrains Mono. Numeric or status information should use Inter with tabular numerals where alignment matters.

## Layout and components

- Use a strict 8px spacing rhythm and 1px hairline dividers to create structure before decoration.
- Use moderate rounding (`12–16px`) for cards and containers. Buttons, tags, and inputs are pill-shaped.
- Keep desktop layouts spacious and grid-led; reflow to one column with at least 20px horizontal padding on mobile.
- Use clear labels for tier, eligibility, payments, and staff actions. Preserve minimum 44px touch targets.

## Interaction and accessibility

- Motion is quiet, purposeful, and 150–300ms; no bounce or scale-driven layout shifts.
- Hover states use subtle surface changes or mint emphasis. Focus states use a visible mint outline.
- Muted text must maintain at least 4.5:1 contrast on its background.
- Avoid gradients, glassmorphism, warm beige themes, decorative hero metrics, excessive shadows, and oversized rounded containers.
