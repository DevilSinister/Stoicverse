"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

/*
  Composes ui/avatar, which existed and had no importers, rather than adding a
  fifth implementation beside the four that already disagreed: MemberList,
  MemberProfileDialog, ChannelView and AppRail each drew the same
  avatar-plus-presence-dot by hand at a different size with a different ring.

  The presence dot is a real affordance, so it carries a label. A colour alone
  cannot say "online" - see the colour rule in UI_UX.md.
*/

type Presence = "online" | "idle" | "dnd" | "offline"

const DOT: Record<Presence, string> = {
  online: "bg-status-ok",
  idle: "bg-status-warn",
  dnd: "bg-status-danger",
  offline: "bg-text-faint",
}

const LABEL: Record<Presence, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
}

const SIZE = {
  xs: { box: "size-5", text: "text-[10px]", dot: "size-1.5" },
  sm: { box: "size-6", text: "text-chrome-xs", dot: "size-2" },
  md: { box: "size-9", text: "text-chrome-sm", dot: "size-2.5" },
  lg: { box: "size-16", text: "text-title-sm", dot: "size-4" },
} as const

function MemberAvatar({
  name,
  src,
  presence,
  size = "md",
  className,
}: {
  name: string
  src?: string | null
  presence?: Presence
  size?: keyof typeof SIZE
  className?: string
}) {
  const spec = SIZE[size]
  const initial = name.trim().charAt(0).toUpperCase() || "?"

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar className={cn(spec.box, "rounded-full")}>
        {src ? <AvatarImage src={src} alt="" /> : null}
        <AvatarFallback
          className={cn("bg-surface-raised font-medium text-text-default", spec.text)}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
      {presence ? (
        <span
          role="img"
          aria-label={LABEL[presence]}
          title={LABEL[presence]}
          className={cn(
            "absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-surface-panel",
            spec.dot,
            DOT[presence],
          )}
        />
      ) : null}
    </span>
  )
}

export { MemberAvatar, type Presence }
