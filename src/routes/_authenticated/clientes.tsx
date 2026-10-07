import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate, useOrg, useMyRole } from "@/lib/melano";
import { useOrgRows, useRealtime } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — MELANO INC" },
      { name: "description", content: "Cuentas de clientes con historial de tareas, decisiones y aprobaciones." },
      { property: "og:title", content: "Clientes — MELANO INC" },
      { property: "og:description", content: "Gestión de cuentas y accesos al portal de clientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

type Client = { id: string; name: string; contact_name: string | null; email: string | null; plan: string | null; status: string; created_at: string };
type Item = { id: string; title?: string; action?: string; status: string; created_at?: string; requested_at?: string; client_id: string | null };
type Access = { id: string; client_id: string; email: string; revoked_at: string | null; created_at: string };

const db = supabase as unknown as { from: (t: string) => any };
const ADMIN_ROLES = ["CEO", "ADMIN"];
const WRITE_ROLES = ["CEO", "ADMIN", "OPERATOR"];

function ClientsPage() {
  const qc = useQueryClient();
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const isAdmin = ADMIN_ROLES.includes(role ?? "");
  const canWrite = WRITE_ROLES.includes(role ?? "");
  useRealtime(["clients", "tasks", "decisions", "approvals", "client_portal_access"]);

  const { data: clients, isLoading } = useOrgRows<Client>("clients", org?.id, { order: "created_at" });
  const { data: tasks } = useOrgRows<Item>("tasks", org?.id, { order: "created_at", limit: 500 });
  const { data: decisions } = useOrgRows<Item>("decisions", org?.id, { order: "created_at", limit: 500 });
  const { data: approvals } = useOrgRows<Item>("approvals", org?.id, { order: "requested_at", limit: 500 });
  const { data: access } = useOrgRows<Access>("client_portal_access", org?.id, { order: "created_at" });

  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact_name: "", email: "", plan: "" });
  const current = (clients ?? []).find((c) => c.id === selected) ?? null;

  const log = (action: string, entityType: string, entityId: string, detail: Record<string, unknown>) =>
    db.from("activity_logs").insert({ organization_id: org!.id, actor_type: "human", action, entity_type: entityType, entity_id: entityId, detail, trace_id: crypto.randomUUID() });

  const create = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (name.length < 2) throw new Error("Ingresá el nombre de la cuenta");
      const email = form.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");
      const { data, error } = await db.from("clients").insert({
        organization_id: org!.id, name, contact_name: form.contact_name.trim() || null, email: email || null, plan: form.plan.trim() || null,
      }).select("id").single();
      if (error) throw error;
      await log("client.created", "client", data.id, { name });
      return data.id as string;
    },
    onSuccess: (id) => { setForm({ name: "", contact_name: "", email: "", plan: "" }); setSelected(id); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Cuenta creada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Clientes" subtitle="Cada cuenta con su historial real. Los invitados ven solo su cuenta en /publico." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {isAdmin ? (
            <Panel title="Nueva cuenta">
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
                <Input placeholder="Nombre de la cuenta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
                <Input placeholder="Contacto" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} maxLength={120} />
                <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} />
                <Input placeholder="Plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} maxLength={80} />
                <Button type="submit" size="sm" disabled={create.isPending}>Crear cuenta</Button>
              </form>
            </Panel>
          ) : null}
          <Panel title={`Cuentas (${(clients ?? []).length})`}>
            {isLoading ? <Empty text="Cargando…" /> : (clients ?? []).length === 0 ? <Empty text="Sin cuentas cargadas." /> : (
              <ul className="space-y-1">
                {(clients ?? []).map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setSelected(c.id)}
                      className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent ${selected === c.id ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
                      <span className="block font-medium text-foreground">{c.name}</span>
                      <span className="text-[11px]">{c.status}{c.plan ? ` · ${c.plan}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {current ? (
          <ClientDetail
            key={current.id}
            client={current}
            orgId={org!.id}
            canWrite={canWrite}
            isAdmin={isAdmin}
            tasks={tasks ?? []}
            decisions={decisions ?? []}
            approvals={approvals ?? []}
            access={(access ?? []).filter((a) => a.client_id === current.id)}
            log={log}
          />
        ) : (
          <Panel title="Detalle"><Empty text="Elegí una cuenta para ver su historial." /></Panel>
        )}
      </div>
    </>
  );
}

function ClientDetail({ client, orgId, canWrite, isAdmin, tasks, decisions, approvals, access, log }: {
  client: Client; orgId: string; canWrite: boolean; isAdmin: boolean;
  tasks: Item[]; decisions: Item[]; approvals: Item[]; access: Access[];
  log: (action: string, entityType: string, entityId: string, detail: Record<string, unknown>) => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState(client.email ?? "");

  const link = useMutation({
    mutationFn: async (v: { table: "tasks" | "decisions" | "approvals"; id: string; clientId: string | null }) => {
      const { error } = await db.from(v.table).update({ client_id: v.clientId }).eq("id", v.id).eq("organization_id", orgId);
      if (error) throw error;
      await log(v.clientId ? "client.item_linked" : "client.item_unlinked", v.table, v.id, { client_id: client.id });
      return v.table;
    },
    onSuccess: (t) => qc.invalidateQueries({ queryKey: [t] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const invite = useMutation({
    mutationFn: async () => {
      const email = inviteEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("client_portal_access")
        .upsert({ organization_id: orgId, client_id: client.id, email, invited_by: u.user?.id ?? null, revoked_at: null }, { onConflict: "client_id,email" });
      if (error) throw error;
      await log("client.portal_invited", "client", client.id, { email });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client_portal_access"] }); toast.success("Acceso al portal habilitado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (a: Access) => {
      const { error } = await db.from("client_portal_access").update({ revoked_at: new Date().toISOString() }).eq("id", a.id);
      if (error) throw error;
      await log("client.portal_revoked", "client", client.id, { email: a.email });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_portal_access"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sections = [
    { table: "tasks" as const, label: "Tareas", rows: tasks },
    { table: "decisions" as const, label: "Decisiones", rows: decisions },
    { table: "approvals" as const, label: "Aprobaciones", rows: approvals },
  ];

  return (
    <div className="space-y-4">
      <Panel title={client.name} action={<StatusBadge status={client.status} />}>
        <p className="text-sm text-muted-foreground">
          {client.contact_name ?? "Sin contacto"} · {client.email ?? "sin email"} · Plan: {client.plan ?? "—"} · Alta: {fmtDate(client.created_at)}
        </p>
      </Panel>

      <Panel title="Acceso al portal (/publico)">
        {isAdmin ? (
          <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
            <Input className="h-9 max-w-[280px]" type="email" placeholder="email del cliente" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <Button size="sm" type="submit" disabled={invite.isPending}>Invitar</Button>
          </form>
        ) : <p className="mb-2 text-[11px] text-muted-foreground">Solo CEO y ADMIN pueden invitar.</p>}
        {access.length === 0 ? <Empty text="Nadie tiene acceso a esta cuenta todavía." /> : (
          <ul className="space-y-1">
            {access.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className={a.revoked_at ? "text-muted-foreground line-through" : "text-foreground"}>{a.email}</span>
                {a.revoked_at ? <span className="text-[11px] text-muted-foreground">Revocado</span> : isAdmin ? (
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(a)} disabled={revoke.isPending}>Revocar</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {sections.map((s) => {
        const mine = s.rows.filter((r) => r.client_id === client.id);
        const free = s.rows.filter((r) => !r.client_id);
        return (
          <Panel key={s.table} title={`${s.label} (${mine.length})`}>
            {canWrite && free.length > 0 ? (
              <select
                className="mb-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value=""
                disabled={link.isPending}
                onChange={(e) => e.target.value && link.mutate({ table: s.table, id: e.target.value, clientId: client.id })}
                aria-label={`Asignar ${s.label.toLowerCase()} a ${client.name}`}
              >
                <option value="">Asignar {s.label.toLowerCase()} sin cliente…</option>
                {free.slice(0, 200).map((r) => <option key={r.id} value={r.id}>{r.title ?? r.action}</option>)}
              </select>
            ) : null}
            {mine.length === 0 ? <Empty text={`Sin ${s.label.toLowerCase()} asignadas.`} /> : (
              <ul className="space-y-1">
                {mine.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-1 text-sm last:border-0">
                    <span className="truncate text-foreground">{r.title ?? r.action}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                      {fmtDate(r.created_at ?? r.requested_at)} <StatusBadge status={r.status} />
                      {canWrite ? <Button size="sm" variant="ghost" onClick={() => link.mutate({ table: s.table, id: r.id, clientId: null })}>Quitar</Button> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
