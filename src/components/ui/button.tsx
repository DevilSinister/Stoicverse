import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
  Monolith button.

  Two things are deliberate and easy to undo by accident.

  **44px is the default, and dense chrome gets it without looking dense-breaking.**
  The `chrome` and `icon-chrome` sizes are 32px of visible button carrying
  `hit-target`, which paints an invisible 44px hit area around them. That belongs
  here and not in call sites - the previous system had ~500 places that could each
  get it wrong, and /channels got it wrong in all of them at 24-28px.

  **Buttons are 4px, not pills.** The old DESIGN.md mandated `rounded-full` for
  buttons, tags and inputs; Monolith reverses that. `rounded-lg` resolves to 4px
  through the token layer, so the class name here is unchanged and the shape is not.
*/

const buttonStyles = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline:
          "border-border-strong bg-transparent text-text-default hover:bg-surface-raised hover:text-text-strong aria-expanded:bg-surface-raised aria-expanded:text-text-strong",
        secondary:
          "bg-surface-raised text-text-default hover:bg-border-hairline hover:text-text-strong aria-expanded:bg-surface-raised",
        ghost:
          "text-text-muted hover:bg-surface-raised hover:text-text-strong aria-expanded:bg-surface-raised aria-expanded:text-text-strong",
        destructive:
          "bg-status-danger/10 text-status-danger hover:bg-status-danger/20 focus-visible:border-status-danger/40 focus-visible:ring-status-danger/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Content density. 44px, the default everywhere outside dense chrome.
        default: "h-11 gap-2 px-4 text-content-sm",
        lg: "h-12 gap-2 px-5 text-content-base",
        icon: "size-11",
        // Chrome density. 32px of button, 44px of target.
        chrome: "hit-target h-8 gap-1.5 px-2.5 text-chrome-base",
        "icon-chrome": "hit-target size-8",
        sm: "hit-target h-7 gap-1 px-2.5 text-chrome-sm [&_svg:not([class*='size-'])]:size-3.5",
        xs: "hit-target h-6 gap-1 px-2 text-chrome-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "hit-target size-7",
        "icon-xs": "hit-target size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

/*
  Merged, not concatenated - and this is not a style preference.

  The base layer sets `border border-transparent` so every button reserves the
  border box; the `outline` variant then sets `border-border-strong`. cva
  concatenates them, so the class attribute carries both, and Tailwind resolves
  a conflict by stylesheet order rather than by attribute order: transparent
  wins, in either order, measured. `<Button>` never showed this because it
  passed its classes through `cn` - twMerge drops the earlier border colour.
  Every *direct* `buttonVariants(...)` call did not, so **eleven outline buttons
  and link-buttons across the product had no border at all**, on a design whose
  whole elevation story is the hairline.

  Routing the export through `cn` makes the two call styles produce the same
  thing, which is the only reason anyone would expect them to be swappable.
  Same family as `00 - Shared/Cross-Project Lessons.md` lesson 85: a Tailwind
  conflict that is silent in the source, green in the build, and only visible
  on the rendered page.
*/
function buttonVariants(...args: Parameters<typeof buttonStyles>) {
  return cn(buttonStyles(...args))
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonStyles>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
