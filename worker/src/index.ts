export interface Env {
  AGENTS: KVNamespace
  TASKS: KVNamespace
  AGENT_TOKEN: string
  TASK_SIGNING_SECRET: string
  TASKS_JSON?: string
}

type AgentStatus = 'online' | 'offline' | 'degraded'
type Agent = {
  id: string
  name: string
  status: AgentStatus
  lastHeartbeat: string
  capabilities: string[]
}
type TaskDefinition = {
  id: string
  agentId: string
  url: string
  method?: 'POST' | 'PUT'
  intervalSeconds?: number
  enabled?: boolean
}

const HEARTBEAT_TTL_SECONDS = 120
const encoder = new TextEncoder()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function authorized(request: Request, env: Env) {
  return request.headers.get('authorization') === `Bearer ${env.AGENT_TOKEN}`
}

async function getAgents(env: Env): Promise<Agent[]> {
  const list = await env.AGENTS.list({ prefix: 'agent:' })
  const values = await Promise.all(
    list.keys.map(async ({ name }) => env.AGENTS.get<Agent>(name, 'json')),
  )
  return values.filter((agent): agent is Agent => Boolean(agent))
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function runTask(task: TaskDefinition, env: Env) {
  const payload = JSON.stringify({ taskId: task.id, agentId: task.agentId, triggeredAt: new Date().toISOString() })
  const signature = await sign(payload, env.TASK_SIGNING_SECRET)
  const response = await fetch(task.url, {
    method: task.method ?? 'POST',
    headers: { 'content-type': 'application/json', 'x-task-signature': signature },
    body: payload,
  })
  await env.TASKS.put(`run:${task.id}`, JSON.stringify({ taskId: task.id, status: response.ok ? 'success' : 'failed', statusCode: response.status, completedAt: new Date().toISOString() }), { expirationTtl: 86400 })
  return response.ok
}

function tasks(env: Env): TaskDefinition[] {
  if (!env.TASKS_JSON) return []
  try {
    const parsed = JSON.parse(env.TASKS_JSON) as unknown
    return Array.isArray(parsed) ? parsed.filter((task): task is TaskDefinition => Boolean(task && typeof task === 'object' && typeof (task as TaskDefinition).id === 'string' && typeof (task as TaskDefinition).agentId === 'string' && typeof (task as TaskDefinition).url === 'string')) : []
  } catch {
    return []
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401)
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/agents') {
      return json({ agents: await getAgents(env), timestamp: new Date().toISOString() })
    }

    if (request.method === 'POST' && url.pathname === '/heartbeat') {
      const body = (await request.json().catch(() => null)) as Partial<Agent> | null
      if (!body?.id || !body.name) return json({ error: 'id and name are required' }, 400)
      const agent: Agent = { id: body.id, name: body.name, status: body.status ?? 'online', lastHeartbeat: new Date().toISOString(), capabilities: body.capabilities ?? [] }
      await env.AGENTS.put(`agent:${agent.id}`, JSON.stringify(agent), { expirationTtl: HEARTBEAT_TTL_SECONDS })
      return json({ ok: true, agent })
    }

    if (request.method === 'POST' && url.pathname === '/tasks/run') {
      const body = (await request.json().catch(() => null)) as { taskId?: string } | null
      const task = tasks(env).find((candidate) => candidate.id === body?.taskId && candidate.enabled !== false)
      if (!task) return json({ error: 'Task is not allowlisted' }, 404)
      return json({ ok: await runTask(task, env), taskId: task.id })
    }

    return json({ error: 'Not found' }, 404)
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    for (const task of tasks(env).filter((candidate) => candidate.enabled !== false && candidate.intervalSeconds)) {
      ctx.waitUntil(runTask(task, env))
    }
  },
}
