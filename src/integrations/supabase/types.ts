export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_agent: string | null
          actor_type: string
          actor_user: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          trace_id: string | null
        }
        Insert: {
          action: string
          actor_agent?: string | null
          actor_type?: string
          actor_user?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          trace_id?: string | null
        }
        Update: {
          action?: string
          actor_agent?: string | null
          actor_type?: string
          actor_user?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_agent_fkey"
            columns: ["actor_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          agent_id: string
          allowed: boolean
          created_at: string
          id: string
          organization_id: string
          permission: string
          requires_approval: boolean
        }
        Insert: {
          agent_id: string
          allowed?: boolean
          created_at?: string
          id?: string
          organization_id: string
          permission: string
          requires_approval?: boolean
        }
        Update: {
          agent_id?: string
          allowed?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          permission?: string
          requires_approval?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          error: string | null
          estimated_cost: number | null
          finished_at: string | null
          id: string
          input: Json | null
          meeting_id: string | null
          organization_id: string
          output: Json | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          task_id: string | null
          tokens: number | null
          tools_used: Json
          trace_id: string | null
          trigger: Database["public"]["Enums"]["trigger_type"]
        }
        Insert: {
          agent_id: string
          error?: string | null
          estimated_cost?: number | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          meeting_id?: string | null
          organization_id: string
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          task_id?: string | null
          tokens?: number | null
          tools_used?: Json
          trace_id?: string | null
          trigger?: Database["public"]["Enums"]["trigger_type"]
        }
        Update: {
          agent_id?: string
          error?: string | null
          estimated_cost?: number | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          meeting_id?: string | null
          organization_id?: string
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          task_id?: string | null
          tokens?: number | null
          tools_used?: Json
          trace_id?: string | null
          trigger?: Database["public"]["Enums"]["trigger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "executive_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          agent_id: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          organization_id: string
          tool_name: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          organization_id: string
          tool_name: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          organization_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          code: string
          confidence: number
          context: string | null
          created_at: string
          dependencies: Json
          enabled: boolean
          execution_loop: string | null
          execution_mode: Database["public"]["Enums"]["execution_mode"]
          failure_handling: string | null
          id: string
          is_demo: boolean
          last_error: string | null
          last_result: string | null
          last_run_at: string | null
          measurable_outcome: string | null
          name: string
          next_run_at: string | null
          objective: string
          observability: string | null
          organization_id: string
          permissions: Json
          role: string
          sort_order: number
          status: Database["public"]["Enums"]["agent_status"]
          stop_conditions: string | null
          system_prompt: string
          tools: Json
          updated_at: string
        }
        Insert: {
          code: string
          confidence?: number
          context?: string | null
          created_at?: string
          dependencies?: Json
          enabled?: boolean
          execution_loop?: string | null
          execution_mode?: Database["public"]["Enums"]["execution_mode"]
          failure_handling?: string | null
          id?: string
          is_demo?: boolean
          last_error?: string | null
          last_result?: string | null
          last_run_at?: string | null
          measurable_outcome?: string | null
          name: string
          next_run_at?: string | null
          objective: string
          observability?: string | null
          organization_id: string
          permissions?: Json
          role: string
          sort_order?: number
          status?: Database["public"]["Enums"]["agent_status"]
          stop_conditions?: string | null
          system_prompt: string
          tools?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          confidence?: number
          context?: string | null
          created_at?: string
          dependencies?: Json
          enabled?: boolean
          execution_loop?: string | null
          execution_mode?: Database["public"]["Enums"]["execution_mode"]
          failure_handling?: string | null
          id?: string
          is_demo?: boolean
          last_error?: string | null
          last_result?: string | null
          last_run_at?: string | null
          measurable_outcome?: string | null
          name?: string
          next_run_at?: string | null
          objective?: string
          observability?: string | null
          organization_id?: string
          permissions?: Json
          role?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["agent_status"]
          stop_conditions?: string | null
          system_prompt?: string
          tools?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          message: string | null
          organization_id: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          source_agent: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          message?: string | null
          organization_id: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          source_agent?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          message?: string | null
          organization_id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          source_agent?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_source_agent_fkey"
            columns: ["source_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          action: string
          agent_id: string | null
          category: string
          decided_at: string | null
          decided_by: string | null
          decision_id: string | null
          decision_note: string | null
          evidence: Json
          id: string
          impact: string | null
          is_demo: boolean
          organization_id: string
          payload: Json
          reason: string | null
          requested_at: string
          risk: string | null
          status: Database["public"]["Enums"]["approval_status"]
          task_id: string | null
          trace_id: string | null
        }
        Insert: {
          action: string
          agent_id?: string | null
          category?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_id?: string | null
          decision_note?: string | null
          evidence?: Json
          id?: string
          impact?: string | null
          is_demo?: boolean
          organization_id: string
          payload?: Json
          reason?: string | null
          requested_at?: string
          risk?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          task_id?: string | null
          trace_id?: string | null
        }
        Update: {
          action?: string
          agent_id?: string | null
          category?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_id?: string | null
          decision_note?: string | null
          evidence?: Json
          id?: string
          impact?: string | null
          is_demo?: boolean
          organization_id?: string
          payload?: Json
          reason?: string | null
          requested_at?: string
          risk?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          task_id?: string | null
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: string
          agent_id: string | null
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          is_demo: boolean
          last_error: string | null
          last_result: string | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          schedule_expression: string | null
          status: string
          trigger: Database["public"]["Enums"]["trigger_type"]
          updated_at: string
        }
        Insert: {
          action: string
          agent_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_demo?: boolean
          last_error?: string | null
          last_result?: string | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id: string
          schedule_expression?: string | null
          status?: string
          trigger?: Database["public"]["Enums"]["trigger_type"]
          updated_at?: string
        }
        Update: {
          action?: string
          agent_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_demo?: boolean
          last_error?: string | null
          last_result?: string | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          schedule_expression?: string | null
          status?: string
          trigger?: Database["public"]["Enums"]["trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          organization_id: string
          output: string | null
          rule_id: string
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          trace_id: string | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          organization_id: string
          output?: string | null
          rule_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          trace_id?: string | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          organization_id?: string
          output?: string | null
          rule_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_evidence: {
        Row: {
          content: string | null
          created_at: string
          decision_id: string
          id: string
          kind: string
          label: string
          organization_id: string
          source: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          decision_id: string
          id?: string
          kind?: string
          label: string
          organization_id: string
          source?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          decision_id?: string
          id?: string
          kind?: string
          label?: string
          organization_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_evidence_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          analysis: string | null
          approved_at: string | null
          approved_by: string | null
          confidence: number
          created_at: string
          description: string | null
          evidence: Json
          expected_impact: string | null
          id: string
          is_demo: boolean
          meeting_id: string | null
          organization_id: string
          outcome: string | null
          outcome_at: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          reasoning_summary: string | null
          requires_approval: boolean
          risk: string | null
          signal: string | null
          source_agent: string | null
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          analysis?: string | null
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          evidence?: Json
          expected_impact?: string | null
          id?: string
          is_demo?: boolean
          meeting_id?: string | null
          organization_id: string
          outcome?: string | null
          outcome_at?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          reasoning_summary?: string | null
          requires_approval?: boolean
          risk?: string | null
          signal?: string | null
          source_agent?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: string | null
          approved_at?: string | null
          approved_by?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          evidence?: Json
          expected_impact?: string | null
          id?: string
          is_demo?: boolean
          meeting_id?: string | null
          organization_id?: string
          outcome?: string | null
          outcome_at?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          reasoning_summary?: string | null
          requires_approval?: boolean
          risk?: string | null
          signal?: string | null
          source_agent?: string | null
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "executive_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_source_agent_fkey"
            columns: ["source_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_meetings: {
        Row: {
          created_at: string
          error: string | null
          executive_brief: Json | null
          finished_at: string | null
          id: string
          is_demo: boolean
          organization_id: string
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          summary: string | null
          title: string
          trace_id: string
          trigger: Database["public"]["Enums"]["trigger_type"]
        }
        Insert: {
          created_at?: string
          error?: string | null
          executive_brief?: Json | null
          finished_at?: string | null
          id?: string
          is_demo?: boolean
          organization_id: string
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          title: string
          trace_id?: string
          trigger?: Database["public"]["Enums"]["trigger_type"]
        }
        Update: {
          created_at?: string
          error?: string | null
          executive_brief?: Json | null
          finished_at?: string | null
          id?: string
          is_demo?: boolean
          organization_id?: string
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          title?: string
          trace_id?: string
          trigger?: Database["public"]["Enums"]["trigger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "executive_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_outputs: {
        Row: {
          agent_id: string
          changes: string | null
          created_at: string
          id: string
          meeting_id: string
          metrics: Json
          opportunities: string | null
          organization_id: string
          problems: string | null
          proposed_action: string | null
          raw: Json | null
          situation: string | null
        }
        Insert: {
          agent_id: string
          changes?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          metrics?: Json
          opportunities?: string | null
          organization_id: string
          problems?: string | null
          proposed_action?: string | null
          raw?: Json | null
          situation?: string | null
        }
        Update: {
          agent_id?: string
          changes?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          metrics?: Json
          opportunities?: string | null
          organization_id?: string
          problems?: string | null
          proposed_action?: string | null
          raw?: Json | null
          situation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_outputs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_outputs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "executive_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_outputs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          agent_id: string
          id: string
          joined_at: string
          meeting_id: string
          organization_id: string
          role_in_meeting: string | null
        }
        Insert: {
          agent_id: string
          id?: string
          joined_at?: string
          meeting_id: string
          organization_id: string
          role_in_meeting?: string | null
        }
        Update: {
          agent_id?: string
          id?: string
          joined_at?: string
          meeting_id?: string
          organization_id?: string
          role_in_meeting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "executive_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          captured_at: string
          category: string
          id: string
          is_demo: boolean
          key: string
          label: string
          organization_id: string
          source_agent: string | null
          unit: string | null
          value: number
        }
        Insert: {
          captured_at?: string
          category?: string
          id?: string
          is_demo?: boolean
          key: string
          label: string
          organization_id: string
          source_agent?: string | null
          unit?: string | null
          value?: number
        }
        Update: {
          captured_at?: string
          category?: string
          id?: string
          is_demo?: boolean
          key?: string
          label?: string
          organization_id?: string
          source_agent?: string | null
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_source_agent_fkey"
            columns: ["source_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          autonomy_level: number
          created_at: string
          id: string
          name: string
          slug: string
          system_health: Database["public"]["Enums"]["health_state"]
          tagline: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          autonomy_level?: number
          created_at?: string
          id?: string
          name: string
          slug: string
          system_health?: Database["public"]["Enums"]["health_state"]
          tagline?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          autonomy_level?: number
          created_at?: string
          id?: string
          name?: string
          slug?: string
          system_health?: Database["public"]["Enums"]["health_state"]
          tagline?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          roadmap: Json
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          roadmap?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          roadmap?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          organization_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          organization_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_agent: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_agent: string | null
          deadline: string | null
          decision_id: string | null
          description: string | null
          error: string | null
          execution_mode: Database["public"]["Enums"]["execution_mode"]
          id: string
          is_demo: boolean
          is_today_priority: boolean
          meeting_id: string | null
          next_action: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          product_id: string | null
          project_id: string | null
          requires_approval: boolean
          result: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          success_metric: string | null
          title: string
          today_date: string | null
          trace_id: string | null
          updated_at: string
          why_now: string | null
        }
        Insert: {
          assigned_agent?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_agent?: string | null
          deadline?: string | null
          decision_id?: string | null
          description?: string | null
          error?: string | null
          execution_mode?: Database["public"]["Enums"]["execution_mode"]
          id?: string
          is_demo?: boolean
          is_today_priority?: boolean
          meeting_id?: string | null
          next_action?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          product_id?: string | null
          project_id?: string | null
          requires_approval?: boolean
          result?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          success_metric?: string | null
          title: string
          today_date?: string | null
          trace_id?: string | null
          updated_at?: string
          why_now?: string | null
        }
        Update: {
          assigned_agent?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_agent?: string | null
          deadline?: string | null
          decision_id?: string | null
          description?: string | null
          error?: string | null
          execution_mode?: Database["public"]["Enums"]["execution_mode"]
          id?: string
          is_demo?: boolean
          is_today_priority?: boolean
          meeting_id?: string | null
          next_action?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          product_id?: string | null
          project_id?: string | null
          requires_approval?: boolean
          result?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          success_metric?: string | null
          title?: string
          today_date?: string | null
          trace_id?: string | null
          updated_at?: string
          why_now?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_agent_fkey"
            columns: ["assigned_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_agent_fkey"
            columns: ["created_by_agent"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "executive_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_admin: { Args: { _org: string }; Returns: boolean }
      can_write: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      org_role: {
        Args: { _org: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      agent_status: "ACTIVE" | "PAUSED" | "RUNNING" | "BLOCKED" | "ERROR"
      alert_severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
      app_role: "CEO" | "ADMIN" | "OPERATOR" | "VIEWER" | "AGENT"
      approval_status: "PENDING" | "APPROVED" | "REJECTED"
      decision_status:
        | "PROPOSED"
        | "APPROVED"
        | "REJECTED"
        | "EXECUTING"
        | "COMPLETED"
        | "FAILED"
      execution_mode: "MANUAL" | "ASSISTED" | "AUTONOMOUS" | "APPROVAL_REQUIRED"
      health_state: "GREEN" | "YELLOW" | "RED"
      meeting_status: "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED"
      priority_level: "P0" | "P1" | "P2" | "P3"
      run_status: "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED"
      task_status:
        | "BACKLOG"
        | "READY"
        | "RUNNING"
        | "BLOCKED"
        | "REVIEW"
        | "DONE"
        | "FAILED"
      trigger_type:
        | "schedule"
        | "database_event"
        | "webhook"
        | "manual"
        | "external_event"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["ACTIVE", "PAUSED", "RUNNING", "BLOCKED", "ERROR"],
      alert_severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"],
      app_role: ["CEO", "ADMIN", "OPERATOR", "VIEWER", "AGENT"],
      approval_status: ["PENDING", "APPROVED", "REJECTED"],
      decision_status: [
        "PROPOSED",
        "APPROVED",
        "REJECTED",
        "EXECUTING",
        "COMPLETED",
        "FAILED",
      ],
      execution_mode: ["MANUAL", "ASSISTED", "AUTONOMOUS", "APPROVAL_REQUIRED"],
      health_state: ["GREEN", "YELLOW", "RED"],
      meeting_status: ["SCHEDULED", "RUNNING", "COMPLETED", "FAILED"],
      priority_level: ["P0", "P1", "P2", "P3"],
      run_status: ["RUNNING", "SUCCESS", "FAILED", "SKIPPED"],
      task_status: [
        "BACKLOG",
        "READY",
        "RUNNING",
        "BLOCKED",
        "REVIEW",
        "DONE",
        "FAILED",
      ],
      trigger_type: [
        "schedule",
        "database_event",
        "webhook",
        "manual",
        "external_event",
      ],
    },
  },
} as const
