import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { CANONICAL_TENANT_SLUG } from "@/lib/runtime-contract";

// Legacy UI types are kept temporarily while reads are normalized through the
// canonical tenant schema. The physical source of truth is tenants/tenant_id.
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
    queryKey: ["organization", CANONICAL_TENANT_SLUG],
    queryFn: async (): Promise<Org | null> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("slug", CANONICAL_TENANT_SLUG)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Org;

      // Fallback: la organización a la que pertenece el usuario autenticado.
      const { data: any1, error: e2 } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (e2) throw e2;
      return (any1 ?? null) as Org | null;
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
    queryFn: async (): Promise<Agent[]> => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("organization_id", orgId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Agent[];
    },
  });
}

/** Fecha operativa del día en la zona horaria de MELANO INC (Buenos Aires). */
export function todayKey(timeZone = "America/Argentina/Buenos_Aires") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
