import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/google-signin";
import { getMyPortal, type PortalClient, type PortalItem } from "@/lib/clients.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/melano";

export const Route = createFileRoute("/publico")({
  head: () => ({
    meta: [
      { title: "Portal de clientes — MELANO INC" },
      { name: "description", content: "Portal privado para clientes invitados de MELANO INC: tareas, decisiones y aprobaciones de su cuenta." },
      { property: "og:title", content: "Portal de clientes — MELANO INC" },
      { property: "og:description", content: "Acceso exclusivo para clientes invitados de MELANO INC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const qc = useQueryClient();
  const [session, setSession] = useState<"loading" | "out" | "in">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ? "in" : "out"));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ? "in" : "out"));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-[0.2em]">MELANO INC</span>
          {session === "in" ? <Button size="sm" variant="ghost" onClick={signOut}>Cerrar sesión</Button> : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Portal de clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acceso exclusivo para cuentas invitadas.</p>
        <div className="mt-8">
          {session === "loading" ? <p className="text-sm text-muted-foreground">Cargando…</p> : session === "out" ? <PortalSignIn /> : <PortalContent />}
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-[11px] text-muted-foreground">MELANO INC — AI. Automation. Impact.</footer>
    </div>
  );
}

function PortalSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("Email o contraseña incorrectos.");
  }

  return (
    <div className="max-w-sm rounded-lg border border-border bg-card p-6">
      <p className="mb-4 text-sm text-muted-foreground">Ingresá con el email con el que fuiste invitado.</p>
      <Button className="w-full" variant="outline" onClick={async () => { const { error } = await signInWithGoogle("/publico"); if (error) toast.error(error.message); }}>
        Continuar con Google
      </Button>
      <form onSubmit={submit} className="mt-4 space-y-2">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" disabled={busy}>Ingresar</Button>
      </form>
    </div>
  );
}

function PortalContent() {
  const fn = useServerFn(getMyPortal);
  const { data, isLoading, error } = useQuery({ queryKey: ["my-portal"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando tu cuenta…</p>;
  if (error) return <p className="text-sm text-destructive">No se pudo cargar el portal: {(error as Error).message}</p>;
  if (!data || data.clients.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Tu cuenta {data?.email ?? ""} no tiene acceso a ningún cliente. Pedile una invitación a MELANO INC.
      </div>
    );
  }
  return <div className="space-y-8">{data.clients.map((c) => <ClientBlock key={c.id} client={c} />)}</div>;
}

function ClientBlock({ client }: { client: PortalClient }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{client.name}</h2>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{client.status}{client.plan ? ` · ${client.plan}` : ""}</span>
      </div>
      {client.next_action ? <p className="mt-1 text-sm text-muted-foreground">Próximo paso: {client.next_action}</p> : null}
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <ItemList title="Tareas" items={client.tasks} />
        <ItemList title="Decisiones" items={client.decisions} />
        <ItemList title="Aprobaciones" items={client.approvals} />
      </div>
    </section>
  );
}

function ItemList({ title, items }: { title: string; items: PortalItem[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title} ({items.length})</h3>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Sin registros.</p> : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="border-b border-border/50 pb-2 text-sm last:border-0">
              <p className="text-foreground">{i.title}</p>
              <p className="text-[11px] text-muted-foreground">{i.status} · {fmtDate(i.created_at)}</p>
              {i.detail ? <p className="mt-1 text-[11px] text-muted-foreground">{i.detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
