import "server-only";

export type MemberCursor = { normalizedName: string; id: string };

export function encodeMemberCursor(cursor: MemberCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeMemberCursor(value: string | null): MemberCursor | null {
  if (!value || value.length > 500) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MemberCursor>;
    if (typeof parsed.normalizedName !== "string" || parsed.normalizedName.length > 160 || typeof parsed.id !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    return { normalizedName: parsed.normalizedName, id: parsed.id };
  } catch {
    return null;
  }
}
