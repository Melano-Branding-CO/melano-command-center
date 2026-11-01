import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { oauth } from "@/lib/oauth-consent";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Conectar un agente — MELANO INC" },
    { name: "description", content: "Autorizá un agente para consultar tus registros de MELANO INC con tus permisos." },
    { property: "og:title", content: "Conectar un agente — MELANO INC" },
    { property: "og:description", content: "Consentimiento privado para las integraciones de agentes." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  validateSearch: (search: Record<string, unknown>) => ({ authorization_id: typeof search["authorization_id"] === "string" ? search["authorization_id"] : "" }),
  beforeLoad: async ({ search, location }) => {
    if (!search["authorization_id"]) throw new Error("Falta la solicitud de autorización. Iniciá la conexión nuevamente desde tu agente.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("No se pudo comprobar tu sesión. Reintentá la conexión.");
    if (!data.session) throw redirect({ href: `/auth?next=${encodeURIComponent(location.pathname + location.searchStr + location.hash)}` });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("Falta la solicitud de autorización.");
    const { data, error } = await oauth.getAuthorizationDetails(id);
    if (error || !data) throw new Error("La solicitud venció, no es válida o no se pudo consultar. Iniciá la conexión nuevamente.");
    const target = data.redirect_url ?? data.redirect_to;
    if (target && !data.client) throw redirect({ href: target });
    const { data: sessionData } = await supabase.auth.getSession();
    return { details: data, email: sessionData.session?.user.email ?? "Cuenta autenticada" };
  },
  pendingComponent: () => <main className="p-8 text-muted-foreground">Consultando solicitud de conexión…</main>,
  errorComponent: ({ error }) => <main className="mx-auto max-w-lg space-y-4 px-6 py-16"><h1 className="text-xl font-semibold">No se pudo conectar el agente</h1><p role="alert" className="text-muted-foreground">{error instanceof Error ? error.message : "No se pudo consultar la solicitud."}</p><Link to="/auth">Volver al acceso</Link></main>,
  component: Consent,
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = details.client?.name ?? details.client?.client_name ?? "este agente";
  const scopes = details.scopes ?? details.scope?.split(" ").filter(Boolean) ?? [];
  async function decide(approve: boolean) {
    setBusy(true); setError("");
    try {
      const result = approve ? await oauth.approveAuthorization(authorization_id) : await oauth.denyAuthorization(authorization_id);
      if (result.error) throw new Error("No se pudo guardar tu elección. Reintentá.");
      const target = result.data?.redirect_url ?? result.data?.redirect_to;
      if (!target) throw new Error("No se recibió una dirección de retorno. Iniciá la conexión nuevamente.");
      window.location.assign(target);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo completar la conexión.");
      setBusy(false);
    }
  }
  return <main className="mx-auto max-w-lg space-y-5 px-6 py-16">
    <p className="label-caps">MELANO INC</p>
    <h1 className="text-2xl font-semibold">Conectar {client} con Melano Command Center</h1>
    <p className="text-sm text-muted-foreground">Cuenta: {email}</p>
    <p>Esto permite que {client} consulte esta app con tus permisos.</p>
    {details.redirect_uri && <p className="break-all text-sm text-muted-foreground">Dirección de retorno: {details.redirect_uri}</p>}
    <ul className="space-y-2 text-sm">
      {scopes.map(scope => <li key={scope}>{scope === "email" ? "Compartir tu dirección de email" : scope === "profile" ? "Compartir tu perfil básico" : scope === "openid" ? "Confirmar tu identidad" : `Permiso adicional solicitado: ${scope}`}</li>)}
      <li>Consultar organizaciones autorizadas, tareas, decisiones, aprobaciones, leads y estados de agentes.</li>
    </ul>
    <p className="text-sm text-muted-foreground">Solo lectura. No permite aprobar ni ejecutar acciones. Los permisos de la app siguen vigentes.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => decide(true)}>Permitir conexión</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</Button></div>
    <Button variant="ghost" disabled={busy} onClick={async () => { await supabase.auth.signOut(); window.location.assign(`/auth?next=${encodeURIComponent(`/.lovable/oauth/consent?authorization_id=${authorization_id}`)}`); }}>Cambiar de cuenta</Button>
  </main>;
}