export type PrioritySource = {
  origin: string; title: string; why: string; action: string; metric: string;
  owner: string | null; deadline: string; path: "/leads" | "/clientes" | "/tasks";
};
export function selectPriorities(candidates: PrioritySource[], existingOrigins: string[], existingTodayCount: number) {
  const seen = new Set(existingOrigins);
  return candidates.filter(c => {
    if (seen.has(c.origin)) return false;
    seen.add(c.origin);
    return true;
  }).slice(0, Math.max(0, 3 - existingTodayCount));
}