'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'

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
  email_html_report: string | null
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

function formatDateTime(iso: string) {
  return formatDateShort(iso) + ' · ' + formatTime(iso)
}

function confidenceColor(c: string) {
  switch (c?.toUpperCase()) {
    case 'HIGH':   return 'bg-red-50 text-red-700 border-red-200'
    case 'MEDIUM': return 'bg-amber-50 text-amber-700 border-amber-200'
    default:       return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

const PHASE_META: Record<string, { icon: string; color: string }> = {
  phase1_data:     { icon: '📊', color: 'border-cyan-200 bg-cyan-50' },
  phase1_manual:   { icon: '📖', color: 'border-indigo-200 bg-indigo-50' },
  phase1_pms:      { icon: '🔧', color: 'border-amber-200 bg-amber-50' },
  phase1_casefile: { icon: '🗂️', color: 'border-purple-200 bg-purple-50' },
  synthesis:       { icon: '🧠', color: 'border-emerald-200 bg-emerald-50' },
  phase2_manual:   { icon: '📋', color: 'border-indigo-200 bg-indigo-50' },
  report:          { icon: '✉️', color: 'border-slate-200 bg-slate-50' },
}

// ─── Report Drawer — renders the exact HTML stored in email_html_report ────────

function ReportDrawer({ inv, onClose }: { inv: Investigation; onClose: () => void }) {
  // Use the stored HTML verbatim; memoize so the blob URL never changes on re-render
  // (changing src would reload the iframe and reset scroll position)
  const url = useMemo(() => {
    const html = inv.email_html_report ?? '<p style="font-family:sans-serif;padding:32px;color:#64748b">No report stored for this investigation.</p>'
    const blob = new Blob([html], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [inv.email_html_report]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke blob URL only when drawer unmounts
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <>
      <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-[780px] max-w-[96vw] bg-white shadow-2xl z-50 flex flex-col"
        style={{ animation: 'drawerSlideIn 0.22s ease-out' }}
      >
        <style>{`
          @keyframes drawerSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white shrink-0">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Diagnostic Report</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {inv.investigation_id} &nbsp;·&nbsp; {inv.vessel_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors ml-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* iframe — takes remaining height, no src changes after mount */}
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          title={`Report ${inv.investigation_id}`}
        />
      </div>
    </>
  )
}

// ─── Email Drawer — email client view of the sent message ────────────────────

function EmailDrawer({ inv, onClose, onOpenReport }: {
  inv: Investigation
  onClose: () => void
  onOpenReport: () => void
}) {
  // Parse plain-text body into paragraphs (split on blank lines)
  const paragraphs = useMemo(() => {
    if (!inv.email_narrative) return []
    return inv.email_narrative
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
  }, [inv.email_narrative])

  const isImmediate = inv.urgency?.toUpperCase() === 'IMMEDIATE'

  return (
    <>
      <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-[680px] max-w-[96vw] bg-white shadow-2xl z-50 flex flex-col"
        style={{ animation: 'drawerSlideIn 0.22s ease-out' }}
      >
        {/* ── Email client chrome header ─────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">Email Sent</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">{inv.investigation_id} &nbsp;·&nbsp; {inv.vessel_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable email body ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">

          {/* Subject + meta header */}
          <div className="bg-white border-b border-slate-100 px-6 pt-5 pb-4">
            {/* Urgency tag */}
            {isImmediate && (
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white mb-3 tracking-wide">
                IMMEDIATE
              </span>
            )}

            {/* Subject */}
            <h2 className="text-[15px] font-semibold text-slate-900 leading-snug mb-4">
              {inv.email_subject}
            </h2>

            {/* From / To / Date metadata rows */}
            <div className="space-y-1.5 text-[12px]">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-medium w-8 shrink-0">From</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">B</div>
                  <span className="text-slate-700 font-medium">BWTS Agent System</span>
                  <span className="text-slate-400">&lt;bwts-agent@metaweave.in&gt;</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-medium w-8 shrink-0">To</span>
                <span className="text-slate-600">Technical Superintendent &nbsp;·&nbsp; {inv.vessel_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-medium w-8 shrink-0">Date</span>
                <span className="text-slate-600">{formatDateShort(inv.email_sent_at)} &nbsp;·&nbsp; {formatTime(inv.email_sent_at)}</span>
              </div>
            </div>
          </div>

          {/* Email body — rendered as paragraphs, not <pre> */}
          <div className="bg-white mx-4 mt-4 rounded-xl border border-slate-100 shadow-sm px-7 py-6">
            <div className="text-[13.5px] text-slate-700 leading-relaxed space-y-4 font-[system-ui]">
              {paragraphs.map((para, i) => {
                // Numbered list items (e.g. "1. Replace all...")
                if (/^\d+\.\s/.test(para)) {
                  const lines = para.split('\n').filter(Boolean)
                  return (
                    <ol key={i} className="list-decimal list-inside space-y-1 pl-1">
                      {lines.map((line, j) => (
                        <li key={j} className="text-slate-700">{line.replace(/^\d+\.\s*/, '')}</li>
                      ))}
                    </ol>
                  )
                }
                // Bullet items
                if (/^[-•]\s/.test(para)) {
                  const lines = para.split('\n').filter(Boolean)
                  return (
                    <ul key={i} className="list-disc list-inside space-y-1 pl-1">
                      {lines.map((line, j) => (
                        <li key={j} className="text-slate-700">{line.replace(/^[-•]\s*/, '')}</li>
                      ))}
                    </ul>
                  )
                }
                // All-caps section headers (e.g. "SEVERITY: CRITICAL")
                if (/^[A-Z][A-Z\s:()]+$/.test(para.split('\n')[0])) {
                  return (
                    <p key={i} className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-1">
                      {para}
                    </p>
                  )
                }
                // Signature / sign-off (starts with "Best regards" etc.)
                if (/^(best regards|regards|sincerely|yours)/i.test(para)) {
                  return (
                    <div key={i} className="pt-3 border-t border-slate-100 text-slate-500 text-[12.5px] whitespace-pre-line">
                      {para}
                    </div>
                  )
                }
                // Regular paragraph
                return <p key={i} className="whitespace-pre-line">{para}</p>
              })}
            </div>
          </div>

          {/* Attachment section */}
          {inv.email_html_report && (
            <div className="mx-4 mt-4 mb-6">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                Attachment
              </p>
              <button
                onClick={() => { onClose(); onOpenReport() }}
                className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm group w-full text-left"
              >
                <div className="w-10 h-12 rounded-lg bg-red-500 flex flex-col items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white text-[8px] font-black tracking-wide">HTML</span>
                  <div className="w-6 h-px bg-white/40 mt-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-700 group-hover:text-slate-900 truncate">
                    Diagnostic Report — {inv.investigation_id}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {inv.investigation_id}.html &nbsp;·&nbsp; {Math.round((inv.email_html_report.length / 1024))} KB
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase, isParallel }: { phase: AgentPhase; isParallel: boolean }) {
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const meta = PHASE_META[phase.phase] ?? { icon: '⚙️', color: 'border-slate-200 bg-white' }
  const dur  = phase.duration_seconds != null ? formatDuration(phase.duration_seconds) : null

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
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />done
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
  const phase1      = phases.filter(p => p.phase.startsWith('phase1_'))
  const synthesis   = phases.find(p => p.phase === 'synthesis')
  const phase2Manual = phases.find(p => p.phase === 'phase2_manual')
  const report      = phases.find(p => p.phase === 'report')

  const Arrow = () => (
    <div className="flex justify-center my-1">
      <div className="flex flex-col items-center">
        <div className="w-px h-3 bg-slate-300" />
        <div className="w-2 h-2 border-b-2 border-r-2 border-slate-300 rotate-45 -mt-1.5" />
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      {phase1.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Phase 1 — Parallel Investigation</p>
          <div className="flex gap-2 flex-wrap">{phase1.map(p => <PhaseCard key={p.id} phase={p} isParallel />)}</div>
        </div>
      )}
      {phase1.length > 0 && synthesis && <Arrow />}
      {synthesis && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Synthesis</p>
          <PhaseCard phase={synthesis} isParallel={false} />
        </div>
      )}
      {synthesis && phase2Manual && <Arrow />}
      {phase2Manual && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Phase 2 — Remediation Lookup</p>
          <PhaseCard phase={phase2Manual} isParallel={false} />
        </div>
      )}
      {phase2Manual && report && <Arrow />}
      {report && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Report & Delivery</p>
          <PhaseCard phase={report} isParallel={false} />
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper with clear outline and bold label ───────────────────────

function Section({
  label, sublabel, accent = 'slate', children,
}: {
  label: string
  sublabel?: string
  accent?: 'slate' | 'blue' | 'emerald' | 'violet'
  children: React.ReactNode
}) {
  const colors = {
    slate:   { border: 'border-slate-200',   label: 'text-slate-500',   bg: 'bg-slate-50',   dot: 'bg-slate-400' },
    blue:    { border: 'border-blue-200',     label: 'text-blue-600',    bg: 'bg-blue-50',    dot: 'bg-blue-400' },
    emerald: { border: 'border-emerald-200',  label: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-400' },
    violet:  { border: 'border-violet-200',   label: 'text-violet-600',  bg: 'bg-violet-50',  dot: 'bg-violet-400' },
  }[accent]

  return (
    <div className={`rounded-xl border-2 ${colors.border} overflow-hidden`}>
      {/* Section header bar */}
      <div className={`${colors.bg} px-4 py-2.5 flex items-center gap-2 border-b ${colors.border}`}>
        <span className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
        <span className={`text-[11px] font-bold uppercase tracking-widest ${colors.label}`}>{label}</span>
        {sublabel && (
          <>
            <span className="text-slate-300 text-[10px]">·</span>
            <span className="text-[10px] text-slate-400">{sublabel}</span>
          </>
        )}
      </div>
      <div className="p-4 bg-white/60">
        {children}
      </div>
    </div>
  )
}

// ─── Investigation Card ───────────────────────────────────────────────────────

function InvestigationCard({ inv }: { inv: Investigation }) {
  const [expanded, setExpanded]           = useState(false)
  const [phases, setPhases]               = useState<AgentPhase[] | null>(null)
  const [phasesLoading, setPhasesLoading] = useState(false)
  const [reportOpen, setReportOpen]       = useState(false)
  const [emailOpen, setEmailOpen]         = useState(false)

  const critCount  = inv.severities?.CRITICAL ?? 0
  const warnCount  = inv.severities?.WARNING  ?? 0
  const isImmediate = inv.urgency?.toUpperCase() === 'IMMEDIATE'

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
      {emailOpen  && <EmailDrawer  inv={inv} onClose={() => setEmailOpen(false)} onOpenReport={() => { setEmailOpen(false); setReportOpen(true) }} />}

      <div className={`rounded-2xl border ${isImmediate ? 'border-red-100' : 'border-slate-200'} bg-white/70 shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>

        {/* ── Collapsed header ─────────────────────────────────── */}
        <button
          onClick={handleExpand}
          className="w-full text-left px-5 py-3.5 flex items-center gap-4 min-w-0"
        >
          {/* Date / time / vessel */}
          <div className="shrink-0 min-w-[130px]">
            <p className="text-sm font-semibold text-slate-800 leading-tight">{formatDateShort(inv.started_at)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{formatTime(inv.started_at)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{inv.vessel_name}</p>
          </div>

          <div className="w-px h-10 bg-slate-100 shrink-0" />

          {/* Urgency */}
          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full text-white ${isImmediate ? 'bg-red-600' : 'bg-orange-500'}`}>
            {inv.urgency}
          </span>

          <div className="w-px h-10 bg-slate-100 shrink-0" />

          {/* Alert pills */}
          <div className="flex items-center gap-2 shrink-0">
            {critCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-red-50 border-red-200 text-red-700 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{critCount} CRITICAL
              </span>
            )}
            {warnCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{warnCount} WARNING
              </span>
            )}
          </div>

          <div className="w-px h-10 bg-slate-100 shrink-0" />

          {/* Duration */}
          <div className="shrink-0 text-center min-w-[56px]">
            <p className="text-sm font-semibold text-slate-700">{formatDuration(inv.duration_seconds)}</p>
            <p className="text-[10px] text-slate-400">duration</p>
          </div>

          {inv.email_sent_at && (
            <>
              <div className="w-px h-10 bg-slate-100 shrink-0" />
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✉️ Email sent
              </span>
            </>
          )}

          {inv.recurrence?.is_recurring && (
            <>
              <div className="w-px h-10 bg-slate-100 shrink-0" />
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                🔁 #{inv.recurrence.count}
              </span>
            </>
          )}

          <div className="flex-1" />

          {/* Investigation ID — subtle right anchor */}
          <span className="shrink-0 font-mono text-xs text-slate-300 font-medium">{inv.investigation_id}</span>

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

        {/* ── Expanded content ─────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4 space-y-4">

            {/* ── INPUT ────────────────────────────────────────── */}
            <Section label="Input" sublabel="Alerts received by monitoring agent" accent="blue">
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Parameter', 'Severity', 'Received', 'Current', 'Threshold', 'Deviation', 'Type'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(inv.alerts_detail ?? []).map((alert, i) => (
                      <tr key={alert.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">{alert.parameter}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-400'}`} />
                            {alert.severity}
                          </span>
                        </td>
                        {/* Received = investigation started_at (all alerts arrive as a batch) */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <p className="text-[11px] text-slate-700 font-medium">{formatDateShort(inv.started_at)}</p>
                          <p className="text-[10px] text-slate-400">{formatTime(inv.started_at)}</p>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                          {alert.current_value} <span className="text-slate-400 font-normal text-[10px]">{alert.unit}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                          {alert.threshold_value} <span className="text-slate-400 text-[10px]">{alert.unit}</span>
                        </td>
                        <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${alert.deviation_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {alert.deviation_pct > 0 ? '+' : ''}{alert.deviation_pct}%
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-[10px] whitespace-nowrap">{alert.alert_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Batch detected · {formatDateTime(inv.started_at)}
                {inv.recurrence?.is_recurring && inv.recurrence.prior_investigation_ids?.length
                  ? ` · 🔁 Recurrence — prior: ${inv.recurrence.prior_investigation_ids.join(', ')}`
                  : ''}
              </p>
            </Section>

            {/* ── OUTPUT ───────────────────────────────────────── */}
            <Section label="Output" sublabel="Report sent by agent" accent="emerald">
              <div className="space-y-3">
                {/* Email meta + attachment chip */}
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Subject</p>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{inv.email_subject}</p>
                    {inv.email_sent_at && (
                      <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                        ✅ Sent {formatDateTime(inv.email_sent_at)}
                      </p>
                    )}
                  </div>

                  {/* Chips row — Email + HTML Report */}
                  <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    {/* Email chip */}
                    <button
                      onClick={() => setEmailOpen(true)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm"
                    >
                      <div className="w-9 h-11 rounded-md bg-blue-500 flex flex-col items-center justify-center shrink-0 shadow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">Email Sent</p>
                        <p className="text-[10px] text-slate-400">click to view</p>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 ml-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* HTML Report chip */}
                    <button
                      onClick={() => setReportOpen(true)}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm"
                    >
                      <div className="w-9 h-11 rounded-md bg-red-500 flex flex-col items-center justify-center shrink-0 shadow-sm">
                        <span className="text-white text-[8px] font-black tracking-wide">HTML</span>
                        <div className="w-5 h-px bg-white/40 mt-1" />
                      </div>
                      <div className="text-left">
                        <p className="text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">Diagnostic Report</p>
                        <p className="text-[10px] text-slate-400">{inv.investigation_id}.html · click to view</p>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 ml-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── AGENT WORK ───────────────────────────────────── */}
            <Section label="Agent Work" sublabel="How the investigation was conducted" accent="violet">
              <div className="space-y-4">
                {/* Phase timeline */}
                {phasesLoading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
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
                          <div>
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
                    {inv.recurrence?.prior_investigation_ids?.length ? (
                      <p className="mt-1 text-[10px] text-violet-500 font-medium">
                        Prior: {inv.recurrence.prior_investigation_ids.join(' → ')}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </Section>

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

  const totalAlerts = investigations.reduce((s, i) => s + i.alert_count, 0)
  const totalCrit   = investigations.reduce((s, i) => s + (i.severities?.CRITICAL ?? 0), 0)
  const emailsSent  = investigations.filter(i => i.email_sent_at).length

  return (
    <div
      className="min-h-screen px-6 pt-6 pb-12"
      style={{ background: 'radial-gradient(ellipse at center, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)' }}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-light text-slate-800 tracking-tight">Agent Investigation Log</h2>
          <p className="text-sm text-slate-500 mt-1">Autonomous monitoring cycles · Root cause analysis · Remediation reports</p>
        </div>
        {!loading && investigations.length > 0 && (
          <div className="flex items-center gap-5 text-right">
            {[
              { val: investigations.length, label: 'Investigations', cls: 'text-slate-800' },
              { val: totalCrit,             label: 'Critical alerts', cls: 'text-red-600'  },
              { val: totalAlerts,           label: 'Total alerts',   cls: 'text-slate-800' },
              { val: emailsSent,            label: 'Emails sent',    cls: 'text-emerald-600' },
            ].map(({ val, label, cls }, i, arr) => (
              <div key={label} className="flex items-center gap-5">
                <div>
                  <p className={`text-2xl font-light ${cls}`}>{val}</p>
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
