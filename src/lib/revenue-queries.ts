import { useOrgRows } from "./melano-queries";
import { summarizeRevenue, type RevenueClient, type RevenueLead } from "./revenue-summary";

export function useCurrentRevenue(organizationId?: string) {
  const clients = useOrgRows<RevenueClient>("clients", organizationId, { order: "id", eq: { is_demo: false } });
  const leads = useOrgRows<RevenueLead>("leads", organizationId, { order: "id", eq: { is_demo: false } });
  return {
    summary: summarizeRevenue(clients.data ?? [], leads.data ?? [], organizationId ?? "", new Date().toISOString()),
    isLoading: clients.isLoading || leads.isLoading,
    error: clients.error || leads.error,
  };
}