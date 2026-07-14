import { AppShell } from "@/components/layout/AppShell";

export function WorkspacePage({
  workspace,
  active,
  title,
  description,
}: {
  workspace: "/dashboard" | "/creator";
  active: string;
  title: string;
  description: string;
}) {
  return (
    <AppShell active={active} title={title} routeBase={workspace} platformRole={workspace === "/creator" ? "influencer" : "member"}>
      <section className="mx-auto max-w-4xl border border-surgical-steel bg-monolith-surface p-6 md:p-8">
        <p className="font-label text-xs tracking-[0.14em] text-primary-container">{workspace === "/creator" ? "CREATOR WORKSPACE" : "MEMBER WORKSPACE"}</p>
        <h1 className="mt-2 font-headline text-3xl font-bold text-white">{title}</h1>
        <p className="mt-3 max-w-2xl font-body text-on-surface-variant">{description}</p>
      </section>
    </AppShell>
  );
}
