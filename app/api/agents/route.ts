import { NextResponse } from 'next/server'

type AgentStatus = 'online' | 'offline' | 'degraded'

type Agent = {
  id: string
  name: string
  status: AgentStatus
  lastHeartbeat?: string
  capabilities?: string[]
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

export const dynamic = 'force-dynamic'

export function GET() {
  const agents = readAgents()
  const online = agents.filter((agent) => agent.status === 'online').length

  return NextResponse.json({
    agents,
    summary: {
      total: agents.length,
      online,
      offline: agents.filter((agent) => agent.status === 'offline').length,
      degraded: agents.filter((agent) => agent.status === 'degraded').length,
      connected: agents.length > 0 && online === agents.length,
    },
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
