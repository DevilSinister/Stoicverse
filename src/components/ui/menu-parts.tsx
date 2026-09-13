import type * as React from "react"

/*
  The technique MemberMenuItems discovered, written down as a type.

  Base UI's dropdown menu and context menu are distinct component trees, so an
  action list that should appear in both cannot simply be rendered twice - it has
  to be given the pieces to build with. A function that takes MenuParts and returns
  elements can therefore feed either family, which is what stops a right-click menu
  and a "..." menu from quietly drifting apart. They did drift, before.
*/

export type MenuParts = {
  Item: React.ComponentType<Record<string, unknown>>
  Separator: React.ComponentType<Record<string, unknown>>
  Sub?: React.ComponentType<Record<string, unknown>>
  SubTrigger?: React.ComponentType<Record<string, unknown>>
  SubContent?: React.ComponentType<Record<string, unknown>>
}

export type MenuItemsFactory<Context> = (
  parts: MenuParts,
  context: Context,
) => React.ReactNode
