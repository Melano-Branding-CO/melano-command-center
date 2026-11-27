import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/melano/shell";
import { useOrg } from "@/lib/melano";
import { useRealtime } from "@/lib/melano-queries";
import { RevenueCurrent } from "@/components/melano/revenue-current";

export const Route = createFileRoute("/_authenticated/revenue")({
  head: () => ({
    meta: [
      { title: "Revenue — MELANO INC" },
      { name: "description", content: "Ingresos, pipeline y métricas comerciales verificadas." },
      { property: "og:title", content: "Revenue — MELANO INC" },
      { property: "og:description", content: "Estado comercial de MELANO INC en tiempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RevenuePage,
});

function RevenuePage() {
  const { data: org } = useOrg();
  useRealtime(["clients", "leads"]);
  return (
    <>
      <PageHeader
        title="Revenue"
        subtitle="Estado comercial actual. El ingreso registrado se distingue del cobro verificado."
      />
      <Panel title="Ingresos y próximas acciones">
        <RevenueCurrent organizationId={org?.id} />
      </Panel>
    </>
  );
}
