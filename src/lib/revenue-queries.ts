import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { summarizeRevenue, type RevenueClient, type RevenueLead } from "./revenue-summary";

export function useCurrentRevenue(organizationId?: string) {
  const clients = useQuery({
    queryKey: ["clients", organizationId, "current-revenue"],
    enabled: !!organizationId,
    queryFn: () =>
      readAll<RevenueClient>(
        "clients",
        organizationId!,
        "id,organization_id,name,status,currency,mrr,is_demo,next_action,next_follow_up_at",
      ),
  });
  const leads = useQuery({
    queryKey: ["leads", organizationId, "current-revenue"],
    enabled: !!organizationId,
    queryFn: () =>
      readAll<RevenueLead>(
        "leads",
        organizationId!,
        "id,organization_id,status,is_demo,next_follow_up_at",
      ),
  });
  return {
    summary: summarizeRevenue(
      clients.data ?? [],
      leads.data ?? [],
      organizationId ?? "",
      new Date().toISOString(),
    ),
    isLoading: clients.isLoading || leads.isLoading,
    error: clients.error || leads.error,
  };
}

async function readAll<T>(
  table: "clients" | "leads",
  organizationId: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .eq("is_demo", false)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    const page = data as unknown as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
