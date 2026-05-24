'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertDetail {
  id: number
  unit: string
  severity: string
  parameter: string
  alert_type: string
  current_value: number
  deviation_pct: number
  threshold_value: number
}

interface ConfirmedCause {
  cause: string
  confidence: string
  evidence_summary: string
}

interface Recurrence {
  count: number
  is_recurring: boolean
  prior_investigation_ids?: string[]
}

interface Investigation {
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
  email_sent_at: string
  recurrence: Recurrence
  created_at: string
}

interface AgentPhase {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC'
}

function formatDuration(seconds: number) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

function severityColor(sev: string) {
  switch (sev?.toUpperCase()) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200'
    case 'WARNING':  return 'bg-amber-100 text-amber-700 border-amber-200'
    default:         return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function urgencyStyle(urgency: string) {
  switch (urgency?.toUpperCase()) {
    case 'IMMEDIATE': return { bg: 'bg-red-50 border-red-200', badge: 'bg-red-600 text-white', dot: 'bg-red-500' }
    case 'HIGH':      return { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500 text-white', dot: 'bg-orange-400' }
    default:          return { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-500 text-white', dot: 'bg-slate-400' }
  }
}

function confidenceColor(c: string) {
  switch (c?.toUpperCase()) {
    case 'HIGH':   return 'bg-red-100 text-red-700 border-red-200'
    case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-200'
    default:       return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

// Phase display config
const PHASE_META: Record<string, { label: string; icon: string; color: string }> = {
  phase1_data:     { label: 'Data Analysis',    icon: '📊', color: 'border-cyan-300 bg-cyan-50' },
  phase1_manual:   { label: 'Manual Agent',     icon: '📖', color: 'border-indigo-300 bg-indigo-50' },
  phase1_pms:      { label: 'PMS Agent',        icon: '🔧', color: 'border-amber-300 bg-amber-50' },
  phase1_casefile: { label: 'Casefile Agent',   icon: '🗂️', color: 'border-purple-300 bg-purple-50' },
  synthesis:       { label: 'IOT Manager',      icon: '🧠', color: 'border-emerald-300 bg-emerald-50' },
  phase2_manual:   { label: 'Manual Agent',     icon: '📋', color: 'border-indigo-300 bg-indigo-50' },
  report:          { label: 'Report & Email',   icon: '✉️', color: 'border-slate-300 bg-slate-50' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseCard({ phase, isParallel }: { phase: AgentPhase; isParallel: boolean }) {
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const meta = PHASE_META[phase.phase] ?? { label: phase.phase, icon: '⚙️', color: 'border-slate-200 bg-white' }
  const dur = phase.duration_seconds != null ? formatDuration(phase.duration_seconds) : null

  return (
    <div className={`rounded-xl border ${meta.color} px-4 py-3 ${isParallel ? 'flex-1 min-w-0' : 'w-full'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{phase.agent_name}</p>
            {dur && (
              <p className="text-[10px] text-slate-400 mt-0.5">{dur}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          done
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">{phase.findings_summary}</p>

      {phase.thinking && (
        <button
          onClick={() => setThinkingOpen(o => !o)}
          className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          <span>{thinkingOpen ? '▾' : '▸'}</span>
          Agent thinking
        </button>
      )}
      {thinkingOpen && phase.thinking && (
        <p className="mt-1.5 text-[10px] text-slate-500 italic leading-relaxed pl-3 border-l-2 border-slate-200">
          {phase.thinking}
        </p>
      )}
    </div>
  )
}

function PhaseTimeline({ phases }: { phases: AgentPhase[] }) {
  // Group: phase1 group (parallel) → synthesis → phase2_manual → report
  const phase1 = phases.filter(p => p.phase.startsWith('phase1_'))
  const synthesis = phases.find(p => p.phase === 'synthesis')
  const phase2Manual = phases.find(p => p.phase === 'phase2_manual')
  const report = phases.find(p => p.phase === 'report')

  return (
    <div className="space-y-3">
      {/* Phase 1 — parallel agents */}
      {phase1.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Phase 1 — Parallel Investigation
          </p>
          <div className="flex gap-2 flex-wrap">
            {phase1.map(p => <PhaseCard key={p.id} phase={p} isParallel={true} />)}
          </div>
        </div>
      )}

      {/* Arrow */}
      {phase1.length > 0 && synthesis && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-slate-300" />
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}

      {/* Synthesis */}
      {synthesis && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Synthesis — Root Cause Confirmation
          </p>
          <PhaseCard phase={synthesis} isParallel={false} />
        </div>
      )}

      {/* Arrow */}
      {synthesis && phase2Manual && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-slate-300" />
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}

      {/* Phase 2 Manual */}
      {phase2Manual && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Phase 2 — Remediation Lookup
          </p>
          <PhaseCard phase={phase2Manual} isParallel={false} />
        </div>
      )}

      {/* Arrow */}
      {phase2Manual && report && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-slate-300" />
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}

      {/* Report */}
      {report && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Report & Delivery
          </p>
          <PhaseCard phase={report} isParallel={false} />
        </div>
      )}
    </div>
  )
}

function InvestigationCard({ inv }: { inv: Investigation }) {
  const [expanded, setExpanded] = useState(false)
  const [phases, setPhases] = useState<AgentPhase[] | null>(null)
  const [phasesLoading, setPhasesLoading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const style = urgencyStyle(inv.urgency)

  const handleExpand = useCallback(async () => {
    const next = !expanded
    setExpanded(next)
    if (next && phases === null) {
      setPhasesLoading(true)
      try {
        const res = await fetch(`/api/agent/investigations/${inv.investigation_id}/phases`)
        const data = await res.json()
        setPhases(data)
      } catch {
        setPhases([])
      } finally {
        setPhasesLoading(false)
      }
    }
  }, [expanded, phases, inv.investigation_id])

  const critCount = inv.severities?.CRITICAL ?? 0
  const warnCount = inv.severities?.WARNING ?? 0
  const startDate = new Date(inv.started_at)
  const dateLabel = startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeLabel = startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

  return (
    <div className={`rounded-2xl border ${style.bg} shadow-sm overflow-hidden transition-shadow hover:shadow-md`}>
      {/* ── Collapsed header (always visible, clickable) ── */}
      <button
        onClick={handleExpand}
        className="w-full text-left px-6 py-4 flex items-center gap-4"
      >
        {/* ID + urgency */}
        <div className="shrink-0 flex flex-col items-start gap-1.5">
          <span className="text-lg font-bold text-slate-800 font-mono tracking-tight">
            {inv.investigation_id}
          </span>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
            {inv.urgency}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-slate-200 shrink-0" />

        {/* Date + vessel */}
        <div className="min-w-0 shrink-0">
          <p className="text-sm font-medium text-slate-700">{dateLabel}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{timeLabel}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{inv.vessel_name}</p>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-slate-200 shrink-0" />

        {/* Alert counts */}
        <div className="flex items-center gap-2 shrink-0">
          {critCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-red-50 border-red-200 text-red-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              {critCount} CRITICAL
            </span>
          )}
          {warnCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {warnCount} WARNING
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-slate-200 shrink-0" />

        {/* Duration */}
        <div className="shrink-0 text-center">
          <p className="text-sm font-semibold text-slate-700">{formatDuration(inv.duration_seconds)}</p>
          <p className="text-[10px] text-slate-400">duration</p>
        </div>

        {/* Recurrence badge */}
        {inv.recurrence?.is_recurring && (
          <>
            <div className="w-px h-10 bg-slate-200 shrink-0" />
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-violet-100 text-violet-700 border border-violet-200">
                🔁 Recurrence #{inv.recurrence.count}
              </span>
            </div>
          </>
        )}

        {/* Email sent */}
        {inv.email_sent_at && (
          <>
            <div className="w-px h-10 bg-slate-200 shrink-0" />
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✉️ Email sent
              </span>
            </div>
          </>
        )}

        {/* Spacer + chevron */}
        <div className="flex-1" />
        <div
          className="shrink-0 w-7 h-7 rounded-full bg-white/70 border border-slate-200 flex items-center justify-center transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-6 bg-white/60">

          {/* Alerts triggered */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Alerts Triggered
            </h4>
            <div className="flex flex-wrap gap-2">
              {inv.alerts_detail?.map(alert => (
                <div key={alert.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${severityColor(alert.severity)}`}>
                  <span>{alert.parameter}</span>
                  <span className="opacity-60">·</span>
                  <span>{alert.current_value} {alert.unit}</span>
                  <span className="opacity-50">({alert.deviation_pct > 0 ? '+' : ''}{alert.deviation_pct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent phases */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Agent Workflow
            </h4>
            {phasesLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                Loading agent phases…
              </div>
            ) : phases && phases.length > 0 ? (
              <PhaseTimeline phases={phases} />
            ) : (
              <p className="text-sm text-slate-400 italic">No phase data available.</p>
            )}
          </div>

          {/* Root causes */}
          {inv.confirmed_causes?.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Confirmed Root Causes
              </h4>
              <div className="space-y-2">
                {inv.confirmed_causes.map((cause, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-slate-100">
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${confidenceColor(cause.confidence)}`}>
                      {cause.confidence}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{cause.cause}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{cause.evidence_summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synthesis + Remediation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inv.synthesis_summary && (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <h4 className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">
                  🧠 Synthesis
                </h4>
                <p className="text-[12px] text-slate-600 leading-relaxed">{inv.synthesis_summary}</p>
              </div>
            )}
            {inv.remediation_summary && (
              <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <h4 className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-1.5">
                  📋 Remediation
                </h4>
                <p className="text-[12px] text-slate-600 leading-relaxed">{inv.remediation_summary}</p>
              </div>
            )}
          </div>

          {/* Casefile / recurrence note */}
          {inv.casefile_summary && (
            <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-100">
              <h4 className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider mb-1">
                🗂️ Case History
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">{inv.casefile_summary}</p>
              {inv.recurrence?.prior_investigation_ids?.length && (
                <p className="mt-1 text-[10px] text-violet-500 font-medium">
                  Prior investigations: {inv.recurrence.prior_investigation_ids.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Email */}
          {inv.email_subject && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                    ✉️ Email Report
                  </h4>
                  <p className="text-xs font-medium text-slate-700">{inv.email_subject}</p>
                  {inv.email_sent_at && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      ✅ Sent {formatDate(inv.email_sent_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEmailOpen(o => !o)}
                  className="text-[11px] text-slate-400 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50 transition-colors shrink-0"
                >
                  {emailOpen ? 'Hide' : 'View message'}
                </button>
              </div>
              {emailOpen && inv.email_narrative && (
                <pre className="mt-3 text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-slate-100 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {inv.email_narrative}
                </pre>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentInvestigations() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/agent/investigations')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setInvestigations(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const totalAlerts = investigations.reduce((sum, i) => sum + i.alert_count, 0)
  const totalCritical = investigations.reduce((sum, i) => sum + (i.severities?.CRITICAL ?? 0), 0)
  const emailsSent = investigations.filter(i => i.email_sent_at).length

  return (
    <div
      className="min-h-screen px-6 pt-6 pb-12"
      style={{ background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)' }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-light text-slate-800 tracking-tight">
              Agent Investigation Log
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Autonomous monitoring cycles · Root cause analysis · Remediation reports
            </p>
          </div>
          {!loading && investigations.length > 0 && (
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-2xl font-light text-slate-800">{investigations.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Investigations</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-2xl font-light text-red-600">{totalCritical}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Critical alerts</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-2xl font-light text-slate-800">{totalAlerts}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Total alerts</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <p className="text-2xl font-light text-emerald-600">{emailsSent}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Emails sent</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Loading investigations…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && investigations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
          <span className="text-4xl">🤖</span>
          <p className="text-sm">No investigations logged yet.</p>
        </div>
      )}

      {/* Investigation cards */}
      {!loading && !error && investigations.length > 0 && (
        <div className="space-y-3 max-w-5xl">
          {investigations.map(inv => (
            <InvestigationCard key={inv.id} inv={inv} />
          ))}
        </div>
      )}
    </div>
  )
}
