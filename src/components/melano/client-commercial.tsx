import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveClientCommercial } from "@/lib/commercial.functions";

type Client = {
  id: string;
  status: string;
  mrr: number;
  currency: string;
  next_action: string | null;
  next_follow_up_at: string | null;
};

function localDateTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function ClientCommercial({
  client,
  organizationId,
  canWrite,
}: {
  client: Client;
  organizationId: string;
  canWrite: boolean;
}) {
  const [status, setStatus] = useState(client.status);
  const [currency, setCurrency] = useState(client.currency);
  const [mrr, setMrr] = useState(String(client.mrr));
  const [action, setAction] = useState(client.next_action ?? "");
  const [followUp, setFollowUp] = useState(localDateTime(client.next_follow_up_at));
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveClientCommercial);
  const cache = useQueryClient();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await save({
        data: {
          organizationId,
          clientId: client.id,
          status,
          currency,
          mrr: Number(mrr),
          nextAction: action,
          nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null,
        },
      });
      await cache.invalidateQueries({ queryKey: ["clients", organizationId] });
      toast.success(`Seguimiento guardado · trace ${result.traceId.slice(0, 8)}`);
    } catch (error) {
      await cache.invalidateQueries({ queryKey: ["clients", organizationId] });
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el seguimiento");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">
          Estado registrado
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!canWrite || busy}
          >
            {["PROSPECTO", "ACTIVO", "PAUSADO", "BAJA"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Moneda
          <Input
            value={currency}
            maxLength={3}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            disabled={!canWrite || busy}
          />
        </label>
        <label className="text-xs">
          MRR registrado
          <Input
            type="number"
            min="0"
            step="0.01"
            required
            value={mrr}
            onChange={(e) => setMrr(e.target.value)}
            disabled={!canWrite || busy}
          />
        </label>
      </div>
      <label className="block text-xs">
        Próxima acción comercial
        <Input
          required
          maxLength={1000}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          disabled={!canWrite || busy}
        />
      </label>
      <label className="block text-xs">
        Seguimiento (fecha y hora de tu navegador)
        <Input
          type="datetime-local"
          required
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          disabled={!canWrite || busy}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Este registro no acredita contrato ni cobro. El MRR de prospectos no se suma a ingresos
        activos.
      </p>
      {canWrite ? (
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Guardando…" : "Guardar seguimiento comercial"}
        </Button>
      ) : null}
    </form>
  );
}
