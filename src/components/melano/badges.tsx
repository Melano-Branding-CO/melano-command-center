import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const base =
  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider border";

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(base, className)}>{children}</span>;
}

const priorityStyles: Record<string, string> = {
  P0: "border-destructive/40 bg-destructive/15 text-destructive",
  P1: "border-warning/40 bg-warning/15 text-warning",
  P2: "border-primary/40 bg-primary/15 text-primary",
  P3: "border-border bg-muted text-muted-foreground",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <Pill className={priorityStyles[priority] ?? priorityStyles.P3!}>{priority}</Pill>;
}

const statusStyles: Record<string, string> = {
  ACTIVE: "border-success/40 bg-success/15 text-success",
  RUNNING: "border-primary/40 bg-primary/15 text-primary",
  PAUSED: "border-border bg-muted text-muted-foreground",
  BLOCKED: "border-warning/40 bg-warning/15 text-warning",
  ERROR: "border-destructive/40 bg-destructive/15 text-destructive",
  FAILED: "border-destructive/40 bg-destructive/15 text-destructive",
  SUCCESS: "border-success/40 bg-success/15 text-success",
  DONE: "border-success/40 bg-success/15 text-success",
  COMPLETED: "border-success/40 bg-success/15 text-success",
  APPROVED: "border-success/40 bg-success/15 text-success",
  REJECTED: "border-destructive/40 bg-destructive/15 text-destructive",
  PENDING: "border-warning/40 bg-warning/15 text-warning",
  PROPOSED: "border-primary/40 bg-primary/15 text-primary",
  EXECUTING: "border-primary/40 bg-primary/15 text-primary",
  BACKLOG: "border-border bg-muted text-muted-foreground",
  READY: "border-primary/40 bg-primary/15 text-primary",
  REVIEW: "border-warning/40 bg-warning/15 text-warning",
  SCHEDULED: "border-border bg-muted text-muted-foreground",
  GREEN: "border-success/40 bg-success/15 text-success",
  YELLOW: "border-warning/40 bg-warning/15 text-warning",
  RED: "border-destructive/40 bg-destructive/15 text-destructive",
  CRITICAL: "border-destructive/40 bg-destructive/15 text-destructive",
  HIGH: "border-warning/40 bg-warning/15 text-warning",
  MEDIUM: "border-primary/40 bg-primary/15 text-primary",
  LOW: "border-border bg-muted text-muted-foreground",
  INFO: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Pill className={statusStyles[status] ?? "border-border bg-muted text-muted-foreground"}>
      {status.replace(/_/g, " ")}
    </Pill>
  );
}

const factStyles: Record<string, string> = {
  HECHO: "border-success/40 bg-success/15 text-success",
  SUPUESTO: "border-warning/40 bg-warning/15 text-warning",
  PENDIENTE: "border-primary/40 bg-primary/15 text-primary",
  BLOQUEO: "border-destructive/40 bg-destructive/15 text-destructive",
};

export function FactBadge({ kind }: { kind: string }) {
  const key = kind?.toUpperCase?.() ?? "PENDIENTE";
  return <Pill className={factStyles[key] ?? factStyles.PENDIENTE!}>{key}</Pill>;
}

export function ModePill({ mode }: { mode: string }) {
  return (
    <Pill
      className={
        mode === "APPROVAL_REQUIRED"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-muted text-muted-foreground"
      }
    >
      {mode.replace(/_/g, " ")}
    </Pill>
  );
}
