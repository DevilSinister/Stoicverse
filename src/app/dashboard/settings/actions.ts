"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";
import { isRateLimited } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = { ok?: boolean; message?: string; error?: string };
export const EMPTY_SETTINGS_ACTION_STATE: SettingsActionState = {};

async function authenticatedMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in and try again." } as const;
  const { data: profile, error } = await supabase.from("profiles").select("full_name,avatar_url,platform_role,is_suspended").eq("id", user.id).maybeSingle();
  if (error || !profile || profile.is_suspended) return { error: "This account is not available." } as const;
  return { supabase, user, profile } as const;
}

async function rateLimit(userId: string, action: string, limit = 10) {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return isRateLimited(`settings:${action}:${userId}:${forwarded}`, limit, 10 * 60_000);
}

export async function updateDisplayName(_state: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 50) return { error: "Use a display name between 2 and 50 characters." };
  if (await rateLimit(auth.user.id, "display-name", 20)) return { error: "Too many profile updates. Wait a few minutes and try again." };
  const { error } = await auth.supabase.from("profiles").update({ full_name: displayName }).eq("id", auth.user.id);
  if (error) return { error: "Your display name could not be saved." };
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Display name updated." };
}

export async function updateEmail(_state: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (email === auth.user.email?.toLowerCase()) return { error: "That is already your account email." };
  if (await rateLimit(auth.user.id, "email", 5)) return { error: "Too many email changes. Wait a few minutes and try again." };
  const { error } = await auth.supabase.auth.updateUser({ email });
  if (error) return { error: "The email change could not be started. Check the address and try again." };
  return { ok: true, message: "Check both email addresses to confirm the change." };
}

export async function updatePassword(_state: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!currentPassword) return { error: "Enter your current password." };
  if (password.length < PASSWORD_MIN_LENGTH) return { error: `Use a new password with at least ${PASSWORD_MIN_LENGTH} characters.` };
  if (password !== confirmation) return { error: "The new passwords do not match." };
  if (currentPassword === password) return { error: "Choose a password different from your current one." };
  if (await rateLimit(auth.user.id, "password", 5)) return { error: "Too many password attempts. Wait a few minutes and try again." };
  const { error } = await auth.supabase.auth.updateUser({ password, current_password: currentPassword });
  if (error) return { error: "The password was not changed. Check your current password and try again." };
  return { ok: true, message: "Password updated." };
}

const avatarTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

export async function uploadAvatar(_state: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  const extension = avatarTypes.get(file.type);
  if (!extension) return { error: "Use a JPEG, PNG, or WebP image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Avatar images must be 5 MB or smaller." };
  if (await rateLimit(auth.user.id, "avatar", 15)) return { error: "Too many avatar changes. Wait a few minutes and try again." };

  const path = `${auth.user.id}/avatar-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await auth.supabase.storage.from("member-avatars").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: "The avatar could not be uploaded." };
  const { error: profileError } = await auth.supabase.from("profiles").update({ avatar_url: path }).eq("id", auth.user.id);
  if (profileError) {
    await auth.supabase.storage.from("member-avatars").remove([path]);
    return { error: "The avatar could not be attached to your profile." };
  }
  if (auth.profile.avatar_url?.startsWith(`${auth.user.id}/`)) await auth.supabase.storage.from("member-avatars").remove([auth.profile.avatar_url]);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Avatar updated." };
}

export async function removeAvatar(_state: SettingsActionState): Promise<SettingsActionState> {
  void _state;
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  const path = auth.profile.avatar_url;
  if (path?.startsWith(`${auth.user.id}/`)) {
    const { error } = await auth.supabase.storage.from("member-avatars").remove([path]);
    if (error) return { error: "The avatar could not be removed." };
  }
  const { error } = await auth.supabase.from("profiles").update({ avatar_url: null }).eq("id", auth.user.id);
  if (error) return { error: "The avatar could not be removed." };
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Avatar removed." };
}

export async function saveNotificationPreferences(_state: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  const values = {
    user_id: auth.user.id,
    event_updates: formData.get("eventUpdates") === "on",
    course_updates: formData.get("courseUpdates") === "on",
    community_mentions: formData.get("communityMentions") === "on",
    role_achievements: formData.get("roleAchievements") === "on",
  };
  const { error } = await auth.supabase.from("member_notification_preferences").upsert(values, { onConflict: "user_id" });
  if (error) return { error: "Notification preferences could not be saved." };
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Notification preferences saved." };
}

export async function revokeOtherSessions(_state: SettingsActionState): Promise<SettingsActionState> {
  void _state;
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  if (await rateLimit(auth.user.id, "sessions", 5)) return { error: "Too many session requests. Wait a few minutes and try again." };
  const { error } = await auth.supabase.auth.signOut({ scope: "others" });
  if (error) return { error: "Other sessions could not be signed out." };
  return { ok: true, message: "All other sessions have been signed out." };
}

export async function requestAccountDeletion(_state: SettingsActionState, formData: FormData): Promise<SettingsActionState | never> {
  const auth = await authenticatedMember();
  if ("error" in auth) return { error: auth.error };
  if (auth.profile.platform_role !== "member") return { error: "Staff and creator accounts must be removed by an administrator." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Account deletion is temporarily unavailable." };
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "DELETE") return { error: "Type DELETE exactly to confirm." };
  if (!currentPassword || !auth.user.email) return { error: "Enter your current password." };
  if (await rateLimit(auth.user.id, "deletion", 3)) return { error: "Too many deletion attempts. Wait a few minutes and try again." };

  const verified = await auth.supabase.auth.signInWithPassword({ email: auth.user.email, password: currentPassword });
  if (verified.error) return { error: "The current password is not correct." };

  const admin = createAdminClient();
  const { error } = await admin.from("account_deletion_requests").insert({
    user_id: auth.user.id,
    requested_role: auth.profile.platform_role,
    scheduled_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  if (error) {
    if (error.code === "23505") return { error: "A deletion request is already active for this account." };
    return { error: "The deletion request could not be created." };
  }

  await auth.supabase.auth.signOut({ scope: "global" });
  redirect("/login?account=deletion-requested");
}

export async function cancelAccountDeletion(_state: SettingsActionState): Promise<SettingsActionState | never> {
  void _state;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to cancel deletion." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Cancellation is temporarily unavailable." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("account_deletion_requests").update({ status: "cancelled", cancelled_at: new Date().toISOString(), last_error: null }).eq("user_id", user.id).eq("status", "pending").select("id").maybeSingle();
  if (error || !data) return { error: "This request can no longer be cancelled automatically. Contact support." };
  revalidatePath("/account/deletion-pending");
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
