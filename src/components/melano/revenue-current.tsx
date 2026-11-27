import { Link } from "@tanstack/react-router";
import { Empty } from "./shell";
import { useCurrentRevenue } from "@/lib/revenue-queries";

export function RevenueCurrent({ organizationId }: { organizationId: string | undefined }) {
  const { summary, isLoading, error } = useCurrentRevenue(organizationId);
  if (isLoading) return <Empty text="Cargando estado comercial…" />;
  if (error) return <Empty text={`BLOQUEO: ${error.message}`} />;
  return (
    <div className="space-y-3 text-sm">
      <p>
        Clientes con estado ACTIVO: <strong>{summary.activeClients}</strong>
      </p>
      {summary.money.length === 0 ? (
        <Empty text="MRR registrado: SIN DATOS" />
      ) : (
        summary.money.map((m) => (
          <div key={m.currency} className="border-b border-border pb-2">
            <p>
              MRR registrado · {m.currency}: <strong>{m.mrr.toLocaleString("es-AR")}</strong>
            </p>
            <p className="text-muted-foreground">
              ARR derivado (MRR × 12): {m.arr.toLocaleString("es-AR")} {m.currency}
            </p>
          </div>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        El MRR registrado no acredita contrato ni cobro; prospectos y presupuestos de leads están
        excluidos.
      </p>
      <p>
        <Link to="/clientes" className="underline">
          Prospectos: {summary.prospects} · Sin próxima acción: {summary.clientsWithoutAction}
        </Link>
      </p>
      <p>
        <Link to="/leads" className="underline">
          Seguimientos vencidos: {summary.pendingFollowups}
        </Link>
      </p>
      <p className="text-xs text-muted-foreground">
        Cobros, costos, margen y rentabilidad: SIN DATOS.
      </p>
    </div>
  );
}
