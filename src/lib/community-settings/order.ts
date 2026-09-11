/**
 * Pure reordering rules for community structure.
 *
 * No imports, so the unit test can load this module directly. Everything here
 * is total: an impossible move returns the list unchanged rather than throwing,
 * because the caller is a keyboard handler and a thrown error there loses the
 * user's focus for no gain.
 */

type Orderable = { id: string; isArchived: boolean };

export type MoveDirection = "up" | "down";

/**
 * Swap one row with its nearest non-archived neighbour.
 *
 * Archived rows keep their slots: they carry no reorder control, so moving one
 * implicitly would be a change the member never asked for and never sees.
 * Returns the same array reference when the move is impossible, which lets the
 * caller skip the commit entirely.
 */
export function moveWithin<T extends Orderable>(items: T[], id: string, direction: MoveDirection): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1 || items[index].isArchived) return items;

  const step = direction === "up" ? -1 : 1;
  let target = index + step;
  while (target >= 0 && target < items.length && items[target].isArchived) target += step;
  if (target < 0 || target >= items.length) return items;

  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** True when the row has somewhere to go — drives the disabled state on each button. */
export function canMove<T extends Orderable>(items: T[], id: string, direction: MoveDirection): boolean {
  return moveWithin(items, id, direction) !== items;
}

/**
 * What the live region says after a move.
 *
 * Position is 1-based over the whole displayed list, archived rows included,
 * because that is the list the creator is looking at.
 */
export function describeMove(label: string, position: number, total: number, container?: string): string {
  const where = container ? ` in ${container}` : "";
  return `${label} moved to position ${position} of ${total}${where}.`;
}
