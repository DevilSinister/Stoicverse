import { NextResponse } from "next/server";

import { authorizeInfluencerApi, MemberDirectoryError, queryMemberDirectory } from "@/lib/member-operations/server";
import type { MembershipStatus, PlatformMemberRole } from "@/lib/member-operations/types";

const statuses = new Set<MembershipStatus>(["active", "gifted", "expired", "pending", "suspended"]);
const platformRoles = new Set<PlatformMemberRole>(["member", "moderator"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const { supabase } = await authorizeInfluencerApi();
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim() ?? "";
    const status = params.get("status") ?? "";
    const platformRole = params.get("platformRole") ?? "";
    const cosmeticRoleId = params.get("cosmeticRoleId") ?? "";
    const tierValue = params.get("tier") ?? "";
    const tier = tierValue ? Number(tierValue) : null;
    if (q.length > 100 || (status && !statuses.has(status as MembershipStatus)) || (platformRole && !platformRoles.has(platformRole as PlatformMemberRole)) || (cosmeticRoleId && !UUID_PATTERN.test(cosmeticRoleId)) || (tier !== null && (!Number.isInteger(tier) || tier < 1 || tier > 5))) {
      return NextResponse.json({ error: "Invalid directory filters" }, { status: 400 });
    }
    const page = await queryMemberDirectory(supabase, {
      q,
      status: status as MembershipStatus | "",
      platformRole: platformRole as PlatformMemberRole | "",
      cosmeticRoleId,
      tier,
      cursor: params.get("cursor") ?? "",
    });
    return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof MemberDirectoryError ? error.status : 500;
    const message = error instanceof MemberDirectoryError ? error.message : "Member directory unavailable";
    return NextResponse.json({ error: message }, { status });
  }
}

