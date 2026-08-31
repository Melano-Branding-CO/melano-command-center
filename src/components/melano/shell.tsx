import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  Bot,
  CalendarClock,
  ChartNoAxesColumn,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Sun,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AUTONOMY_LEVELS, useMyRole, useOrg } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { StatusBadge } from "@/components/melano/badges";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/command", label: "Command Center", icon: LayoutDashboard },
  { to: "/today", label: "Today", icon: Sun },
  { to: "/revenue", label: "Revenue", icon: Wallet },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/decisions", label: "Decisions", icon: GitBranch },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/automations", label: "Automations", icon: BadgeCheck },
  { to: "/products", label: "Products", icon: Package },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/metrics", label: "Metrics", icon: ChartNoAxesColumn },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtime(["tasks", "approvals", "agent_runs", "activity_logs"]);

  const { data: agents } = useOrgRows<{ status: string; enabled: boolean }>("agents", org?.id, {
    order: "sort_order",
    asc: true,
  });
  const { data: alerts } = useOrgRows<{ severity: string }>("alerts", org?.id, {
    eq: { status: "OPEN" },
    order: "created_at",
  });
  const { data: pendingApprovals } = useOrgRows<{ id: string }>("approvals", org?.id, {
    eq: { status: "PENDING" },
    order: "requested_at",
  });

  const activeAgents = (agents ?? []).filter((a) => a.enabled && a.status !== "PAUSED").length;
  const criticalAlerts = (alerts ?? []).filter((a) =>
    ["CRITICAL", "HIGH"].includes(a.severity),
  ).length;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/command" className="text-sm font-semibold tracking-tight text-foreground">
            MELANO INC
          </Link>
          <button
            className="text-muted-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 overflow-y-auto p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              }}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {to === "/approvals" && (pendingApprovals?.length ?? 0) > 0 ? (
                <span className="rounded bg-warning/20 px-1.5 text-[11px] font-semibold text-warning">
                  {pendingApprovals?.length}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="size-4" /> Salir
          </button>
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-background/70 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <button
              className="text-muted-foreground lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {org?.name ?? "MELANO INC"} · Autonomous Command Center
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {org?.tagline ?? "AI. Automation. Impact."} · {role ?? "—"}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                Sistema <StatusBadge status={org?.system_health ?? "YELLOW"} />
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5">
                Autonomía L{org?.autonomy_level ?? 0} ·{" "}
                {AUTONOMY_LEVELS[org?.autonomy_level ?? 0] ?? "—"}
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5">
                Agentes activos {activeAgents}
              </span>
              <span
                className={cn(
                  "rounded border px-2 py-0.5",
                  criticalAlerts > 0
                    ? "border-destructive/40 bg-destructive/15 text-destructive"
                    : "border-border bg-muted",
                )}
              >
                Alertas críticas {criticalAlerts}
              </span>
            </div>
          </div>
        </header>
        <main className="px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="label-caps">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
