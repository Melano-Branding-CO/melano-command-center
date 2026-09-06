import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RowOpts = {
  order?: string;
  asc?: boolean;
  limit?: number;
  eq?: Record<string, string | boolean | number | null>;
};

const TABLE_MAP: Record<string, string> = {
  organizations: "tenants",
  organization_members: "tenant_members",
  executive_meetings: "meeting_runs",
  meeting_outputs: "agent_runs",
  activity_logs: "automation_logs",
  metrics: "kpi_snapshot",
  alerts: "critical_actions",
  automation_rules: "routing_rules",
  products: "luxia_health",
};

const COLUMN_MAP: Record<string, Record<string, string>> = {
  executive_meetings: {
    finished_at: "completed_at",
    trigger: "trigger_source",
    created_at: "created_at",
  },
  meeting_outputs: {
    meeting_id: "meeting_run_id",
  },
  decisions: {
    meeting_id: "meeting_run_id",
    status: "state",
    created_at: "updated_at",
  },
  tasks: {
    meeting_id: "meeting_run_id",
    assigned_agent: "owner_agent_id",
    deadline: "due_at",
  },
  activity_logs: {
    meeting_id: "meeting_run_id",
  },
  metrics: {
    captured_at: "updated_at",
  },
  alerts: {
    created_at: "updated_at",
  },
  automation_rules: {
    created_at: "updated_at",
  },
};

const VIRTUAL_FIELDS: Record<string, Set<string>> = {
  tasks: new Set(["is_today_priority", "today_date"]),
  metrics: new Set(["category"]),
};

function mappedTable(table: string) {
  return TABLE_MAP[table] ?? table;
}

function mappedColumn(table: string, column: string) {
  return COLUMN_MAP[table]?.[column] ?? column;
}

function mappedValue(table: string, column: string, value: unknown) {
  if (typeof value !== "string") return value;
  if (table === "tasks" && column === "status") return value.toLowerCase();
  if (table === "approvals" && column === "status") return value.toLowerCase();
  if (table === "decisions" && column === "status") {
    if (value.toUpperCase() === "PROPOSED") return "pending";
    return value.toLowerCase();
  }
  if (table === "alerts" && column === "status") return value.toLowerCase();
  return value;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function inferMetricCategory(key: unknown, label: unknown) {
  const text = `${String(key ?? "")} ${String(label ?? "")}`.toLowerCase();
  return /(mrr|revenue|ingreso|caja|cash|cliente|ticket|pipeline)/.test(text) ? "revenue" : "general";
}

function normalizeRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  if (table === "executive_meetings") {
    const summaryObject = objectValue(row.summary);
    return {
      ...row,
      organization_id: row.tenant_id,
      title: summaryObject.title ?? "Reunión ejecutiva",
      trigger: row.trigger_source,
      finished_at: row.completed_at,
      executive_brief: row.summary,
      summary:
        typeof summaryObject.summary === "string"
          ? summaryObject.summary
          : typeof row.summary === "string"
            ? row.summary
            : null,
    };
  }

  if (table === "meeting_outputs") {
    const output = objectValue(row.output);
    return {
      ...row,
      organization_id: row.tenant_id,
      meeting_id: row.meeting_run_id,
      situation: output.situation ?? null,
      changes: output.changes ?? null,
      problems: output.problems ?? null,
      opportunities: output.opportunities ?? null,
      metrics: output.metrics ?? {},
      proposed_action: output.proposed_action ?? null,
      raw: row.output,
      created_at: row.created_at ?? row.started_at,
    };
  }

  if (table === "tasks") {
    const payload = objectValue(row.payload);
    return {
      ...row,
      organization_id: row.tenant_id,
      meeting_id: row.meeting_run_id,
      assigned_agent: row.owner_agent_id,
      deadline: row.due_at,
      why_now: payload.why_now ?? row.description ?? null,
      next_action: payload.next_action ?? null,
      success_metric: payload.success_metric ?? null,
      is_today_priority: payload.is_today_priority ?? false,
      today_date: payload.today_date ?? null,
    };
  }

  if (table === "decisions") {
    const fields = objectValue(row.fields);
    return {
      ...row,
      organization_id: row.tenant_id,
      meeting_id: row.meeting_run_id,
      status: row.state,
      description: fields.description ?? fields.rationale ?? null,
      reasoning_summary: fields.reasoning_summary ?? fields.rationale ?? null,
      expected_impact: fields.expected_impact ?? null,
      risk: row.risk_level ?? fields.risk ?? null,
      confidence: fields.confidence ?? null,
      source_agent: fields.source_agent ?? row.owner ?? null,
      requires_approval: row.approval_required,
      created_at: row.decided_at ?? row.updated_at,
    };
  }

  if (table === "approvals") {
    const metadata = objectValue(row.metadata);
    return {
      ...row,
      organization_id: row.tenant_id,
      action: metadata.action ?? row.action_type,
      category: metadata.category ?? row.action_type,
      impact: metadata.impact ?? null,
      risk: row.risk_level,
      agent_id: row.requested_by_agent,
      payload: metadata,
    };
  }

  if (table === "activity_logs") {
    return {
      ...row,
      organization_id: row.tenant_id,
      action: row.event_type,
      actor_agent: row.actor_type === "agent" ? row.actor_id : null,
      actor_user: row.actor_type === "human" ? row.actor_id : null,
      detail: row.payload,
    };
  }

  if (table === "metrics") {
    return {
      ...row,
      organization_id: row.tenant_id,
      id: row.key,
      category: inferMetricCategory(row.key, row.label),
      unit: null,
      captured_at: row.updated_at,
    };
  }

  if (table === "agents") {
    const name = String(row.name ?? "");
    const [label, role] = name.split(" — ");
    return {
      ...row,
      organization_id: row.tenant_id,
      code: String(row.id ?? label).replace(/^ag-/, "").toUpperCase(),
      role: role ?? label,
      status: row.state,
      enabled: row.state !== "PAUSED",
      sort_order: 0,
    };
  }

  if (table === "alerts") {
    return {
      ...row,
      organization_id: row.tenant_id,
      severity: row.priority,
      status: row.status ?? "open",
      created_at: row.updated_at,
    };
  }

  if (table === "automation_rules") {
    return {
      ...row,
      organization_id: row.tenant_id,
      name: row.title,
      status: row.state,
      next_run_at: null,
      created_at: row.updated_at,
    };
  }

  if (table === "products") {
    return {
      ...row,
      organization_id: row.tenant_id,
      code: "LUXIA",
      name: "LUXIA",
      priority: "P0",
    };
  }

  return { ...row, organization_id: row.tenant_id ?? row.organization_id };
}

