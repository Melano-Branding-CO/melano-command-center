import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateOperationalPriorities, getAiStatus } from "@/lib/melano.functions";
import { useMyRole } from "@/lib/melano";

export function useAiStatus(organizationId?: string) {
  const status = useServerFn(getAiStatus);
  return useQuery({
    queryKey: ["ai-status", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => status({ data: { organizationId: organizationId! } }),
    retry: false,
    staleTime: 60_000,
  });
}

export function AiStatusNotice({ organizationId }: { organizationId: string | undefined }) {
  const { data, error, isPending } = useAiStatus(organizationId);
  const message = error
    ? `BLOQUEO: ${error.message}`
    : isPending
      ? "Comprobando configuración de IA…"
      : data?.reason;
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-border p-3 text-sm text-muted-foreground"
    >
      {message}
    </p>
  );
}

export function GeneratePrioritiesButton({
  organizationId,
}: {
  organizationId: string | undefined;
}) {
  const { data: role } = useMyRole(organizationId);
  const [busy, setBusy] = useState(false);
  const generate = useServerFn(generateOperationalPriorities);
  const cache = useQueryClient();
  async function onGenerate() {
    if (!organizationId) return;
    setBusy(true);
    try {
      const result = await generate({ data: { organizationId } });
      await cache.invalidateQueries({ queryKey: ["tasks", organizationId] });
      await cache.invalidateQueries({ queryKey: ["activity_logs", organizationId] });
      toast.success(
        result.created > 0
          ? `${result.created} prioridades por reglas guardadas · trace ${result.trace_id.slice(0, 8)}`
          : result.total >= 3
            ? "Ya hay tres prioridades para hoy."
            : "SIN DATOS: no hay nuevas prioridades accionables.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron generar prioridades");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      variant="outline"
      disabled={busy || !organizationId || !["CEO", "ADMIN", "OPERATOR"].includes(role ?? "")}
      onClick={onGenerate}
    >
      {busy ? "Guardando…" : "Generar prioridades operativas"}
    </Button>
  );
}
