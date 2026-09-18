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
      <section className="mx-auto max-w-4xl rounded-lg border border-border-hairline bg-surface-panel p-6 md:p-8">
        <p className="font-mono text-mono-xs tracking-[0.14em] text-primary">{workspace === "/creator" ? "CREATOR WORKSPACE" : "MEMBER WORKSPACE"}</p>
        <h1 className="mt-2 text-title-lg font-medium text-text-strong">{title}</h1>
        <p className="mt-3 max-w-2xl text-content-sm text-text-default">{description}</p>
      </section>
    </AppShell>
  );
}
