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
 * Lectura genérica multi-tenant sobre las tablas físicas reales.
 * Todas las tablas operativas usan organization_id como clave de aislamiento.
 */
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
        .from(table)
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
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as T | null;
    },
  });
}

/** Refresca las queries cuando cambian las tablas en tiempo real. */
export function useRealtime(tables: string[]) {
  const qc = useQueryClient();
  const key = tables.join(",");
  useEffect(() => {
    const channel = supabase.channel(`melano-${key}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        qc.invalidateQueries({ queryKey: [table] });
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, qc]);
}
