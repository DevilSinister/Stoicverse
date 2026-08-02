"use server";

import { revalidatePath } from "next/cache";

import { requireInfluencer } from "@/lib/supabase/access";

type Result = { error?: string; success?: true };
const value = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
const uuid = (candidate: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate);
const color = (candidate: string) => /^#[0-9a-f]{6}$/i.test(candidate);
const refresh = () => { revalidatePath("/creator/members"); revalidatePath("/creator/channels"); revalidatePath("/dashboard/community"); };

export async function saveCosmeticRole(data: FormData): Promise<Result> {
  const id = value(data, "id");
  const name = value(data, "name");
  const roleColor = value(data, "color");
  const priority = Number(value(data, "priority"));
  if ((id && !uuid(id)) || name.length < 2 || name.length > 32 || !color(roleColor) || !Number.isInteger(priority) || priority < 0 || priority > 1000) return { error: "Enter a 2-32 character name, valid color, and priority from 0-1000." };

  const { supabase, user } = await requireInfluencer();
  const payload = { name, color: roleColor.toUpperCase(), priority };
  const result = id
    ? await supabase.from("cosmetic_roles").update(payload).eq("id", id)
    : await supabase.from("cosmetic_roles").insert({ ...payload, created_by: user.id });
  if (result.error) return { error: result.error.code === "23505" ? "A role with this name already exists." : result.error.message };
  refresh();
  return { success: true };
}

export async function deleteCosmeticRole(roleId: string): Promise<Result> {
  if (!uuid(roleId)) return { error: "Invalid role." };
  const { supabase } = await requireInfluencer();
  const { error } = await supabase.from("cosmetic_roles").delete().eq("id", roleId);
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}

export async function setCosmeticRoleAssignment(roleId: string, memberId: string, assigned: boolean): Promise<Result> {
  if (!uuid(roleId) || !uuid(memberId)) return { error: "Invalid member or role." };
  const { supabase, user } = await requireInfluencer();
  const result = assigned
    ? await supabase.from("cosmetic_role_assignments").insert({ role_id: roleId, user_id: memberId, assigned_by: user.id })
    : await supabase.from("cosmetic_role_assignments").delete().eq("role_id", roleId).eq("user_id", memberId);
  if (result.error && result.error.code !== "23505") return { error: result.error.message };
  refresh();
  return { success: true };
}
