# UI/UX Standards

`DESIGN.md` is the canonical Stoicverse design system. This file records implementation standards that accompany it.

## Information design

- Lead each protected page with the member’s current state, available action, and next unlock.
- Keep tier locks explanatory: say what is restricted and what completion unlocks it.
- Keep staff controls inline and visible only to authorized roles.
- Treat payment, review, and mentorship states as trust moments: show status, timing, and the next responsible party.

## Responsive and accessible behaviour

- Use a single-column mobile layout, 20px minimum horizontal padding, and 44px minimum touch targets.
- Provide a visible keyboard focus indicator, semantic labels, clear empty states, disabled states for pending actions, and concise error messages.
- Do not rely only on color to communicate tier, payment, or notification state.
- Use Cormorant only for display headings and Inter for all functional UI text. Do not introduce JetBrains Mono.

## Interaction

- Use 150–300ms ease-out transitions only when they clarify feedback.
- Avoid layout-shifting hover effects, bouncy animation, generic gradients, glass cards, and excessive shadows.
- Make destructive actions explicit and reversible where possible.
