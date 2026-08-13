"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type TurnoverActionState = { message?: string; error?: string };
export const EMPTY_TURNOVER_ACTION_STATE: TurnoverActionState = {};

const MAX_TURNOVER = 999_999_999_999.99;

function parseAmount(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : Number.NaN;
}

export async function updateTurnoverMetrics(
  _state: TurnoverActionState,
  formData: FormData,
): Promise<TurnoverActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in and try again." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("platform_role,is_suspended")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_suspended || !["influencer", "moderator"].includes(profile.platform_role)) {
    return { error: "Only the influencer or a moderator can update turnover." };
  }

  const turnoverThisWeek = parseAmount(formData.get("turnoverThisWeek"));
  const allTimeTurnover = parseAmount(formData.get("allTimeTurnover"));
  if (
    !Number.isFinite(turnoverThisWeek)
    || !Number.isFinite(allTimeTurnover)
    || turnoverThisWeek < 0
    || allTimeTurnover < 0
    || turnoverThisWeek > MAX_TURNOVER
    || allTimeTurnover > MAX_TURNOVER
  ) {
    return { error: "Enter valid positive USD amounts within the supported range." };
  }
  if (turnoverThisWeek > allTimeTurnover) {
    return { error: "This week’s turnover cannot be greater than all-time turnover." };
  }

  const { data, error } = await supabase
    .from("member_dashboard_turnover")
    .update({
      turnover_this_week: turnoverThisWeek,
      all_time_turnover: allTimeTurnover,
      updated_by: user.id,
    })
    .eq("id", true)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Turnover figures could not be saved. Try again." };

  revalidatePath("/dashboard");
  revalidatePath("/creator");
  revalidatePath("/creator/dashboard");
  return { message: "Member dashboard turnover updated." };
}
