import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"

/*
  Composes ui/table, which existed unimported while MemberRegistry, TurnoverWorkspace
  and RevenueTable each wrote their own row markup.

  Deliberately not a data grid. No sorting state, no virtualisation, no column
  resizing - the surfaces that need those already own their data fetching, and a
  table component that owns state is a table component every screen fights. This
  owns the look: row height, alignment, the sticky header, the empty state.

  Chrome density by default, because a table is chrome.
*/

type Column<Row> = {
  key: string
  header: React.ReactNode
  cell: (row: Row) => React.ReactNode
  align?: "start" | "end"
  width?: string
  // Numeric columns get tabular figures so digits line up down the column.
  numeric?: boolean
}

function DataTable<Row>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  stickyHeader = true,
  className,
}: {
  rows: readonly Row[]
  columns: readonly Column<Row>[]
  rowKey: (row: Row) => string
  onRowClick?: (row: Row) => void
  empty?: React.ReactNode
  stickyHeader?: boolean
  className?: string
}) {
  if (rows.length === 0) {
    return (
      empty ?? (
        <EmptyState
          density="chrome"
          title="Nothing here yet"
          description="When there is something to show, it will appear in this table."
        />
      )
    )
  }

  return (
    // Wide tables scroll inside their own container; the page never scrolls sideways.
    <div className={cn("w-full overflow-x-auto", className)}>
      <Table>
        <TableHeader className={cn(stickyHeader && "sticky top-0 z-sticky bg-surface-raised")}>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  "h-chrome-row px-chrome-x text-chrome-xs font-medium text-text-muted",
                  column.align === "end" && "text-right",
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-border-hairline",
                onRowClick && "cursor-pointer transition-colors hover:bg-surface-raised",
              )}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "h-chrome-row px-chrome-x text-chrome-base text-text-default",
                    column.align === "end" && "text-right",
                    column.numeric && "font-mono tabular-nums",
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export { DataTable, type Column }
