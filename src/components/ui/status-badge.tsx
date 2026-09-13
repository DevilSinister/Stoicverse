import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/*
  Composes ui/badge rather than replacing it.

  It absorbs the Status helper that was duplicated in MemberDetailModal and
  MemberRegistry, and the ad-hoc text-red-* / text-amber-* status colours scattered
  across the creator surfaces - roughly forty call sites choosing their own red.

  A tone is a meaning, not a colour: "danger" is for a state the reader must act
  on, not for anything that happens to look bad.
*/

type StatusTone = "neutral" | "ok" | "warn" | "danger" | "accent"

const TONE: Record<StatusTone, string> = {
  neutral: "border-border-hairline bg-surface-raised text-text-muted",
  ok: "border-status-ok/30 bg-status-ok/10 text-status-ok",
  warn: "border-status-warn/30 bg-status-warn/10 text-status-warn",
  danger: "border-status-danger/30 bg-status-danger/10 text-status-danger",
  accent: "border-primary/30 bg-accent-soft text-primary",
}

function StatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Badge> & { tone?: StatusTone }) {
  return (
    <Badge data-slot="status-badge" data-tone={tone} className={cn(TONE[tone], className)} {...props}>
      {children}
    </Badge>
  )
}

export { StatusBadge, type StatusTone }