function matchesVirtualFilters(
  table: string,
  row: Record<string, unknown>,
  filters: Record<string, string | boolean | number | null>,
) {
  return Object.entries(filters).every(([key, expected]) => row[key] === expected);
}

/**
 * Lectura genérica multi-tenant sobre el contrato canónico tenant_id.
 * Mantiene aliases de lectura para pantallas legacy mientras se completa el refactor.
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
      const physicalTable = mappedTable(table);
      let q = (supabase as unknown as { from: (t: string) => any })
        .from(physicalTable)
        .select("*")
        .eq("tenant_id", orgId);

      const virtualFilters: Record<string, string | boolean | number | null> = {};
      for (const [k, v] of Object.entries(opts.eq ?? {})) {
        if (VIRTUAL_FIELDS[table]?.has(k)) {
          virtualFilters[k] = v;
          continue;
        }
        const physicalColumn = mappedColumn(table, k);
        const physicalValue = mappedValue(table, k, v);
        q = physicalValue === null ? q.is(physicalColumn, null) : q.eq(physicalColumn, physicalValue);
      }
      if (opts.order) {
        q = q.order(mappedColumn(table, opts.order), { ascending: opts.asc ?? false });
      }
      if (opts.limit) q = q.limit(opts.limit);

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []).map((row: Record<string, unknown>) => normalizeRow(table, row));
      if (Object.keys(virtualFilters).length) {
        rows = rows.filter((row) => matchesVirtualFilters(table, row, virtualFilters));
      }
      return rows as T[];
    },
  });
}

export function useRowById<T = Record<string, unknown>>(table: string, id?: string) {
  return useQuery({
    queryKey: [table, "one", id],
    enabled: !!id,
    queryFn: async (): Promise<T | null> => {
      const physicalTable = mappedTable(table);
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from(physicalTable)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? (normalizeRow(table, data as Record<string, unknown>) as T) : null;
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
