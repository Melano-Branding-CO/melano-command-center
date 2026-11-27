export type RevenueClient = {
  id: string; organization_id: string; name: string; status: string; currency: string;
  mrr: number; is_demo: boolean; next_action: string | null; next_follow_up_at: string | null;
};
export type RevenueLead = {
  id: string; organization_id: string; status: string; is_demo: boolean; next_follow_up_at: string | null;
};

// clients.status is unconstrained text: only an explicit ACTIVO is counted,
// never a prospect or a lead budget. This is recorded MRR, not proof of a contract/payment.
export function summarizeRevenue(clients: RevenueClient[], leads: RevenueLead[], organizationId: string, now: string) {
  const rows = clients.filter(c => c.organization_id === organizationId && !c.is_demo);
  const active = rows.filter(c => c.status === "ACTIVO");
  const currencies = [...new Set(rows.map(c => c.currency))].sort();
  const money = currencies.map(currency => {
    const mrr = active.filter(c => c.currency === currency).reduce((total, c) => total + (Number.isFinite(c.mrr) && c.mrr > 0 ? c.mrr : 0), 0);
    return { currency, mrr, arr: mrr * 12 };
  });
  return {
    money,
    activeClients: active.length,
    prospects: rows.filter(c => c.status === "PROSPECTO").length,
    clientsWithoutAction: rows.filter(c => ["ACTIVO", "PROSPECTO"].includes(c.status) && !c.next_action?.trim()).length,
    pendingFollowups: leads.filter(l => l.organization_id === organizationId && !l.is_demo && !["GANADO", "PERDIDO", "DESCARTADO"].includes(l.status) && l.next_follow_up_at && l.next_follow_up_at <= now).length,
    margin: null, payments: null, profitability: null,
  };
}