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

function formatDuration(seconds: number) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}m ${s}s` : `${m}m`
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC'
}

function confidenceColor(c: string) {
  switch (c?.toUpperCase()) {
    case 'HIGH':   return 'bg-red-50 text-red-700 border-red-200'
    case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200'
    default:       return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

const PHASE_META: Record<string, { label: string; icon: string; color: string }> = {
  phase1_data:     { label: 'Data Analysis Agent',     icon: '📊', color: 'border-cyan-200 bg-cyan-50' },
  phase1_manual:   { label: 'Manual Agent (Phase 1)',  icon: '📖', color: 'border-indigo-200 bg-indigo-50' },
  phase1_pms:      { label: 'PMS Agent',               icon: '🔧', color: 'border-amber-200 bg-amber-50' },
  phase1_casefile: { label: 'Casefile Agent',          icon: '🗂️', color: 'border-purple-200 bg-purple-50' },
  synthesis:       { label: 'IOT Manager — Synthesis', icon: '🧠', color: 'border-emerald-200 bg-emerald-50' },
  phase2_manual:   { label: 'Manual Agent (Phase 2)',  icon: '📋', color: 'border-indigo-200 bg-indigo-50' },
  report:          { label: 'Report & Email Agent',    icon: '✉️', color: 'border-slate-200 bg-slate-50' },
}

// ─── HTML Report Generator ────────────────────────────────────────────────────

function buildHtmlReport(inv: Investigation): string {
  const urgencyColor = inv.urgency === 'IMMEDIATE' ? '#dc2626' : '#ea580c'
  const alertRows = (inv.alerts_detail ?? []).map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${a.parameter}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">
        <span style="background:${a.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb'};color:${a.severity === 'CRITICAL' ? '#b91c1c' : '#b45309'};border:1px solid ${a.severity === 'CRITICAL' ? '#fecaca' : '#fde68a'};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${a.severity}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#0f172a">${a.current_value} ${a.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${a.threshold_value} ${a.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${a.deviation_pct > 0 ? '#16a34a' : '#dc2626'};font-weight:600">${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#94a3b8;font-family:monospace">${a.alert_type}</td>
    </tr>`).join('')

  const causeItems = (inv.confirmed_causes ?? []).map(c => `
    <div style="display:flex;gap:12px;padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:10px">
      <span style="background:${c.confidence === 'HIGH' ? '#fef2f2' : '#fffbeb'};color:${c.confidence === 'HIGH' ? '#b91c1c' : '#b45309'};border:1px solid ${c.confidence === 'HIGH' ? '#fecaca' : '#fde68a'};padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;height:fit-content;white-space:nowrap">${c.confidence}</span>
      <div>
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1e293b">${c.cause}</p>
        <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6">${c.evidence_summary}</p>
      </div>
    </div>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BWTS Investigation Report — ${inv.investigation_id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; background: #f8fafc; color: #1e293b; }
    h1 { margin: 0 0 4px; font-size: 24px; font-weight: 300; color: #0f172a; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; font-weight: 600; margin: 28px 0 10px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    th { text-align: left; padding: 10px 12px; background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div style="background:${urgencyColor};color:white;padding:8px 16px;border-radius:8px;display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;margin-bottom:12px">${inv.urgency}</div>
  <h1>BWTS Investigation Report</h1>
  <p style="color:#64748b;margin:4px 0 24px;font-size:14px">
    ${inv.investigation_id} &nbsp;·&nbsp; ${inv.vessel_name} &nbsp;·&nbsp;
    ${formatDateShort(inv.started_at)} ${formatTime(inv.started_at)} — ${formatTime(inv.completed_at)}
    &nbsp;·&nbsp; ${formatDuration(inv.duration_seconds)}
  </p>

  <h2>Alerts Received (${inv.alert_count} total)</h2>
  <table>
    <thead>
      <tr>
        <th>Parameter</th><th>Severity</th><th>Current</th><th>Threshold</th><th>Deviation</th><th>Type</th>
      </tr>
    </thead>
    <tbody>${alertRows}</tbody>
  </table>

  <h2>Confirmed Root Causes</h2>
  ${causeItems}

  <h2>Synthesis</h2>
  <div class="card"><p style="margin:0;font-size:13px;line-height:1.7;color:#475569">${inv.synthesis_summary ?? '—'}</p></div>

  <h2>Remediation Plan</h2>
  <div class="card"><p style="margin:0;font-size:13px;line-height:1.7;color:#475569">${inv.remediation_summary ?? '—'}</p></div>

  ${inv.casefile_summary ? `<h2>Case History</h2>
  <div class="card"><p style="margin:0;font-size:13px;line-height:1.7;color:#475569">${inv.casefile_summary}</p></div>` : ''}

  <p style="margin-top:32px;font-size:11px;color:#cbd5e1;text-align:center">
    Generated by BWTS Agent System · ${formatDateShort(inv.email_sent_at)} ${formatTime(inv.email_sent_at)}
  </p>
</body>
</html>`
}

