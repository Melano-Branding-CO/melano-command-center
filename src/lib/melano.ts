import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";

export type Org = Tables<"organizations">;
export type Agent = Tables<"agents">;
export type Task = Tables<"tasks">;
export type Decision = Tables<"decisions">;
export type Approval = Tables<"approvals">;
export type Meeting = Tables<"executive_meetings">;
export type AgentRun = Tables<"agent_runs">;
export type ActivityLog = Tables<"activity_logs">;
export type Alert = Tables<"alerts">;
export type Metric = Tables<"metrics">;
export type Product = Tables<"products">;
export type AutomationRule = Tables<"automation_rules">;
export type AppRole = Database["public"]["Enums"]["app_role"];

export const AUTONOMY_LEVELS: Record<number, string> = {
  0: "Manual",
  1: "Recomendación",
  2: "Ejecución asistida",
  3: "Autonomía en acciones de bajo riesgo",
  4: "Autonomía avanzada",
  5: "Autonomía operativa total",
};

export const PRIORITY_MEANING: Record<string, string> = {
  P0: "Producción, seguridad, cliente o revenue crítico",
  P1: "Ventas, cliente o lanzamiento",
  P2: "Escala, automatización o producto",
  P3: "Mejora futura",
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 30_000,
  });
}

export function useOrg() {
  return useQuery({
    queryKey: ["organization"],
    queryFn: async (): Promise<Org | null> => {
      const { data, error } = await supabase.from("organizations").select("*").limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useMyRole(orgId?: string) {
  return useQuery({
    queryKey: ["my-role", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !orgId) return null;
      const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data?.role ?? null;
    },
  });
}

export function useAgents(orgId?: string) {
  return useQuery({
    queryKey: ["agents", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", orgId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDay(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function agentMap(agents?: Agent[] | null) {
  const map = new Map<string, Agent>();
  (agents ?? []).forEach((a) => map.set(a.id, a));
  return map;
}
