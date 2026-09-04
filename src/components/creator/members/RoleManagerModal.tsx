"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronRight, LoaderCircle, Palette, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { deleteCosmeticRole, saveCosmeticRole } from "@/app/creator/members/actions";
import { MemberModalShell } from "@/components/creator/members/MemberModalShell";
import type { CosmeticRole } from "@/lib/member-operations/types";

type EditorMode = "create" | "edit";

export function RoleManagerModal({ roles, onClose, onChanged }: { roles: CosmeticRole[]; onClose: () => void; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const activeRole = useMemo(() => roles.find((role) => role.id === editingId), [editingId, roles]);

  const openCreate = () => {
    setDeletingId(null);
    setEditingId(null);
    setEditorMode("create");
    setNotice(null);
  };
  const openEdit = (role: CosmeticRole) => {
    setDeletingId(null);
    setEditingId(role.id);
    setEditorMode("edit");
    setNotice(null);
  };
  const save = (data: FormData) => startTransition(async () => {
    const result = await saveCosmeticRole(data);
    setNotice({ kind: result.error ? "error" : "success", text: result.error ?? result.message ?? "Role saved." });
    if (result.success) {
      setEditingId(null);
      setEditorMode("create");
      onChanged();
    }
  });
  const remove = (roleId: string) => startTransition(async () => {
    const result = await deleteCosmeticRole(roleId);
    setNotice({ kind: result.error ? "error" : "success", text: result.error ?? result.message ?? "Role deleted." });
    if (result.success) {
      setDeletingId(null);
      openCreate();
      onChanged();
    }
  });

  return (
    <MemberModalShell title="Manage cosmetic roles" description="Identity badges for the community. They never change permissions or unlock content." onClose={onClose} wide>
      <div className="p-5 sm:p-7">
        {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={`mb-5 rounded-lg border px-4 py-3 text-sm ${notice.kind === "error" ? "border-error/40 bg-error/10 text-error" : "border-primary-container/30 bg-primary-container/10 text-primary-container"}`}>{notice.text}</p>}

        <div className="grid overflow-hidden rounded-xl border border-surgical-steel lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <section className="min-w-0 border-b border-surgical-steel lg:border-r lg:border-b-0" aria-labelledby="role-catalog-heading">
            <div className="flex items-start justify-between gap-4 border-b border-surgical-steel bg-surface-container-low/60 px-5 py-5">
              <div>
                <div className="flex items-center gap-2 text-primary-container"><ShieldCheck size={16} /><span className="text-xs font-semibold">ROLE CATALOG</span></div>
                <h3 id="role-catalog-heading" className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">Community identity</h3>
                <p className="mt-1 text-sm text-on-surface-variant">Priority controls the badge order on member profiles.</p>
              </div>
              <span className="shrink-0 rounded-full border border-surgical-steel px-3 py-1.5 font-mono text-xs tabular-nums text-fog-muted">{roles.length} total</span>
            </div>

            <div className="divide-y divide-surgical-steel">
              {roles.map((role) => (
                <div key={role.id} className={`group px-5 py-4 transition ${editingId === role.id ? "bg-primary-container/10" : "hover:bg-surface-container-high/70"}`}>
                  {deletingId === role.id ? (
                    <div className="rounded-lg border border-error/40 bg-error/10 p-4">
                      <p className="text-sm font-semibold text-white">Delete “{role.name}”?</p>
                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">This immediately removes the badge from every assigned member. Permissions remain unchanged.</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" disabled={pending} onClick={() => remove(role.id)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-error px-4 text-xs font-semibold text-white disabled:opacity-50">{pending ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Confirm delete</button>
                        <button type="button" onClick={() => setDeletingId(null)} className="focus-ring min-h-11 rounded-full border border-surgical-steel px-4 text-xs font-semibold text-on-surface">Keep role</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg border border-surgical-steel bg-surface-container-lowest"><span className="size-4 rounded-full ring-4 ring-black/10" style={{ backgroundColor: role.color }} /></span>
                      <button type="button" onClick={() => openEdit(role)} className="focus-ring min-w-0 flex-1 rounded-lg py-1 text-left">
                        <p className="truncate text-sm font-semibold text-white">{role.name}</p>
                        <p className="mt-1 font-mono text-[11px] tabular-nums text-fog-muted">Priority {role.priority} · {role.color.toUpperCase()}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => openEdit(role)} className="focus-ring grid size-10 place-items-center rounded-full text-fog-muted transition hover:bg-surface-container-low hover:text-white" aria-label={`Edit ${role.name}`}><Pencil size={15} /></button>
                        <button type="button" onClick={() => { setDeletingId(role.id); setNotice(null); }} className="focus-ring grid size-10 place-items-center rounded-full text-fog-muted transition hover:bg-error/10 hover:text-error" aria-label={`Delete ${role.name}`}><Trash2 size={15} /></button>
                        <ChevronRight aria-hidden="true" size={16} className="hidden text-fog-muted sm:block" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!roles.length && <div className="px-5 py-12 text-center"><span className="mx-auto grid size-11 place-items-center rounded-lg border border-surgical-steel bg-surface-container-low"><Palette size={19} className="text-primary-container" /></span><p className="mt-4 text-sm font-semibold text-white">No roles yet</p><p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-fog-muted">Create a badge to give the community a visible shared identity.</p></div>}
            </div>
          </section>

          <section className="bg-surface-container-low/35 p-5 sm:p-6" aria-labelledby="role-editor-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary-container">{editorMode === "edit" ? "EDIT ROLE" : "NEW ROLE"}</p>
                <h3 id="role-editor-heading" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white">{activeRole ? activeRole.name : "Create a badge"}</h3>
              </div>
              {editorMode === "edit" && <button type="button" onClick={openCreate} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full border border-surgical-steel px-3 text-xs font-semibold text-on-surface hover:border-primary-container"><Plus size={14} />New</button>}
            </div>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">Choose a readable name, a recognizable color, and where this badge appears in the list.</p>
            <div className="my-6 border-t border-surgical-steel" />
            <RoleForm key={activeRole?.id ?? "new"} role={activeRole} pending={pending} action={save} cancel={editorMode === "edit" ? openCreate : undefined} />
          </section>
        </div>
      </div>
    </MemberModalShell>
  );
}

function RoleForm({ role, pending, action, cancel }: { role?: CosmeticRole; pending: boolean; action: (data: FormData) => void; cancel?: () => void }) {
  const actionLabel = role ? "Save changes" : "Create role";
  return (
    <form action={action} className="space-y-5">
      {role && <input type="hidden" name="id" value={role.id} />}
      <label className="block text-xs font-semibold text-on-surface-variant">Role name<input data-autofocus name="name" defaultValue={role?.name} required minLength={2} maxLength={32} placeholder="e.g. Founding member" className="focus-ring mt-2 min-h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white placeholder:text-fog-muted sm:text-sm" /></label>
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
        <label className="block text-xs font-semibold text-on-surface-variant">Priority<input name="priority" type="number" min="0" max="1000" defaultValue={role?.priority ?? 0} className="focus-ring mt-2 min-h-12 w-full rounded-lg border border-surgical-steel bg-surface-container-lowest px-3 text-base text-white sm:text-sm" /></label>
        <label className="block text-xs font-semibold text-on-surface-variant">Color<input name="color" type="color" defaultValue={role?.color ?? "#10B981"} className="mt-2 min-h-12 w-full cursor-pointer rounded-lg border border-surgical-steel bg-surface-container-lowest p-1.5" /></label>
      </div>
      <p className="rounded-lg border border-surgical-steel bg-surface-container-lowest/65 px-3 py-3 text-xs leading-5 text-fog-muted">Cosmetic roles are visual only. Use platform roles to grant moderation access.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button disabled={pending} className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-container px-4 text-sm font-semibold text-on-primary-fixed disabled:opacity-50">{pending ? <LoaderCircle size={15} className="animate-spin" /> : role ? <Check size={15} /> : <Plus size={15} />}{actionLabel}</button>
        {cancel && <button type="button" onClick={cancel} className="focus-ring min-h-11 rounded-full border border-surgical-steel px-4 text-xs font-semibold text-on-surface">Cancel</button>}
      </div>
    </form>
  );
}