// ─── HTML Report Drawer ───────────────────────────────────────────────────────

function ReportDrawer({ inv, onClose }: { inv: Investigation; onClose: () => void }) {
  const html = buildHtmlReport(inv)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-[680px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col"
        style={{ animation: 'slideIn 0.22s ease-out' }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Diagnostic Report</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{inv.investigation_id} — {inv.vessel_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Report iframe */}
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title={`Report ${inv.investigation_id}`}
        />
      </div>
    </>
  )
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase, isParallel }: { phase: AgentPhase; isParallel: boolean }) {
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const meta = PHASE_META[phase.phase] ?? { label: phase.agent_name, icon: '⚙️', color: 'border-slate-200 bg-white' }
  const dur = phase.duration_seconds != null ? formatDuration(phase.duration_seconds) : null

  return (
    <div className={`rounded-xl border ${meta.color} px-4 py-3 ${isParallel ? 'flex-1 min-w-0' : 'w-full'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm leading-none shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{phase.agent_name}</p>
            {dur && <p className="text-[10px] text-slate-400 mt-0.5">{dur}</p>}
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />done
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">{phase.findings_summary}</p>
      {phase.thinking && (
        <button
          onClick={() => setThinkingOpen(o => !o)}
          className="mt-2 text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
        >
          <span>{thinkingOpen ? '▾' : '▸'}</span>Agent thinking
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

// ─── Phase Timeline ───────────────────────────────────────────────────────────

function PhaseTimeline({ phases }: { phases: AgentPhase[] }) {
  const phase1 = phases.filter(p => p.phase.startsWith('phase1_'))
  const synthesis   = phases.find(p => p.phase === 'synthesis')
  const phase2Manual = phases.find(p => p.phase === 'phase2_manual')
  const report      = phases.find(p => p.phase === 'report')

  return (
    <div className="space-y-3">
      {phase1.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Phase 1 — Parallel Investigation
          </p>
          <div className="flex gap-2 flex-wrap">{phase1.map(p => <PhaseCard key={p.id} phase={p} isParallel />)}</div>
        </div>
      )}
      {phase1.length > 0 && synthesis && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-slate-300" />
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}
      {synthesis && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Synthesis</p>
          <PhaseCard phase={synthesis} isParallel={false} />
        </div>
      )}
      {synthesis && phase2Manual && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-slate-300" />
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}
      {phase2Manual && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Phase 2 — Remediation Lookup</p>
          <PhaseCard phase={phase2Manual} isParallel={false} />
        </div>
      )}
      {phase2Manual && report && (
        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-slate-300" />
            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}
      {report && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Report & Delivery</p>
          <PhaseCard phase={report} isParallel={false} />
        </div>
      )}
    </div>
  )
}

// ─── Investigation Card ───────────────────────────────────────────────────────

function InvestigationCard({ inv }: { inv: Investigation }) {
  const [expanded, setExpanded]       = useState(false)
  const [phases, setPhases]           = useState<AgentPhase[] | null>(null)
  const [phasesLoading, setPhasesLoading] = useState(false)
  const [reportOpen, setReportOpen]   = useState(false)

  const critCount = inv.severities?.CRITICAL ?? 0
  const warnCount = inv.severities?.WARNING  ?? 0

  const isImmediate = inv.urgency?.toUpperCase() === 'IMMEDIATE'
  const urgencyBg   = isImmediate ? 'bg-red-600' : 'bg-orange-500'
  const cardBorder  = isImmediate ? 'border-red-100' : 'border-slate-200'

  const handleExpand = useCallback(async () => {
    const next = !expanded
    setExpanded(next)
    if (next && phases === null) {
      setPhasesLoading(true)
      try {
        const res  = await fetch(`/api/agent/investigations/${inv.investigation_id}/phases`)
        const data = await res.json()
        setPhases(data)
      } catch { setPhases([]) }
      finally  { setPhasesLoading(false) }
    }
  }, [expanded, phases, inv.investigation_id])

  return (
    <>
      {reportOpen && <ReportDrawer inv={inv} onClose={() => setReportOpen(false)} />}

      <div className={`rounded-2xl border ${cardBorder} bg-white/70 shadow-sm overflow-hidden transition-shadow hover:shadow-md`}>

        {/* ── Collapsed header ─────────────────────────────────────────── */}
        <button
          onClick={handleExpand}
          className="w-full text-left px-5 py-3.5 flex items-center gap-4 min-w-0"
        >
          {/* Date / time / vessel */}
          <div className="shrink-0 min-w-[130px]">
            <p className="text-sm font-semibold text-slate-800 leading-tight">{formatDateShort(inv.started_at)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{formatTime(inv.started_at)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[150px]">{inv.vessel_name}</p>
          </div>

          <div className="w-px h-10 bg-slate-100 shrink-0" />

          {/* Urgency */}
          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full text-white ${urgencyBg}`}>
            {inv.urgency}
          </span>

          <div className="w-px h-10 bg-slate-100 shrink-0" />

          {/* Alert pills */}
          <div className="flex items-center gap-2 shrink-0">
            {critCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-red-50 border-red-200 text-red-700 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{critCount} CRITICAL
              </span>
            )}
            {warnCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{warnCount} WARNING
              </span>
            )}
          </div>

          <div className="w-px h-10 bg-slate-100 shrink-0" />

          {/* Duration */}
          <div className="shrink-0 text-center min-w-[56px]">
            <p className="text-sm font-semibold text-slate-700">{formatDuration(inv.duration_seconds)}</p>
            <p className="text-[10px] text-slate-400">duration</p>
          </div>

          {/* Email sent */}
          {inv.email_sent_at && (
            <>
              <div className="w-px h-10 bg-slate-100 shrink-0" />
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✉️ Email sent
              </span>
            </>
          )}

          {/* Recurrence */}
          {inv.recurrence?.is_recurring && (
            <>
              <div className="w-px h-10 bg-slate-100 shrink-0" />
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                🔁 #{inv.recurrence.count}
              </span>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Investigation ID — subtle, at the right */}
          <span className="shrink-0 font-mono text-xs text-slate-300 font-medium tracking-tight">
            {inv.investigation_id}
          </span>

          {/* Chevron */}
          <div
            className="shrink-0 w-7 h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* ── Expanded content ─────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-slate-100 bg-white/50">

            {/* ── 1. INPUT — Alerts received ────────────────────────── */}
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Input</span>
                <span className="text-[10px] text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">Alerts received by monitoring agent</span>
              </div>

              <div className="rounded-xl border border-slate-100 overflow-hidden bg-white">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Parameter</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Severity</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Current</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Threshold</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Deviation</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inv.alerts_detail ?? []).map((alert, i) => (
                      <tr key={alert.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{alert.parameter}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-400'}`} />
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{alert.current_value} <span className="text-slate-400 font-normal">{alert.unit}</span></td>
                        <td className="px-4 py-2.5 text-slate-500">{alert.threshold_value} <span className="text-slate-400">{alert.unit}</span></td>
                        <td className={`px-4 py-2.5 font-semibold ${alert.deviation_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {alert.deviation_pct > 0 ? '+' : ''}{alert.deviation_pct}%
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">{alert.alert_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detected at */}
              <p className="mt-2 text-[10px] text-slate-400">
                Detected at {formatDateShort(inv.started_at)} · {formatTime(inv.started_at)}
                {inv.recurrence?.is_recurring && inv.recurrence.prior_investigation_ids?.length
                  ? ` · 🔁 Recurrence — prior: ${inv.recurrence.prior_investigation_ids.join(', ')}`
                  : ''}
              </p>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-dashed border-slate-100" />

            {/* ── 2. OUTPUT — Email sent + Report attachment ────────── */}
            <div className="px-6 pt-4 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Output</span>
                <span className="text-[10px] text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">Email sent by agent</span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4">
                {/* Email meta row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subject</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{inv.email_subject}</p>
                    {inv.email_sent_at && (
                      <p className="text-[11px] text-emerald-600 mt-1">
                        ✅ Sent {formatDateShort(inv.email_sent_at)} · {formatTime(inv.email_sent_at)}
                      </p>
                    )}
                  </div>

                  {/* Report attachment chip */}
                  <button
                    onClick={() => setReportOpen(true)}
                    className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-colors group"
                  >
                    <div className="w-8 h-10 rounded-md bg-red-500 flex items-center justify-center shrink-0">
                      <span className="text-white text-[8px] font-bold">HTML</span>
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900">Diagnostic Report</p>
                      <p className="text-[10px] text-slate-400">{inv.investigation_id}.html</p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Email body */}
                {inv.email_narrative && (
                  <div className="mt-3 pt-3 border-t border-slate-50">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Message</p>
                    <pre className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">
                      {inv.email_narrative}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-dashed border-slate-100" />

            {/* ── 3. AGENT WORK — phases, causes, synthesis ─────────── */}
            <div className="px-6 pt-4 pb-6 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agent Work</span>
                <span className="text-[10px] text-slate-300">·</span>
                <span className="text-[10px] text-slate-400">How the investigation was conducted</span>
              </div>

              {/* Phase timeline */}
              {phasesLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                  Loading agent phases…
                </div>
              ) : phases && phases.length > 0 ? (
                <PhaseTimeline phases={phases} />
              ) : (
                <p className="text-sm text-slate-400 italic">No phase data available.</p>
              )}

              {/* Root causes */}
              {inv.confirmed_causes?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirmed Root Causes</p>
                  <div className="space-y-2">
                    {inv.confirmed_causes.map((cause, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inv.synthesis_summary && (
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">🧠 Synthesis</p>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{inv.synthesis_summary}</p>
                  </div>
                )}
                {inv.remediation_summary && (
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100">
                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1.5">📋 Remediation</p>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{inv.remediation_summary}</p>
                  </div>
                )}
              </div>

              {/* Case history */}
              {inv.casefile_summary && (
                <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-100">
                  <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-1">🗂️ Case History</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{inv.casefile_summary}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AgentInvestigations() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agent/investigations')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setInvestigations)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const totalAlerts  = investigations.reduce((s, i) => s + i.alert_count, 0)
  const totalCrit    = investigations.reduce((s, i) => s + (i.severities?.CRITICAL ?? 0), 0)
  const emailsSent   = investigations.filter(i => i.email_sent_at).length

  return (
    <div
      className="min-h-screen px-6 pt-6 pb-12"
      style={{ background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-light text-slate-800 tracking-tight">Agent Investigation Log</h2>
          <p className="text-sm text-slate-500 mt-1">Autonomous monitoring cycles · Root cause analysis · Remediation reports</p>
        </div>
        {!loading && investigations.length > 0 && (
          <div className="flex items-center gap-5 text-right">
            {[
              { val: investigations.length, label: 'Investigations', color: 'text-slate-800' },
              { val: totalCrit,             label: 'Critical alerts', color: 'text-red-600' },
              { val: totalAlerts,           label: 'Total alerts',    color: 'text-slate-800' },
              { val: emailsSent,            label: 'Emails sent',     color: 'text-emerald-600' },
            ].map(({ val, label, color }, i, arr) => (
              <div key={label} className="flex items-center gap-5">
                <div>
                  <p className={`text-2xl font-light ${color}`}>{val}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-slate-200" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Loading investigations…
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">⚠️ {error}</div>
      )}
      {!loading && !error && investigations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
          <span className="text-4xl">🤖</span>
          <p className="text-sm">No investigations logged yet.</p>
        </div>
      )}
      {!loading && !error && investigations.length > 0 && (
        <div className="space-y-3 max-w-5xl">
          {investigations.map(inv => <InvestigationCard key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  )
}
