"use client";

import type { ComponentType, ReactNode } from "react";
import { Gift, Info, ShieldBan, ShieldMinus, ShieldOff, Timer, UserMinus } from "lucide-react";

import { TIMEOUT_PRESETS } from "@/lib/community-settings/model";

/**
 * The actions offered on a member, written once.
 *
 * A dropdown and a context menu are different component trees in base-ui, so
 * the same list has to be renderable into either. It is passed the pieces to
 * build with rather than duplicated — a right-click menu that quietly drifts
 * from the left-click one is a bug nobody notices until somebody relies on it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- the two menu families
   have structurally identical but nominally different prop types, and all this
   file does with them is pass children through. */
export type MenuParts = {
  Item: ComponentType<any>;
  Sub: ComponentType<any>;
  SubTrigger: ComponentType<any>;
  SubContent: ComponentType<any>;
  Separator: ComponentType<any>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type GiftOption = { days: number; label: string };

/** What the owner can hand out: long enough to matter, short enough to be a gift. */
export const GIFT_OPTIONS: readonly GiftOption[] = [
  { days: 7, label: "1 week" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 365, label: "1 year" },
];

export type MemberMenuContext = {
  isSelf: boolean;
  canMention: boolean;
  canTimeout: boolean;
  canBan: boolean;
  canSeeDetail: boolean;
  canGift: boolean;
  channelName: string;
  categoryName: string;
  onMention: () => void;
  onDetail: () => void;
  onGift: (days: number) => void;
  onTimeout: (seconds: number) => void;
  onRemoveTimeout: () => void;
  onRestrict: (scope: "channel" | "category") => void;
  onLift: (scope: "channel" | "category") => void;
  onBan: () => void;
};

export function memberMenuItems(parts: MenuParts, context: MemberMenuContext): ReactNode {
  const { Item, Sub, SubTrigger, SubContent, Separator } = parts;
  const { isSelf, canMention, canTimeout, canBan, canSeeDetail, canGift, channelName, categoryName } = context;

  const moderating = !isSelf && (canTimeout || canBan);
  const staffing = canSeeDetail || canGift;

  return (
    <>
      {canMention ? <Item onClick={context.onMention}>Mention</Item> : null}

      {staffing ? (
        <>
          {canMention ? <Separator /> : null}
          {canSeeDetail ? (
            <Item onClick={context.onDetail}>
              <span className="flex items-center gap-2">
                <Info size={13} aria-hidden="true" />
                View details
              </span>
            </Item>
          ) : null}
          {/*
            Gifting is the owner's alone — the database refuses anybody else,
            so a moderator seeing this would be seeing a guaranteed failure.
          */}
          {canGift ? (
            <Sub>
              <SubTrigger>
                <span className="flex items-center gap-2">
                  <Gift size={13} aria-hidden="true" />
                  Gift a membership
                </span>
              </SubTrigger>
              <SubContent className="w-44">
                {GIFT_OPTIONS.map((option) => (
                  <Item key={option.days} onClick={() => context.onGift(option.days)}>
                    {option.label}
                  </Item>
                ))}
              </SubContent>
            </Sub>
          ) : null}
        </>
      ) : null}

      {moderating ? (
        <>
          <Separator />
          {canTimeout ? (
            <>
              {/*
                A submenu, not six items in the open. Somebody opening a
                member's menu to mention them should not have to read past
                every possible punishment first.
              */}
              <Sub>
                <SubTrigger>
                  <span className="flex items-center gap-2">
                    <Timer size={13} aria-hidden="true" />
                    Time out
                  </span>
                </SubTrigger>
                <SubContent className="w-44">
                  {TIMEOUT_PRESETS.map((preset) => (
                    <Item key={preset.seconds} onClick={() => context.onTimeout(preset.seconds)}>
                      {preset.label}
                    </Item>
                  ))}
                </SubContent>
              </Sub>
              <Item onClick={context.onRemoveTimeout}>
                <span className="flex items-center gap-2">
                  <ShieldMinus size={13} aria-hidden="true" />
                  Remove timeout
                </span>
              </Item>
            </>
          ) : null}

          {canBan ? (
            <>
              <Sub>
                <SubTrigger>
                  <span className="flex items-center gap-2">
                    <ShieldBan size={13} aria-hidden="true" />
                    Remove from
                  </span>
                </SubTrigger>
                <SubContent className="w-60">
                  <Item onClick={() => context.onRestrict("channel")}>{`This channel — #${channelName}`}</Item>
                  <Item onClick={() => context.onRestrict("category")}>{`This category — ${categoryName}`}</Item>
                  <Separator />
                  {/*
                    The community sits last and apart. It is the only one of the
                    three that lifting a restriction cannot undo.
                  */}
                  <Item variant="destructive" onClick={context.onBan}>
                    <span className="flex items-center gap-2">
                      <UserMinus size={13} aria-hidden="true" />
                      The whole community
                    </span>
                  </Item>
                </SubContent>
              </Sub>

              <Sub>
                <SubTrigger>
                  <span className="flex items-center gap-2">
                    <ShieldOff size={13} aria-hidden="true" />
                    Lift a restriction
                  </span>
                </SubTrigger>
                <SubContent className="w-60">
                  <Item onClick={() => context.onLift("channel")}>{`This channel — #${channelName}`}</Item>
                  <Item onClick={() => context.onLift("category")}>{`This category — ${categoryName}`}</Item>
                </SubContent>
              </Sub>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
