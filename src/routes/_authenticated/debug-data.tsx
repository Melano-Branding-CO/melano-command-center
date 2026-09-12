import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useOrg } from "@/lib/melano";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/debug-data")({
  component: DebugDataPage,
});

type TableQuery = {
  table: string;
  count?: number;
  samples?: Record<string, unknown>[];
  error?: string;
  loading?: boolean;
};

function DebugDataPage() {
  const { data: org } = useOrg();
  const [tables, setTables] = useState<TableQuery[]>([
    { table: "agents" },
    { table: "agent_runs" },
    { table: "activity_logs" },
    { table: "automation_rules" },
    { table: "automation_runs" },
    { table: "annual_goals" },
  ]);
  const [checking, setChecking] = useState(false);

  const checkAllTables = useCallback(async () => {
    if (!org?.id) return;
    setChecking(true);

    const results = await Promise.all(
      tables.map(async (t) => {
        try {
          // Get count
          const { count, error: countError } = await supabase
            .from(t.table)
            .select("*", { count: "exact", head: true })
            .eq("organization_id", org.id);

          if (countError) {
            return { ...t, error: countError.message };
          }

          // Get sample records
          const { data: samples, error: samplesError } = await supabase
            .from(t.table)
            .select("*")
            .eq("organization_id", org.id)
            .limit(2);

          if (samplesError) {
            return { ...t, count, error: samplesError.message };
          }

          return { ...t, count, samples: samples ?? [] };
        } catch (e) {
          return { ...t, error: String(e) };
        }
      }),
    );

    setTables(results);
    setChecking(false);
  }, [org?.id, tables]);

  useEffect(() => {
    checkAllTables();
  }, [checkAllTables]);

  if (!org?.id) {
    return <div className="p-8">Cargando organización...</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Debug Data — {org.name}</h1>
        <Button onClick={checkAllTables} disabled={checking}>
          {checking ? "Verificando..." : "Verificar Tablas"}
        </Button>
      </div>

      <div className="space-y-4">
        {tables.map((t) => (
          <div key={t.table} className="border rounded p-4">
            <h3 className="font-mono font-semibold mb-2">{t.table}</h3>

            {t.error ? (
              <div className="text-red-600 text-sm">Error: {t.error}</div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Registros encontrados: <strong>{t.count ?? 0}</strong>
                </div>

                {t.count === 0 ? (
                  <div className="text-sm text-yellow-600">
                    No hay registros en esta tabla para tu organización
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Ejemplos:</p>
                    <pre className="bg-slate-50 p-2 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(t.samples, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded text-sm text-blue-900">
        <h3 className="font-semibold mb-2">Interpretación:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Si ves "Registros encontrados: 0" en todas las tablas, probablemente no hay datos para
            esta org
          </li>
          <li>Si ves errores, hay un problema con las RLS policies</li>
          <li>Si ves datos, las RLS policies están funcionando correctamente</li>
        </ul>
      </div>
    </div>
  );
}
