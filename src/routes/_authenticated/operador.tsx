import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useOrg } from "@/lib/melano";
import { listMyClients, logClientTouch } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/operador")({
  head: () => ({
    meta: [
      { title: "Operador — Mi cartera LUXIA | MELANO INC" },
      {
        name: "description",
        content:
          "Cartera asignada al operador por cohorte LUXIA, con seguimiento, próxima acción y registro auditable.",
      },
      { property: "og:title", content: "Operador — Mi cartera LUXIA" },
      {
        property: "og:description",
        content: "Clientes asignados, seguimiento y log de actividad del operador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGate allow={["OPERATOR", "ADMIN", "CEO"]}>
      <OperatorPage />
    </RoleGate>
  ),
});

type Stage = "FASE_0_14" | "FASE_15_45" | "FASE_46_90";

type Client = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  segment: string | null;
  status: string;
  luxia_stage: Stage;
  next_action: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
};

type Log = {
  id: string;
  action: string;
  entity_id: string | null;
  created_at: string;
  detail: Record<string, unknown> | null;
};

const COHORTS: { key: Stage; label: string; desc: string }[] = [
  {
    key: "FASE_0_14",
    label: "Cohorte LUXIA 0–14 días",
    desc: "Onboarding y primera automatización operativa.",
  },
  {
    key: "FASE_15_45",
    label: "Cohorte LUXIA 15–45 días",
    desc: "Seguimiento sistemático y calificación de leads.",
  },
  {
    key: "FASE_46_90",
    label: "Cohorte LUXIA 46–90 días",
    desc: "Cierre de operaciones y revenue recurrente.",
  },
];

const STATUSES = ["PROSPECTO", "ONBOARDING", "ACTIVO", "PAUSADO", "CERRADO"] as const;

function OperatorPage() {
  const { data: org } = useOrg();
  const load = useServerFn(listMyClients);
  const touch = useServerFn(logClientTouch);

  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["my-clients", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const res = await load({ data: { organizationId: org!.id } });
      return {
        clients: res.clients as unknown as Client[],
        logs: res.logs as unknown as Log[],
      };
    },
  });

  const clients = useMemo(() => query.data?.clients ?? [], [query.data]);
  const logs = useMemo(() => query.data?.logs ?? [], [query.data]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = clients.filter(
    (c) => c.next_follow_up_at && c.next_follow_up_at.slice(0, 10) <= today,
  );

  function openForm(c: Client) {
    setOpenId(c.id);
    setNote("");
    setNextAction(c.next_action ?? "");
    setNextFollowUp((c.next_follow_up_at ?? "").slice(0, 10));
    setStatus(c.status);
  }

  async function submit(c: Client) {
    if (!org?.id || !note.trim()) return;
    setBusy(true);
    try {
      await touch({
        data: {
          organizationId: org.id,
          clientId: c.id,
          note,
          nextAction: nextAction || null,
          nextFollowUpAt: nextFollowUp || null,
          ...(status ? { status } : {}),
        },
      });
      toast.success("Seguimiento registrado");
      setOpenId(null);
      setNote("");
      await query.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el seguimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Operador · Mi cartera"
        subtitle={`${clients.length} clientes asignados · ${overdue.length} con seguimiento vencido`}
      />

      {query.isLoading ? (
        <Empty text="Cargando tu cartera…" />
      ) : !clients.length ? (
        <Panel title="Sin cartera asignada">
          <Empty text="Todavía no tenés clientes asignados. El CEO o un ADMIN debe asignarte responsables desde Clientes." />
        </Panel>
      ) : (
        <div className="grid gap-4">
          {COHORTS.map((cohort) => {
            const list = clients.filter((c) => c.luxia_stage === cohort.key);
            return (
              <Panel key={cohort.key} title={`${cohort.label} · ${list.length}`}>
                <p className="mb-3 text-xs text-muted-foreground">{cohort.desc}</p>
                {!list.length ? (
                  <Empty text="Sin clientes asignados en esta cohorte" />
                ) : (
                  <ul className="grid gap-2">
                    {list.map((c) => {
                      const clientLogs = logs.filter((l) => l.entity_id === c.id).slice(0, 5);
                      const isOverdue =
                        !!c.next_follow_up_at && c.next_follow_up_at.slice(0, 10) <= today;
                      return (
                        <li key={c.id} className="rounded-md border border-border/60 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{c.name}</span>
                                <StatusBadge status={c.status} />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {[c.segment, c.city, c.contact_name].filter(Boolean).join(" · ") ||
                                  "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {[c.email, c.phone].filter(Boolean).join(" · ") ||
                                  "Sin contacto cargado"}
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div>Último contacto: {fmtDate(c.last_contact_at)}</div>
                              <div className={isOverdue ? "font-medium text-warning" : undefined}>
                                Próximo: {fmtDate(c.next_follow_up_at)}
                              </div>
                            </div>
                          </div>

                          {c.next_action ? (
                            <p className="mt-2 text-sm text-foreground">
                              Próxima acción: {c.next_action}
                            </p>
                          ) : null}

                          {clientLogs.length ? (
                            <ul className="mt-3 grid gap-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                              {clientLogs.map((l) => (
                                <li key={l.id}>
                                  {fmtDate(l.created_at)} · {l.action}
                                  {typeof l.detail?.["note"] === "string"
                                    ? ` — ${l.detail["note"] as string}`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Sin seguimientos registrados.
                            </p>
                          )}

                          {openId === c.id ? (
                            <div className="mt-3 grid gap-3 border-t border-border/60 pt-3 md:grid-cols-3">
                              <div className="grid gap-1.5 md:col-span-3">
                                <Label htmlFor={`note-${c.id}`}>Nota de seguimiento *</Label>
                                <Textarea
                                  id={`note-${c.id}`}
                                  rows={3}
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  placeholder="Qué se hizo, qué respondió el cliente, evidencia."
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label htmlFor={`action-${c.id}`}>Próxima acción</Label>
                                <Input
                                  id={`action-${c.id}`}
                                  value={nextAction}
                                  onChange={(e) => setNextAction(e.target.value)}
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label htmlFor={`follow-${c.id}`}>Próximo contacto</Label>
                                <Input
                                  id={`follow-${c.id}`}
                                  type="date"
                                  value={nextFollowUp}
                                  onChange={(e) => setNextFollowUp(e.target.value)}
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label>Estado</Label>
                                <Select value={status} onValueChange={setStatus}>
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
                              <div className="flex gap-2 md:col-span-3">
                                <Button
                                  size="sm"
                                  disabled={busy || !note.trim()}
                                  onClick={() => submit(c)}
                                >
                                  Registrar seguimiento
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => setOpenId(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <Button size="sm" variant="outline" onClick={() => openForm(c)}>
                                Registrar seguimiento
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Cada seguimiento queda auditado en <code>activity_logs</code> con actor, cliente, nota y
        fecha. Los operadores solo acceden a los clientes asignados a su cartera; la etapa LUXIA,
        el alta y la baja siguen siendo exclusivas de CEO y ADMIN.
      </p>
    </>
  );
}
