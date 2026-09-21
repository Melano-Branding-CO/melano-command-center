import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const hasCommandCenterAuth = Boolean(
    process.env.COMMAND_CENTER_USER && process.env.COMMAND_CENTER_PASSWORD,
  )
  const hasAgentsRegistry = Boolean(process.env.AGENTS_JSON)
  const hasSupabase = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  const hasAiProvider = Boolean(
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  )

  return NextResponse.json({
    status: hasCommandCenterAuth ? 'ok' : 'misconfigured',
    service: 'melano-command-center',
    timestamp: new Date().toISOString(),
    integrations: {
      commandCenterAuth: hasCommandCenterAuth,
      agentsRegistry: hasAgentsRegistry,
      supabase: hasSupabase,
      aiProvider: hasAiProvider,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
