import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/*
  tailwind-merge has to be told this project's type scale, or it silently
  deletes text colours.

  `text-*` serves two class groups — font size and text colour — and
  tailwind-merge decides which one a class belongs to by matching it against
  *its own* default scale. Monolith's sizes (`text-content-base`,
  `text-chrome-sm`, `text-title-md`, …) are not in that scale, so every one of
  them was classified as a colour, and any colour set earlier in the same string
  was dropped as a conflicting colour.

  That is not theoretical. `ui/button.tsx` composes its variant before its size,
  so the default variant produced

      bg-primary text-primary-foreground … h-12 px-5 text-content-base

  and `cn` merged it down to `bg-primary … text-content-base`. Every filled
  button lost its label colour and inherited the body's light grey onto a lime
  fill — roughly 1.5:1, which is an unreadable button, not a slightly-off one.
  Found in the browser on /checkout/success during phase 5; ForwardDialog's Send
  button (`size="chrome"`, default variant) had the same defect.

  `tests/design-tokens.contract.mjs` asserts this list still matches the
  `--text-*` tokens declared in globals.css. A size added there and not here
  reintroduces exactly this bug, and nothing about it is visible in review.
*/
export const MONOLITH_FONT_SIZES = [
  "chrome-base",
  "chrome-sm",
  "chrome-xs",
  "content-base",
  "content-lg",
  "content-sm",
  "display",
  "mono-sm",
  "mono-xs",
  "title-lg",
  "title-md",
  "title-sm",
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...MONOLITH_FONT_SIZES] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
