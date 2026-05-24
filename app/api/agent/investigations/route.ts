import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface Investigation {
  id: number
  investigation_id: string
  vessel_name: string
  alert_ids: number[]
  alert_count: number
  alerts_detail: AlertDetail[]
  severities: Record<string, number>
  status: string
  urgency: string
  started_at: string
  completed_at: string
  duration_seconds: number
  confirmed_causes: ConfirmedCause[]
  synthesis_summary: string
  remediation_summary: string
  casefile_summary: string
  email_subject: string
  email_narrative: string
  email_html_report: string | null
  email_sent_at: string
  recurrence: Recurrence
  created_at: string
}

export interface AlertDetail {
  id: number
  unit: string
  severity: string
  parameter: string
  alert_type: string
  current_value: number
  deviation_pct: number
  threshold_value: number
}

export interface ConfirmedCause {
  cause: string
  confidence: string
  evidence_summary: string
}

export interface Recurrence {
  count: number
  is_recurring: boolean
  prior_investigation_ids?: string[]
}

export async function GET() {
  try {
    const rows = await query<Investigation>(
      `SELECT * FROM bwts_agent_investigations ORDER BY created_at DESC`
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[agent/investigations] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch investigations' }, { status: 500 })
  }
}
