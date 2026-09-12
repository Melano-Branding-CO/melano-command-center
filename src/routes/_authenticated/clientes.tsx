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
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { fmtDate, useMyRole, useOrg } from "@/lib/melano";
import {
  deleteClient,
  listAssignableOperators,
  listClients,
  saveClient,
} from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — MELANO INC" },
      {
        name: "description",
        content:
          "Alta y seguimiento de clientes reales de MELANO INC con etapas LUXIA y registro auditable.",
      },
      { property: "og:title", content: "Clientes — MELANO INC" },
      {
        property: "og:description",
        content: "Cartera de clientes, etapa LUXIA, facturación mensual y próxima acción.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

type Stage = "FASE_0_14" | "FASE_15_45" | "FASE_46_90";

type Client = {
  id: string;
  name: string;
  legal_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  segment: string | null;
  status: string;
  luxia_stage: Stage;
  plan: string | null;
  mrr: number;
  currency: string;
  next_action: string | null;
  onboarding_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  owner_user: string | null;
  created_at: string;
};

const STATUSES = ["PROSPECTO", "ONBOARDING", "ACTIVO", "PAUSADO", "CERRADO"] as const;

const STAGES: { key: Stage; label: string; desc: string }[] = [
  {
    key: "FASE_0_14",
    label: "LUXIA 0–14 días",
    desc: "Onboarding, relevamiento de datos y primera automatización operativa.",
  },
  {
    key: "FASE_15_45",
    label: "LUXIA 15–45 días",
    desc: "Seguimiento sistemático, calificación de leads y ajuste de guiones.",
  },
  {
    key: "FASE_46_90",
    label: "LUXIA 46–90 días",
    desc: "Cierre de operaciones, reactivación de fríos y revenue recurrente.",
  },
];

const EMPTY_FORM = {
  id: "" as string,
  name: "",
  legalName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  city: "Mar del Plata",
  segment: "",
  status: "PROSPECTO",
  luxiaStage: "FASE_0_14" as Stage,
  plan: "",
  mrr: "",
  currency: "ARS",
  nextAction: "",
  onboardingAt: "",
  lastContactAt: "",
  nextFollowUpAt: "",
  notes: "",
  ownerUser: "",
};

type FormState = typeof EMPTY_FORM;

function toForm(c: Client): FormState {
  return {
    id: c.id,
    name: c.name,
    legalName: c.legal_name ?? "",
    contactName: c.contact_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    website: c.website ?? "",
    city: c.city ?? "",
    segment: c.segment ?? "",
    status: c.status,
    luxiaStage: c.luxia_stage,
    plan: c.plan ?? "",
    mrr: c.mrr ? String(c.mrr) : "",
    currency: c.currency,
    nextAction: c.next_action ?? "",
    onboardingAt: (c.onboarding_at ?? "").slice(0, 10),
    lastContactAt: (c.last_contact_at ?? "").slice(0, 10),
    nextFollowUpAt: (c.next_follow_up_at ?? "").slice(0, 10),
    notes: c.notes ?? "",
    ownerUser: c.owner_user ?? "",
  };
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function ClientsPage() {
  const { data: org } = useOrg();
  const { data: role, isLoading: roleLoading } = useMyRole(org?.id);
  const isAdmin = role === "CEO" || role === "ADMIN";

  const load = useServerFn(listClients);
  const save = useServerFn(saveClient);
  const remove = useServerFn(deleteClient);
  const loadOperators = useServerFn(listAssignableOperators);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const clients = useQuery({
    queryKey: ["clients", org?.id],
    enabled: !!org?.id && isAdmin,
    queryFn: async () => {
      const res = await load({ data: { organizationId: org!.id } });
      return res.clients as unknown as Client[];
    },
  });

  const operators = useQuery({
    queryKey: ["assignable-operators", org?.id],
    enabled: !!org?.id && isAdmin,
    queryFn: async () => {
      const res = await loadOperators({ data: { organizationId: org!.id } });
      return res.operators;
    },
  });

  const operatorLabel = (userId: string | null) => {
    if (!userId) return "Sin asignar";
    const op = (operators.data ?? []).find((o) => o.userId === userId);
    return op ? `${op.fullName ?? op.email ?? op.userId} · ${op.role}` : "Asignado";
  };

  const rows = useMemo(() => clients.data ?? [], [clients.data]);
  const totals = useMemo(() => {
    const active = rows.filter((c) => c.status === "ACTIVO");
    return {
      total: rows.length,
      active: active.length,
      mrr: active.reduce((acc, c) => acc + Number(c.mrr ?? 0), 0),
      currency: active[0]?.currency ?? "ARS",
    };
  }, [rows]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    if (!org?.id || !form.name.trim()) return;
    setBusy(true);
    try {
      await save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          organizationId: org.id,
          name: form.name,
          legalName: form.legalName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          website: form.website,
          city: form.city,
          segment: form.segment,
          status: form.status,
          luxiaStage: form.luxiaStage,
          plan: form.plan,
          mrr: form.mrr ? Number(form.mrr) : 0,
          currency: form.currency,
          nextAction: form.nextAction,
          onboardingAt: form.onboardingAt || null,
          lastContactAt: form.lastContactAt || null,
          nextFollowUpAt: form.nextFollowUpAt || null,
          notes: form.notes,
          ownerUser: form.ownerUser || null,
        },
      });
      toast.success(form.id ? "Cliente actualizado" : "Cliente creado");
      setForm(EMPTY_FORM);
      await clients.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el cliente");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(client: Client) {
    if (!org?.id) return;
    setBusy(true);
    try {
      await remove({ data: { organizationId: org.id, clientId: client.id } });
      toast.success("Cliente eliminado");
      if (form.id === client.id) setForm(EMPTY_FORM);
      await clients.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }

  async function moveStage(client: Client, stage: Stage) {
    if (!org?.id) return;
    setBusy(true);
    try {
      await save({
        data: {
          id: client.id,
          organizationId: org.id,
          name: client.name,
          legalName: client.legal_name,
          contactName: client.contact_name,
          email: client.email,
          phone: client.phone,
          website: client.website,
          city: client.city,
          segment: client.segment,
          status: client.status,
          luxiaStage: stage,
          plan: client.plan,
          mrr: Number(client.mrr ?? 0),
          currency: client.currency,
          nextAction: client.next_action,
          onboardingAt: client.onboarding_at,
          lastContactAt: new Date().toISOString(),
          nextFollowUpAt: client.next_follow_up_at,
          notes: client.notes,
          ownerUser: client.owner_user,
        },
      });
      toast.success("Etapa LUXIA actualizada");
      await clients.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la etapa");
    } finally {
      setBusy(false);
    }
  }

  if (roleLoading) {
    return <PageHeader title="Clientes" subtitle="Verificando permisos…" />;
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Clientes" subtitle={`Rol actual: ${role ?? "sin rol"}`} />
        <Panel title="Acceso restringido">
          <p className="text-sm text-muted-foreground">
            La cartera de clientes está disponible únicamente para los roles CEO y ADMIN.
          </p>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`${totals.total} clientes · ${totals.active} activos · MRR ${money(totals.mrr, totals.currency)}`}
      />

      <Panel title={form.id ? "Editar cliente" : "Nuevo cliente"}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="c-name">Nombre comercial *</Label>
            <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-legal">Razón social</Label>
            <Input
              id="c-legal"
              value={form.legalName}
              onChange={(e) => set("legalName", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-contact">Contacto</Label>
            <Input
              id="c-contact"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input
              id="c-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-phone">Teléfono</Label>
            <Input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-web">Sitio web</Label>
            <Input
              id="c-web"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-city">Ciudad</Label>
            <Input id="c-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-segment">Segmento</Label>
            <Input
              id="c-segment"
              placeholder="Inmobiliaria, retail, servicios…"
              value={form.segment}
              onChange={(e) => set("segment", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-plan">Plan</Label>
            <Input id="c-plan" value={form.plan} onChange={(e) => set("plan", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
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
          <div className="grid gap-1.5">
            <Label>Etapa LUXIA</Label>
            <Select value={form.luxiaStage} onValueChange={(v) => set("luxiaStage", v as Stage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-mrr">Facturación mensual</Label>
            <div className="flex gap-2">
              <Input
                id="c-mrr"
                type="number"
                min="0"
                value={form.mrr}
                onChange={(e) => set("mrr", e.target.value)}
              />
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-onboarding">Alta / onboarding</Label>
            <Input
              id="c-onboarding"
              type="date"
              value={form.onboardingAt}
              onChange={(e) => set("onboardingAt", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-last">Último contacto</Label>
            <Input
              id="c-last"
              type="date"
              value={form.lastContactAt}
              onChange={(e) => set("lastContactAt", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-next">Próximo seguimiento</Label>
            <Input
              id="c-next"
              type="date"
              value={form.nextFollowUpAt}
              onChange={(e) => set("nextFollowUpAt", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 md:col-span-3">
            <Label htmlFor="c-action">Próxima acción</Label>
            <Input
              id="c-action"
              value={form.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Responsable asignado</Label>
            <Select
              value={form.ownerUser || "NONE"}
              onValueChange={(v) => set("ownerUser", v === "NONE" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin asignar</SelectItem>
                {(operators.data ?? []).map((o) => (
                  <SelectItem key={o.userId} value={o.userId}>
                    {(o.fullName ?? o.email ?? o.userId) + " · " + o.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 md:col-span-3">
            <Label htmlFor="c-notes">Notas</Label>
            <Textarea
              id="c-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={busy || !form.name.trim()} onClick={onSave}>
            {form.id ? "Guardar cambios" : "Crear cliente"}
          </Button>
          {form.id ? (
            <Button variant="ghost" disabled={busy} onClick={() => setForm(EMPTY_FORM)}>
              Cancelar
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cada alta, edición o baja queda registrada en <code>activity_logs</code> con actor, acción
          y fecha.
        </p>
      </Panel>

      <div className="mt-4 grid gap-4">
        {STAGES.map((stage) => {
          const list = rows.filter((c) => c.luxia_stage === stage.key);
          return (
            <Panel key={stage.key} title={`${stage.label} · ${list.length}`}>
              <p className="mb-3 text-xs text-muted-foreground">{stage.desc}</p>
              {clients.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : !list.length ? (
                <Empty text="Sin clientes en esta etapa" />
              ) : (
                <ul className="grid gap-2">
                  {list.map((c) => (
                    <li key={c.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{c.name}</span>
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[c.segment, c.city, c.contact_name].filter(Boolean).join(" · ") || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[c.email, c.phone].filter(Boolean).join(" · ") ||
                              "Sin contacto cargado"}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div className="text-sm font-medium text-foreground">
                            {money(Number(c.mrr ?? 0), c.currency)}
                          </div>
                          <div>Último contacto: {fmtDate(c.last_contact_at)}</div>
                          <div>Próximo: {fmtDate(c.next_follow_up_at)}</div>
                          <div>Responsable: {operatorLabel(c.owner_user)}</div>
                        </div>
                      </div>
                      {c.next_action ? (
                        <p className="mt-2 text-sm text-foreground">
                          Próxima acción: {c.next_action}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {STAGES.filter((s) => s.key !== c.luxia_stage).map((s) => (
                          <Button
                            key={s.key}
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => moveStage(c, s.key)}
                          >
                            Mover a {s.label.replace("LUXIA ", "")}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setForm(toForm(c))}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => onDelete(c)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
