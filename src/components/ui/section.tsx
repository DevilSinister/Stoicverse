import * as React from "react"

import { cn } from "@/lib/utils"

/*
  Replaces the byte-similar local Section helpers that were defined separately in
  CreatorAnalyticsView and CreatorRevenueView, and the same shape open-coded in
  most settings bodies.
*/

type Density = "chrome" | "content"

function Section({
  title,
  description,
  actions,
  density = "content",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  density?: Density
}) {
  const chrome = density === "chrome"
  return (
    <section
      data-slot="section"
      data-density={density}
      className={cn("flex flex-col", chrome ? "gap-chrome-gap" : "gap-content-gap", className)}
      {...props}
    >
      {title || actions ? (
        <div className="flex items-start justify-between gap-chrome-gap">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? (
              <h2 className="text-title-sm font-medium text-text-strong">{title}</h2>
            ) : null}
            {description ? (
              <p className="max-w-[70ch] text-chrome-base text-text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-chrome-gap">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export { Section }
