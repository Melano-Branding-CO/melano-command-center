import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/melano/shell";
import { AUTONOMY_LEVELS, useMyRole, useOrg, type AppRole } from "@/lib/melano";
import {
  createOrganization,
  inviteUser,
  listAdminData,
  removeMember,
  revokeInvite,
  setAutonomyLevel,
  updateMemberRole,
} from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración — MELANO INC" },
      {
        name: "description",
        content: "Invitaciones, organizaciones, miembros y políticas de acceso del Command Center.",
      },
      { property: "og:title", content: "Administración — MELANO INC" },
      {
        property: "og:description",
        content: "Gestión de accesos, roles y políticas para CEO y ADMIN.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const ROLES: AppRole[] = ["CEO", "ADMIN", "OPERATOR", "VIEWER", "AGENT"];

const ROLE_POLICY: Record<string, string> = {
  CEO: "Autoridad final. Aprueba acciones críticas, define políticas y autonomía.",
  ADMIN: "Administra accesos, organizaciones, agentes y configuración operativa.",
  OPERATOR: "Ejecuta agentes, reuniones y tareas. No administra accesos.",
  VIEWER: "Sólo lectura de tableros, decisiones y logs.",
  AGENT: "Identidad no humana para ejecuciones automatizadas y trazabilidad.",
};

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function AdminPage() {
  const { data: org } = useOrg();
  const { data: role, isLoading: roleLoading } = useMyRole(org?.id);
  const isAdmin = role === "CEO" || role === "ADMIN";

  const load = useServerFn(listAdminData);
  const invite = useServerFn(inviteUser);
  const revoke = useServerFn(revokeInvite);
  const createOrg = useServerFn(createOrganization);
  const changeRole = useServerFn(updateMemberRole);
  const kick = useServerFn(removeMember);
  const setLevel = useServerFn(setAutonomyLevel);

  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("OPERATOR");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  const admin = useQuery({
    queryKey: ["admin-data", org?.id],
    enabled: !!org?.id && isAdmin,
    queryFn: () => load({ data: { organizationId: org!.id } }),
  });

  async function guard(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMessage);
      await admin.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  if (roleLoading) {
    return <PageHeader title="Administración" subtitle="Verificando permisos…" />;
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Administración" subtitle={`Rol actual: ${role ?? "sin rol"}`} />
        <Panel title="Acceso restringido">
          <p className="text-sm text-muted-foreground">
            Esta sección está disponible únicamente para los roles CEO y ADMIN.
          </p>
        </Panel>
      </>
    );
  }

  const data = admin.data;

  return (
    <>
      <PageHeader
        title="Administración"
        subtitle={`Organización: ${org?.name ?? "—"} · Rol: ${role}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Invitar usuario">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="persona@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Rol asignado</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              La invitación vence en 14 días. El acceso se otorga automáticamente cuando la persona
              se registra con ese email.
            </p>
            <Button
              disabled={busy || !email.trim()}
              onClick={() =>
                guard(async () => {
                  await invite({
                    data: { organizationId: org!.id, email, role: inviteRole },
                  });
                  setEmail("");
                }, "Invitación creada")
              }
            >
              Crear invitación
            </Button>
          </div>
        </Panel>

        <Panel title="Crear organización">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="org-name">Nombre</Label>
              <Input
                id="org-name"
                placeholder="MELANO LATAM"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                placeholder="melano-latam"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value.toLowerCase())}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Quien la crea queda como CEO de la nueva organización. Los datos permanecen aislados
              por tenant.
            </p>
            <Button
              variant="outline"
              disabled={busy || !orgName.trim() || !orgSlug.trim()}
              onClick={() =>
                guard(async () => {
                  await createOrg({ data: { name: orgName, slug: orgSlug } });
                  setOrgName("");
                  setOrgSlug("");
                }, "Organización creada")
              }
            >
              Crear organización
            </Button>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4">
        <Panel title="Invitaciones">
          {admin.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !data?.invites.length ? (
            <p className="text-sm text-muted-foreground">
              No hay invitaciones registradas en esta organización.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium">Email</th>
                    <th className="py-2 text-left font-medium">Rol</th>
                    <th className="py-2 text-left font-medium">Estado</th>
                    <th className="py-2 text-left font-medium">Vence</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.invites.map((inv) => {
                    const expired = new Date(inv.expires_at).getTime() < Date.now();
                    const status = inv.accepted_at
                      ? "Aceptada"
                      : expired
                        ? "Vencida"
                        : "Pendiente";
                    return (
                      <tr key={inv.id} className="border-b border-border/60">
                        <td className="py-2">{inv.email}</td>
                        <td className="py-2">{inv.role}</td>
                        <td className="py-2 text-muted-foreground">{status}</td>
                        <td className="py-2 text-muted-foreground">{fmt(inv.expires_at)}</td>
                        <td className="py-2 text-right">
                          {!inv.accepted_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                guard(
                                  () =>
                                    revoke({
                                      data: { organizationId: org!.id, inviteId: inv.id },
                                    }),
                                  "Invitación revocada",
                                )
                              }
                            >
                              Revocar
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Miembros y roles">
          {admin.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !data?.members.length ? (
            <p className="text-sm text-muted-foreground">Sin miembros registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium">Usuario</th>
                    <th className="py-2 text-left font-medium">Alta</th>
                    <th className="py-2 text-left font-medium">Rol</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => {
                    const self = m.userId === data.me;
                    return (
                      <tr key={m.userId} className="border-b border-border/60">
                        <td className="py-2">
                          <div className="font-medium text-foreground">
                            {m.fullName ?? m.email ?? m.userId}
                          </div>
                          {m.email && (
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">{fmt(m.createdAt)}</td>
                        <td className="py-2">
                          <Select
                            value={m.role}
                            disabled={busy || self}
                            onValueChange={(v) =>
                              guard(
                                () =>
                                  changeRole({
                                    data: {
                                      organizationId: org!.id,
                                      userId: m.userId,
                                      role: v,
                                    },
                                  }),
                                "Rol actualizado",
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || self}
                            onClick={() =>
                              guard(
                                () =>
                                  kick({
                                    data: { organizationId: org!.id, userId: m.userId },
                                  }),
                                "Miembro removido",
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Políticas de acceso por rol">
            <ul className="grid gap-2 text-sm">
              {ROLES.map((r) => (
                <li key={r} className="rounded-md border border-border/60 p-3">
                  <div className="font-medium text-foreground">{r}</div>
                  <p className="text-xs text-muted-foreground">{ROLE_POLICY[r]}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Los permisos se aplican en base de datos con RLS y aislamiento por organización; la
              interfaz sólo refleja esas reglas.
            </p>
          </Panel>

          <Panel title="Política de autonomía">
            <div className="grid gap-2">
              {Object.entries(AUTONOMY_LEVELS).map(([level, label]) => {
                const n = Number(level);
                const active = (org?.autonomy_level ?? 0) === n;
                return (
                  <Button
                    key={level}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    disabled={busy}
                    className="justify-start"
                    onClick={() =>
                      guard(
                        () => setLevel({ data: { organizationId: org!.id, level: n } }),
                        `Autonomía L${n}`,
                      )
                    }
                  >
                    L{level} · {label}
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Las acciones críticas siguen requiriendo aprobación humana explícita, sin importar el
              nivel configurado.
            </p>
          </Panel>
        </div>

        {!!data?.organizations.length && (
          <Panel title="Mis organizaciones">
            <ul className="grid gap-2 text-sm">
              {data.organizations.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
                >
                  <div>
                    <div className="font-medium text-foreground">{o.name}</div>
                    <div className="text-xs text-muted-foreground">
                      /{o.slug} · L{o.autonomyLevel}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{o.role}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
