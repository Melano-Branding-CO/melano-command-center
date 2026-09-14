import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/melano/shell";
import { AUTONOMY_LEVELS, useMyRole, useOrg } from "@/lib/melano";
import { clearDemoData, setAutonomyLevel } from "@/lib/melano.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MELANO INC" },
      { name: "description", content: "Nivel de autonomía, rol y limpieza de datos demo." },
      { property: "og:title", content: "Settings — MELANO INC" },
      { property: "og:description", content: "Configuración del sistema autónomo de MELANO INC." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: org } = useOrg();
  const { data: role } = useMyRole(org?.id);
  const qc = useQueryClient();
  const setLevel = useServerFn(setAutonomyLevel);
  const clearDemo = useServerFn(clearDemoData);
  const [busy, setBusy] = useState(false);

  async function changeLevel(level: number) {
    if (!org?.id) return;
    setBusy(true);
    try {
      await setLevel({ data: { organizationId: org.id, level } });
      toast.success(`Autonomía L${level}`);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar el nivel");
    } finally {
      setBusy(false);
    }
  }

  async function wipeDemo() {
    if (!org?.id) return;
    setBusy(true);
    try {
      await clearDemo({ data: { organizationId: org.id } });
      toast.success("Datos demo eliminados");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al limpiar datos demo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={`Organización: ${org?.name ?? "—"} · Rol: ${role ?? "—"}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Nivel de autonomía">
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
                  onClick={() => changeLevel(n)}
                  className="justify-start"
                >
                  L{level} · {label}
                </Button>
              );
            })}
          </div>
        </Panel>
        <Panel title="Datos demo">
          <p className="text-sm text-muted-foreground">
            Elimina todo registro marcado como demo. Sólo CEO o ADMIN.
          </p>
          <Button className="mt-3" variant="destructive" disabled={busy} onClick={wipeDemo}>
            Limpiar datos demo
          </Button>
        </Panel>
      </div>
    </>
  );
}
