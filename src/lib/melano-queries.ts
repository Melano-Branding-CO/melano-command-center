import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RowOpts = {
  order?: string;
  asc?: boolean;
  limit?: number;
  eq?: Record<string, string | boolean | number | null>;
};

/**
 * El esquema físico de MELANO INC usa nombres lógicos directos y `organization_id`
 * como clave de aislamiento multi-tenant. No hay mapeo de tablas ni columnas.
 */
function mappedTable(table: string) {
  return table;
}


/** Lectura genérica multi-tenant sobre `organization_id`. */
export function useOrgRows<T = Record<string, unknown>>(
  table: string,
  orgId?: string,
  opts: RowOpts = {},
) {
  return useQuery({
    queryKey: [table, orgId, opts],
    enabled: !!orgId,
    queryFn: async (): Promise<T[]> => {
      let q = (supabase as unknown as { from: (t: string) => any })
        .from(mappedTable(table))
        .select("*")
        .eq("organization_id", orgId);

      for (const [k, v] of Object.entries(opts.eq ?? {})) {
        q = v === null ? q.is(k, null) : q.eq(k, v);
      }
      if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? false });
      if (opts.limit) q = q.limit(opts.limit);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useRowById<T = Record<string, unknown>>(table: string, id?: string) {
  return useQuery({
    queryKey: [table, "one", id],
    enabled: !!id,
    queryFn: async (): Promise<T | null> => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from(mappedTable(table))
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as T) ?? null;
    },
  });
}


/** Refresca las queries cuando cambian las tablas físicas en tiempo real. */
export function useRealtime(tables: string[]) {
  const qc = useQueryClient();
  const key = tables.join(",");
  useEffect(() => {
    const channel = supabase.channel(`melano-${key}`);
    for (const logicalTable of key.split(",")) {
      const table = mappedTable(logicalTable);
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        qc.invalidateQueries({ queryKey: [logicalTable] });
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, qc]);
}
