import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel, Empty, RoleGate } from "@/components/melano/shell";
import { PriorityBadge, StatusBadge } from "@/components/melano/badges";
import { agentMap, fmtDate, useAgents, useMyRole, useOrg, type Agent } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";
import { supabase } from "@/integrations/supabase/client";
import { listOrgMembers, saveAssignment, updateMyAssignment } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/asignaciones")({
  head: () => ({
    meta: [
      { title: "Asignaciones — Tareas y objetivos | MELANO INC" },
      {
        name: "description",
        content:
          "Panel de asignaciones: objetivos, responsables, prioridades, vencimientos y avance auditable de cada tarea.",
      },
      { property: "og:title", content: "Asignaciones — Tareas y objetivos" },
      {
        property: "og:description",
        content: "Asignación de tareas y objetivos por responsable con registro auditable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGate allow={["CEO", "ADMIN", "OPERATOR"]}>
      <AssignmentsPage />
    </RoleGate>
  ),
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  success_metric: string | null;
  why_now: string | null;
  next_action: string | null;
  result: string | null;
  priority: string;
  status: string;
  assigned_user: string | null;
  assigned_agent: string | null;
  deadline: string | null;
  is_today_priority: boolean;
  created_at: string;
};

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const STATUSES = ["BACKLOG", "READY", "RUNNING", "BLOCKED", "REVIEW", "DONE", "FAILED"] as const;

const EMPTY_FORM = {
  id: "",
  title: "",
  successMetric: "",
  whyNow: "",
  nextAction: "",
  description: "",
  priority: "P2",
  status: "READY",
  assignedUser: "",
  assignedAgent: "",
  deadline: "",
  isTodayPriority: false,
};

function AssignmentsPage() {
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const isAdmin = role === "CEO" || role === "ADMIN";
  const qc = useQueryClient();
  useRealtime(["tasks"]);

  const { data: agents } = useAgents(org?.id);
  const map = agentMap(agents as Agent[] | undefined);
  const { data: tasks, isLoading } = useOrgRows<Task>("tasks", org?.id, { order: "created_at" });

  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const membersFn = useServerFn(listOrgMembers);
  const membersQuery = useQuery({
    queryKey: ["org-members", org?.id],
    enabled: !!org?.id && isAdmin,
    queryFn: async () => (await membersFn({ data: { organizationId: org!.id } })).members,
  });
  const members = membersQuery.data ?? [];
  const memberLabel = (userId: string | null) => {
    if (!userId) return null;
    const m = members.find((x) => x.userId === userId);
    return m?.fullName || m?.email || userId.slice(0, 8);
  };

  const save = useServerFn(saveAssignment);
  const progress = useServerFn(updateMyAssignment);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY_FORM, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const rows = useMemo(() => (tasks ?? []) as Task[], [tasks]);
  const mine = rows.filter((t) => me && t.assigned_user === me && t.status !== "DONE");

  const groups = useMemo(() => {
    const byUser = new Map<string, Task[]>();
    for (const t of rows) {
      const key = t.assigned_user ?? (t.assigned_agent ? `agent:${t.assigned_agent}` : "none");
      byUser.set(key, [...(byUser.get(key) ?? []), t]);
    }
    return [...byUser.entries()];
  }, [rows]);

  const groupTitle = (key: string) => {
    if (key === "none") return "Sin responsable asignado";
    if (key.startsWith("agent:")) return `Agente ${map.get(key.slice(6))?.code ?? "—"}`;
    return memberLabel(key) ?? "Responsable";
  };

  async function submit() {
    if (!org?.id || !form.title.trim()) {
      toast.error("El título de la tarea es obligatorio");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          organizationId: org.id,
          id: form.id || undefined,
          title: form.title,
          description: form.description || null,
          successMetric: form.successMetric || null,
          whyNow: form.whyNow || null,
          nextAction: form.nextAction || null,
          priority: form.priority,
          status: form.status,
          assignedUser: form.assignedUser || null,
          assignedAgent: form.assignedAgent || null,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
          isTodayPriority: form.isTodayPriority,
        },
      });
      toast.success(form.id ? "Asignación actualizada" : "Asignación creada");
      setForm({ ...EMPTY_FORM });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function advance(task: Task, status: string) {
    if (!org?.id) return;
    try {
      await progress({ data: { organizationId: org.id, taskId: task.id, status } });
      toast.success(`"${task.title}" → ${status}`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  return (
    <>
      <PageHeader
        title="Asignaciones"
        subtitle="Objetivos, responsables, prioridades y avance de cada tarea del sistema."
      />

      <Panel title="Mis asignaciones">
        {mine.length === 0 ? (
          <Empty text="No tenés tareas abiertas asignadas." />
        ) : (
          <ul className="divide-y divide-border">
            {mine.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                <div className="min-w-[12rem] flex-1">
                  <p className="truncate text-foreground">{t.title}</p>
                  {t.success_metric ? (
                    <p className="truncate text-xs text-muted-foreground">
                      Objetivo: {t.success_metric}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(t.deadline)}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => advance(t, "RUNNING")}>
                    En curso
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => advance(t, "BLOCKED")}>
                    Bloqueada
                  </Button>
                  <Button size="sm" onClick={() => advance(t, "DONE")}>
                    Completar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {isAdmin ? (
        <Panel title={form.id ? "Editar asignación" : "Nueva asignación"}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Tarea</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ej: Contactar 10 inmobiliarias de la Tanda 1"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Objetivo medible</Label>
              <Input
                value={form.successMetric}
                onChange={(e) => set("successMetric", e.target.value)}
                placeholder="Ej: 3 reuniones agendadas antes del viernes"
              />
            </div>
            <div>
              <Label>Responsable</Label>
              <Select
                value={form.assignedUser || "none"}
                onValueChange={(v) => set("assignedUser", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin responsable</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {(m.fullName || m.email || m.userId.slice(0, 8)) + ` · ${m.role}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agente de apoyo</Label>
              <Select
                value={form.assignedAgent || "none"}
                onValueChange={(v) => set("assignedAgent", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin agente</SelectItem>
                  {((agents ?? []) as Agent[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vencimiento</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
              />
            </div>
            <div>
              <Label>Próxima acción</Label>
              <Input
                value={form.nextAction}
                onChange={(e) => set("nextAction", e.target.value)}
                placeholder="Primer paso concreto"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Por qué ahora / contexto</Label>
              <Textarea
                rows={3}
                value={form.whyNow}
                onChange={(e) => set("whyNow", e.target.value)}
                placeholder="Señal operativa que justifica esta asignación"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.isTodayPriority}
                onChange={(e) => set("isTodayPriority", e.target.checked)}
              />
              Marcar como prioridad de hoy (aparece en Today y Command Center)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={busy}>
              {busy ? "Guardando…" : form.id ? "Guardar cambios" : "Crear asignación"}
            </Button>
            {form.id ? (
              <Button variant="outline" onClick={() => setForm({ ...EMPTY_FORM })}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <Panel title="Asignaciones por responsable">
        {isLoading ? (
          <Empty text="Cargando…" />
        ) : groups.length === 0 ? (
          <Empty text="Todavía no hay tareas registradas." />
        ) : (
          <div className="space-y-6">
            {groups.map(([key, items]) => (
              <div key={key}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupTitle(key)} · {items.length}
                </p>
                <ul className="divide-y divide-border">
                  {items.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      <div className="min-w-[12rem] flex-1">
                        <p className="truncate text-foreground">{t.title}</p>
                        {t.success_metric ? (
                          <p className="truncate text-xs text-muted-foreground">
                            Objetivo: {t.success_metric}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtDate(t.deadline)}</span>
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setForm({
                              id: t.id,
                              title: t.title,
                              description: t.description ?? "",
                              successMetric: t.success_metric ?? "",
                              whyNow: t.why_now ?? "",
                              nextAction: t.next_action ?? "",
                              priority: t.priority,
                              status: t.status,
                              assignedUser: t.assigned_user ?? "",
                              assignedAgent: t.assigned_agent ?? "",
                              deadline: t.deadline ? t.deadline.slice(0, 10) : "",
                              isTodayPriority: t.is_today_priority,
                            })
                          }
                        >
                          Editar
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
