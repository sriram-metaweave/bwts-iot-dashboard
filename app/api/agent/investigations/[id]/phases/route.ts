import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface AgentPhase {
  id: number
  investigation_id: string
  phase: string
  agent_name: string
  status: string
  started_at: string
  completed_at: string
  duration_seconds: number | null
  findings_summary: string
  findings_detail: Record<string, unknown> | null
  thinking: string | null
  created_at: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rows = await query<AgentPhase>(
      `SELECT * FROM bwts_agent_phases WHERE investigation_id = $1 ORDER BY started_at ASC`,
      [id]
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[agent/phases] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch phases' }, { status: 500 })
  }
}
