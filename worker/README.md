# Cloudflare Agent Worker

The worker stores agent heartbeats in Cloudflare KV and executes only explicitly allowlisted tasks.

## Deploy

```bash
cd worker
pnpm install
npx wrangler login
npx wrangler kv namespace create AGENTS
npx wrangler kv namespace create TASKS
# Replace the two IDs in wrangler.toml
npx wrangler secret put AGENT_TOKEN
npx wrangler secret put TASK_SIGNING_SECRET
npx wrangler secret put TASKS_JSON
pnpm typecheck
pnpm deploy
```

`TASKS_JSON` example:

```json
[{"id":"refresh-leads","agentId":"sales-agent","url":"https://your-api.example.com/internal/tasks/refresh-leads","method":"POST","intervalSeconds":300,"enabled":true}]
```

## Heartbeat

```bash
curl -X POST https://YOUR_WORKER.workers.dev/heartbeat \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "content-type: application/json" \
  -d '{"id":"sales-agent","name":"Sales Agent","status":"online","capabilities":["lead-qualification"]}'
```

An agent expires after 120 seconds without a heartbeat. The dashboard reads `/agents` through `AGENT_WORKER_URL` and `AGENT_WORKER_TOKEN`.

## Dashboard environment variables

```env
AGENT_WORKER_URL=https://YOUR_WORKER.workers.dev
AGENT_WORKER_TOKEN=same-value-as-AGENT_TOKEN
```

The worker signs outbound task requests with `x-task-signature`. The receiving API must validate that HMAC before executing the task.
