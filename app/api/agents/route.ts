import { NextResponse } from 'next/server'

type AgentStatus = 'online' | 'offline' | 'degraded'

type Agent = {
  id: string
  name: string
  status: AgentStatus
  lastHeartbeat?: string
  capabilities?: string[]
}

type WorkerAgentResponse = {
  agents?: Agent[]
}

function readAgents(): Agent[] {
  const raw = process.env.AGENTS_JSON
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((agent): agent is Agent => {
      if (!agent || typeof agent !== 'object') return false
      const candidate = agent as Partial<Agent>
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.name === 'string' &&
        ['online', 'offline', 'degraded'].includes(candidate.status as string)
      )
    })
  } catch {
    return []
  }
}

async function readWorkerAgents(): Promise<Agent[] | null> {
  const workerUrl = process.env.AGENT_WORKER_URL
  const workerToken = process.env.AGENT_WORKER_TOKEN
  if (!workerUrl || !workerToken) return null

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/agents`, {
      headers: { Authorization: `Bearer ${workerToken}` },
      cache: 'no-store',
    })
    if (!response.ok) return null

    const payload = (await response.json()) as WorkerAgentResponse
    return Array.isArray(payload.agents) ? payload.agents : null
  } catch {
    return null
  }
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const agents = (await readWorkerAgents()) ?? readAgents()
  const online = agents.filter((agent) => agent.status === 'online').length

  return NextResponse.json(
    {
      agents,
      source: process.env.AGENT_WORKER_URL ? 'cloudflare-worker-or-fallback' : 'environment',
      summary: {
        total: agents.length,
        online,
        offline: agents.filter((agent) => agent.status === 'offline').length,
        degraded: agents.filter((agent) => agent.status === 'degraded').length,
        connected: agents.length > 0 && online === agents.length,
      },
      timestamp: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
