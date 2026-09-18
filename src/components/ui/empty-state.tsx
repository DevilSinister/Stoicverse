import * as React from "react"

import { cn } from "@/lib/utils"

/*
  An empty region tells the reader nothing. An empty state says why it is empty
  and what would fill it - the rule in UI_UX.md - and this is the one place that
  shape lives, instead of the eight or so inline versions it replaces.
*/

function EmptyState({
  icon,
  title,
  description,
  action,
  density = "content",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  density?: "chrome" | "content"
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        density === "chrome" ? "px-chrome-x py-content-gap" : "px-content-x py-section",
        className,
      )}
      {...props}
    >
      {icon ? <span className="text-text-faint [&_svg]:size-6">{icon}</span> : null}
      <p className="text-title-sm font-medium text-text-strong">{title}</p>
      {description ? (
        <p className="max-w-[46ch] text-chrome-base text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
