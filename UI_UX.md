# UI/UX Standards

`DESIGN.md` is the canonical Stoicverse design system — palette, type, density, shape, layering,
overlays, motion and the breakpoint contract all live there. This file records the
**information-design** standards that accompany it: what a screen should say, not what it should
look like.

Where the two overlap, `DESIGN.md` wins. Where either disagrees with the code, the code wins and
the document is the bug.

## Information design

- Lead each protected page with the member's current state, available action, and next unlock.
- Keep tier locks explanatory: say what is restricted and what completion unlocks it. A lock that
  only says "locked" makes the product feel arbitrary.
- Keep staff controls inline and visible only to authorized roles.
- Treat payment, review, and mentorship states as trust moments: show status, timing, and the next
  responsible party. A member who has just paid must be told so by the product, not left to infer
  it from a redirect.
- Prefer an explicit empty state to an empty region. Say why it is empty and what would fill it.

## Accessibility

- Provide a visible keyboard focus indicator (the shared `.focus-ring`), semantic labels, clear
  empty states, disabled states for pending actions, and concise error messages.
- **Do not rely on colour alone** to communicate tier, payment, or notification state. On an
  achromatic surface with a single accent this matters more, not less — there is no second hue to
  fall back on, so state needs a label, an icon or a position as well.
- Single-column below `sm`; 20px minimum horizontal padding at `sm` and up; 44px minimum touch
  targets everywhere. See the breakpoint contract in `DESIGN.md`.

## Interaction

- Use 150–300ms ease-out transitions only when they clarify feedback.
- Avoid layout-shifting hover effects, bouncy animation, gradients, glass cards, and heavy shadows.
- Make destructive actions explicit and reversible where possible.
- Report failure where the reader is looking. A transient failure is a toast; a persistent,
  blocking condition is in-flow. An error block that appears mid-page and reflows the content
  costs the reader their place.

## Copy

- Sentence case for headings, labels and buttons.
- Say what a control does, not what it is: "Publish event", not "Submit".
- Fifteen contract test files assert on user-visible strings in component source. **When a label
  changes, update the assertion in the same commit** with a one-line note on what it now pins.
  See the note in `DESIGN.md`.

---

**Corrections from the previous version of this file.** It required Cormorant for display
headings and instructed "Do not introduce JetBrains Mono" — but Cormorant was replaced by Inter
in `globals.css` some time ago, and JetBrains Mono is wired to five theme tokens and endorsed by
`DESIGN.md`. Both instructions were stale and contradicted the code they governed. Type is now
specified in exactly one place: `DESIGN.md`.
