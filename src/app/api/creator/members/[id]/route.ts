import { NextResponse } from "next/server";

import { authorizeInfluencerApi, mapDirectoryRow, MemberDirectoryError } from "@/lib/member-operations/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid member" }, { status: 400 });
    const { supabase } = await authorizeInfluencerApi();
    const { data, error } = await supabase.rpc("get_creator_member_summary", { target_user_id: id });
    if (error) throw new MemberDirectoryError("Member details unavailable");
    const row = data;
    if (!row) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ member: mapDirectoryRow(row) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof MemberDirectoryError ? error.status : 500;
    const message = error instanceof MemberDirectoryError ? error.message : "Member details unavailable";
    return NextResponse.json({ error: message }, { status });
  }
}
