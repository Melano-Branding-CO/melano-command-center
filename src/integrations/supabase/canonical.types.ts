export type CanonicalJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: CanonicalJson | undefined }
  | CanonicalJson[];

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
};

export type TenantMemberRow = {
  tenant_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

export type MeetingRunRow = {
  id: string;
  tenant_id: string;
  trace_id: string;
  idempotency_key: string | null;
  trigger_source: string;
  autonomy_level: number;
  status: string;
  scheduled_for: string | null;
  started_at: string;
  completed_at: string | null;
  top3_count: number;
  summary: CanonicalJson;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationLogRow = {
  id: number;
  tenant_id: string;
  trace_id: string;
  meeting_run_id: string | null;
  agent_run_id: string | null;
  task_id: string | null;
  decision_id: string | null;
  approval_id: string | null;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  status: string;
  message: string;
  payload: CanonicalJson;
  created_at: string;
};

export type ApprovalRow = {
  id: string;
  tenant_id: string;
  task_id: string | null;
  decision_id: string | null;
  trace_id: string;
  risk_level: string;
  action_type: string;
  reason: string;
  status: string;
  requested_by_agent: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string | null;
  metadata: CanonicalJson;
  created_at: string;
  updated_at: string;
};
