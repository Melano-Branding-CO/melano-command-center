import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Empty } from "@/components/melano/shell";
import { StatusBadge } from "@/components/melano/badges";
import { useOrg } from "@/lib/melano";
import { useOrgRows } from "@/lib/melano-queries";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — MELANO INC" },
      { name: "description", content: "Portfolio de productos y su estado comercial." },
      { property: "og:title", content: "Products — MELANO INC" },
      { property: "og:description", content: "Productos de MELANO INC y su estado." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  price: number | null;
  currency: string | null;
};

function ProductsPage() {
  const { data: org } = useOrg();
  const { data: products, isLoading } = useOrgRows<Product>("products", org?.id, {
    order: "created_at",
  });

  return (
    <>
      <PageHeader title="Products" subtitle="Qué vendemos, a qué precio y en qué estado." />
      {isLoading ? (
        <Empty text="Cargando…" />
      ) : (products ?? []).length === 0 ? (
        <Empty text="Sin productos cargados." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(products ?? []).map((p) => (
            <Panel
              key={p.id}
              title={p.name}
              action={p.status ? <StatusBadge status={p.status} /> : undefined}
            >
              <p className="text-sm text-muted-foreground">{p.description ?? "—"}</p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                {p.price == null ? "SIN DATOS" : `${p.price} ${p.currency ?? ""}`}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
