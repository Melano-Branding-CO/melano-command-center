# Command Center — Source of Truth

Status: integration in progress on `feat/canonical-supabase-autonomy-l2`.

## Canonical surfaces

- Repository: `MELANOINC/melano-command-center`
- Supabase project: `melano-command-center`
- Supabase ref: `fotlgptsjnhmkgjgrzxv`
- Production domain target: `control.melanoinc.com`
- Temporary/current frontend origin: `melano-command-center.melanobruno.workers.dev`
- Autonomy: Level 2; critical actions require human approval.

## Deprecated integration

The Lovable-generated schema/config currently references the isolated Supabase project
`iuuzheclayeiytmxahdp`. It is not the operational source of truth and must not receive
new production data.

Do not switch `supabase/config.toml` or deployment environment variables directly until
the compatibility layer below is complete and verified in Preview.

## Schema reconciliation required

The frontend currently expects the Lovable model:

- `organizations`
- `executive_meetings`
- `activity_logs`
- organization-scoped foreign keys

The canonical backend currently exposes the MELANIA model:

- `tenants` / `tenant_members`
- `meeting_runs`
- `automation_logs`
- tenant-scoped RLS

Shared operational entities already present include:

- `agents`
- `agent_runs`
- `tasks`
- `decisions`
- `approvals`
- `profiles`

## Migration gate

The frontend may point to the canonical project only after all gates pass:

1. Auth user resolves to an authorized tenant and role.
2. Existing frontend reads are mapped to canonical tables/contracts.
3. All exposed tables have explicit grants and RLS policies.
4. Tenant A can execute the approved Level-2 flow.
5. Tenant B cannot read or mutate Tenant A data.
6. A real trace persists through:
   `meeting_run -> Top 3 -> task -> decision -> approval -> execution -> automation_log`.
7. Preview build, rendered QA, console checks, logout, logs and expected HTTP responses pass.

No production DNS or environment-variable change is authorized by this document.
