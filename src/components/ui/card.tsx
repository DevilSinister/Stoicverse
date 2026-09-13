import * as React from "react"

import { cn } from "@/lib/utils"

/*
  There was no card.tsx. The role was filled by the .terminal-card utility - a
  135deg gradient panel, 17 uses - and far more often by inline
  "rounded-xl border border-surgical-steel bg-monolith-surface", repeated across
  the product with slightly different padding every time.

  density is the whole point. A card in a dense table toolbar and a card holding a
  course description are the same component at two rhythms, not two components.
*/

type Density = "chrome" | "content"

const PAD: Record<Density, string> = {
  chrome: "p-chrome-x",
  content: "p-content-gap",
}

function Card({
  className,
  density = "content",
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { density?: Density; interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      data-density={density}
      className={cn(
        "flex min-w-0 flex-col rounded-md border border-border-hairline bg-surface-panel text-text-default",
        interactive &&
          "transition-colors hover:border-border-strong hover:bg-surface-raised focus-within:border-border-strong",
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({
  className,
  density = "content",
  ...props
}: React.ComponentProps<"div"> & { density?: Density }) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1", PAD[density], className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-title-sm font-medium text-text-strong", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-chrome-base text-text-muted", className)}
      {...props}
    />
  )
}

function CardContent({
  className,
  density = "content",
  ...props
}: React.ComponentProps<"div"> & { density?: Density }) {
  return (
    <div data-slot="card-content" className={cn("min-w-0 flex-1", PAD[density], className)} {...props} />
  )
}

function CardFooter({
  className,
  density = "content",
  ...props
}: React.ComponentProps<"div"> & { density?: Density }) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-chrome-gap border-t border-border-hairline",
        PAD[density],
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
