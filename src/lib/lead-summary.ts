export type SummaryLead = { phase: string; score: number | null; zone: string | null };
export type LeadBucket = { label: string; count: number };

export function priorityLabel(score: number | null | undefined) {
  const value = score ?? 0;
  return value >= 60 ? "Alta" : value >= 30 ? "Media" : "Baja";
}

export function summarizeLeads(leads: readonly SummaryLead[]) {
  const phases = [
    { key: "FASE_0_14", label: "0–14 días" },
    { key: "FASE_15_45", label: "15–45 días" },
    { key: "FASE_46_90", label: "46–90 días" },
  ].map(({ key, label }) => ({ label, count: leads.filter((lead) => lead.phase === key).length }));
  const priorities = ["Alta", "Media", "Baja"].map((label) => ({
    label, count: leads.filter((lead) => priorityLabel(lead.score) === label).length,
  }));
  const zoneCounts = new Map<string, number>();
  for (const lead of leads) {
    const zone = lead.zone?.trim() || "Sin zona";
    zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
  }
  const allZones = Array.from(zoneCounts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  const zones = allZones.slice(0, 5);
  const remainder = allZones.slice(5).reduce((sum, zone) => sum + zone.count, 0);
  if (remainder > 0) zones.push({ label: "Otras zonas", count: remainder });
  return { phases, priorities, zones, allZones };
}