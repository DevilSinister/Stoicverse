import * as React from "react"

import { cn } from "@/lib/utils"

/*
  The heading block roughly nineteen page components each wrote for themselves,
  with a different eyebrow treatment and a different gap each time.

  A page header is a title, optionally a line saying what the page is for, and
  optionally the actions that belong to the whole page rather than to a row in it.
*/

type Density = "chrome" | "content"

function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  density = "content",
  className,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  density?: Density
}) {
  const chrome = density === "chrome"
  return (
    <header
      data-slot="page-header"
      data-density={density}
      className={cn(
        "flex flex-col gap-chrome-gap sm:flex-row sm:items-start sm:justify-between",
        chrome ? "pb-chrome-y" : "pb-content-gap",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? <span className="terminal-label">{eyebrow}</span> : null}
        <h1
          className={cn(
            "font-medium text-text-strong",
            chrome ? "text-title-sm" : "text-title-md",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-[70ch] text-content-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-chrome-gap">{actions}</div> : null}
    </header>
  )
}

export { PageHeader }
