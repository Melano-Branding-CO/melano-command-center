import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type QueryOptions = {
  order?: string;
  ascending?: boolean;
  limit?: number;
};

type CanonicalClient = {
  from: (table: string) => any;
};

export type CanonicalTenant = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  autonomy_level: number;
  system_health: "GREEN" | "YELLOW" | "RED";
  tagline: string | null;
  timezone: string;
  updated_at: string;
};

export function canonicalDb(): CanonicalClient {
  return supabase as unknown as CanonicalClient;
}

export function mapTenant(row: {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}): CanonicalTenant {
  return {
    ...row,
    autonomy_level: 2,
    system_health: "YELLOW",
    tagline: "AI. Automation. Impact.",
    timezone: "America/Argentina/Buenos_Aires",
    updated_at: row.created_at,
  };
}

export function useTenantRows<T>(
  table: "meeting_runs" | "automation_logs" | "approvals",
  tenantId?: string,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: ["canonical", table, tenantId, options],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<T[]> => {
      let query = canonicalDb().from(table).select("*").eq("tenant_id", tenantId!);
      if (options.order) {
        query = query.order(options.order, { ascending: options.ascending ?? false });
      }
      if (options.limit) query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}
