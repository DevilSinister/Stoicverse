export type MembershipStatus = "active" | "gifted" | "expired" | "pending" | "suspended";
export type PlatformMemberRole = "member" | "moderator";

export type CosmeticRole = { id: string; name: string; color: string; priority: number };

export type MemberDirectoryRow = {
  id: string;
  fullName: string;
  platformRole: PlatformMemberRole;
  isSuspended: boolean;
  accountCreatedAt: string;
  membershipStatus: MembershipStatus;
  joinedAt: string | null;
  expiresAt: string | null;
  currentTier: number;
  isMaster: boolean;
  cosmeticRoles: CosmeticRole[];
  currentWeekTurnover: number;
  allTimeTurnover: number;
};

export type MemberSummary = MemberDirectoryRow;
export type MemberTurnoverRow = MemberDirectoryRow;
export type MemberDirectoryPage = { members: MemberDirectoryRow[]; nextCursor: string | null };
export type MemberFilters = {
  q?: string;
  status?: MembershipStatus | "";
  tier?: number | null;
  platformRole?: PlatformMemberRole | "";
  cosmeticRoleId?: string;
  cursor?: string;
};
export type MemberActionResult = { success?: true; message?: string; error?: string };
export type TurnoverChange = { userId: string; amountUsd: number };

