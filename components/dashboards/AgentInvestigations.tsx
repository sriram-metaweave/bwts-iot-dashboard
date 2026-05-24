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

// ─── HTML Report Builder (matches actual BWTS-Report style) ──────────────────

function buildHtmlReport(inv: Investigation): string {
  const critCount = inv.severities?.CRITICAL ?? 0
  const warnCount = inv.severities?.WARNING  ?? 0
  const alertSummaryLabel = `${inv.alert_count} Alert${inv.alert_count !== 1 ? 's' : ''} (${critCount} CRITICAL, ${warnCount} WARNING)`
  const recurrenceText = inv.recurrence?.is_recurring
    ? ` &mdash; ${inv.recurrence.count === 3 ? 'Third' : inv.recurrence.count === 2 ? 'Second' : `#${inv.recurrence.count}`} Recurrence`
    : ''
  const urgencyLabel = inv.urgency === 'IMMEDIATE' ? 'IMMEDIATE ACTION REQUIRED' : inv.urgency

  const priorIds = inv.recurrence?.prior_investigation_ids ?? []
  const recurrenceBanner = inv.recurrence?.is_recurring && priorIds.length > 0
    ? `<div style="background:#7f1d1d;padding:14px 28px;border-bottom:2px solid #dc2626;">
        <div style="color:#fecaca;font-size:12px;font-weight:700;letter-spacing:0.06em;">
          &#9888; ${inv.recurrence.count === 3 ? 'THIRD' : 'REPEATED'} RECURRENCE &mdash;
          ${inv.recurrence.count === 3 ? 'THIRD' : 'REPEATED'} recurrence of identical alert pattern
          (${priorIds.join(' &rarr; ')} &rarr; ${inv.investigation_id}) with zero remediation. ${priorIds.length} prior report${priorIds.length > 1 ? 's' : ''} delivered.
        </div>
      </div>`
    : ''

  const alertTableRows = (inv.alerts_detail ?? []).map(a => {
    const devPos = a.deviation_pct > 0
    const sevBg    = a.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb'
    const sevColor = a.severity === 'CRITICAL' ? '#dc2626' : '#d97706'
    const sevBorder = a.severity === 'CRITICAL' ? '#fecaca' : '#fde68a'
    return `<tr>
      <td style="padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">${a.alert_type}</td>
      <td style="padding:9px 14px;color:#111827;font-size:13px;border-bottom:1px solid #e5e7eb;">${a.parameter}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;">
        <span style="background:${sevBg};color:${sevColor};border:1px solid ${sevBorder};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${a.severity}</span>
      </td>
      <td style="padding:9px 14px;color:#111827;font-weight:600;font-size:13px;border-bottom:1px solid #e5e7eb;">${a.current_value} ${a.unit}</td>
      <td style="padding:9px 14px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;">${a.threshold_value} ${a.unit}</td>
      <td style="padding:9px 14px;color:${devPos ? '#059669' : '#dc2626'};font-weight:700;font-size:13px;border-bottom:1px solid #e5e7eb;">${devPos ? '+' : ''}${a.deviation_pct}%</td>
    </tr>`
  }).join('')

  const causeRows = (inv.confirmed_causes ?? []).map((c, i) => {
    const conf = c.confidence?.toUpperCase()
    const confBg    = conf === 'HIGH' ? '#fef2f2' : '#fffbeb'
    const confColor = conf === 'HIGH' ? '#dc2626' : '#d97706'
    const confBorder = conf === 'HIGH' ? '#fecaca' : '#fde68a'
    const urgBg    = '#fef2f2'
    const urgColor = '#dc2626'
    const urgBorder = '#fecaca'
    return `<tr>
      <td style="padding:8px;color:#92400e;font-weight:700;font-size:12px;border-bottom:1px solid #fde68a;width:30px;vertical-align:top;">#${i + 1}</td>
      <td style="padding:8px;color:#374151;font-size:13px;border-bottom:1px solid #fde68a;">
        <strong>${c.cause}</strong>
        &nbsp;<span style="background:${urgBg};color:${urgColor};border:1px solid ${urgBorder};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;">${inv.urgency}</span>
        &nbsp;<span style="color:#6b7280;font-size:11px;">(${c.confidence} confidence)</span>
        &nbsp;<span style="background:${confBg};color:${confColor};border:1px solid ${confBorder};padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;">${conf}</span>
        <br><span style="color:#6b7280;font-size:12px;line-height:1.5;">${c.evidence_summary}</span>
      </td>
    </tr>`
  }).join('')

  const remediationItems = (inv.remediation_summary ?? '')
    .split(/\.\s+/)
    .filter(s => s.trim().length > 5)
    .map(s => `<li style="margin:0 0 10px;color:#374151;font-size:13px;line-height:1.5;">${s.trim()}${s.endsWith('.') ? '' : '.'}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:620px;margin:32px auto 48px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

  <!-- Red urgency header -->
  <div style="background:#dc2626;padding:24px 28px 20px;">
    <div style="color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;">
      BWTS Alert Report &middot; ${inv.vessel_name}
    </div>
    <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:6px;line-height:1.3;">
      ${urgencyLabel}
    </div>
    <div style="color:#ffffff;font-size:14px;font-weight:600;margin-top:4px;opacity:0.95;">
      ${alertSummaryLabel}${recurrenceText}
    </div>
    <div style="color:#ffffff;opacity:0.8;font-size:12px;margin-top:5px;">
      Detected: ${formatDateShort(inv.started_at)} ${formatTime(inv.started_at)} &nbsp;&bull;&nbsp; Report generated: ${formatDateShort(inv.email_sent_at || inv.completed_at)} ${formatTime(inv.email_sent_at || inv.completed_at)}
    </div>
  </div>

  ${recurrenceBanner}

  <!-- Section 1: Alert Summary -->
  <div style="padding:24px 28px 0;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">
      1 &nbsp;&mdash;&nbsp; Alert Summary
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="width:38%;padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Vessel</td>
        <td style="padding:9px 14px;color:#111827;font-weight:600;font-size:13px;border-bottom:1px solid #e5e7eb;">${inv.vessel_name}</td>
      </tr>
      <tr>
        <td style="padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Alert IDs</td>
        <td style="padding:9px 14px;color:#111827;font-weight:600;font-size:13px;border-bottom:1px solid #e5e7eb;">${(inv.alert_ids ?? []).join(', ')}</td>
      </tr>
      <tr>
        <td style="padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Severity Breakdown</td>
        <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;">
          <span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${critCount} CRITICAL</span>
          &nbsp;
          <span style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${warnCount} WARNING</span>
        </td>
      </tr>
      <tr>
        <td style="padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Detection Time</td>
        <td style="padding:9px 14px;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">${formatDateShort(inv.started_at)} ${formatTime(inv.started_at)}</td>
      </tr>
      <tr>
        <td style="padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;border-bottom:1px solid #e5e7eb;">Investigation Duration</td>
        <td style="padding:9px 14px;color:#374151;font-size:13px;border-bottom:1px solid #e5e7eb;">${formatDuration(inv.duration_seconds)}</td>
      </tr>
      <tr>
        <td style="padding:9px 14px;background:#f9fafb;color:#6b7280;font-size:12px;">Overall Urgency</td>
        <td style="padding:9px 14px;">
          <span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">${inv.urgency}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Section 2: Alert Details Table -->
  <div style="padding:22px 28px 0;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">
      2 &nbsp;&mdash;&nbsp; Alert Details
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="text-align:left;padding:8px 14px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Type</th>
          <th style="text-align:left;padding:8px 14px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Parameter</th>
          <th style="text-align:left;padding:8px 14px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Severity</th>
          <th style="text-align:left;padding:8px 14px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Current</th>
          <th style="text-align:left;padding:8px 14px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Threshold</th>
          <th style="text-align:left;padding:8px 14px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e5e7eb;">Deviation</th>
        </tr>
      </thead>
      <tbody>${alertTableRows}</tbody>
    </table>
  </div>

  <!-- Section 3: Diagnosis -->
  <div style="padding:22px 28px 0;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">
      3 &nbsp;&mdash;&nbsp; Diagnosis
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Confirmed Root Causes</div>
      <table style="width:100%;border-collapse:collapse;">
        ${causeRows}
      </table>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Synthesis</div>
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.7;">${inv.synthesis_summary ?? '—'}</p>
    </div>

    ${inv.casefile_summary ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 18px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Past Incidents &amp; Recurrence Pattern</div>
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.7;">${inv.casefile_summary}</p>
      ${priorIds.length ? `<p style="margin:8px 0 0;color:#7f1d1d;font-size:12px;font-weight:600;">Prior investigations: ${priorIds.join(' → ')}</p>` : ''}
    </div>` : ''}
  </div>

  <!-- Section 4: Recommended Actions -->
  <div style="padding:22px 28px 0;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">
      4 &nbsp;&mdash;&nbsp; Recommended Actions
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#fef2f2;padding:11px 16px;border-bottom:1px solid #fecaca;">
        <span style="font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.07em;">
          ${inv.urgency} &mdash; act before next ballasting operation
        </span>
      </div>
      <div style="padding:14px 16px 8px;">
        <ul style="margin:0;padding:0;list-style:none;">
          ${remediationItems || `<li style="margin:0 0 10px;color:#374151;font-size:13px;line-height:1.5;">${inv.remediation_summary}</li>`}
        </ul>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin:22px 28px 0;padding:14px 0 24px;border-top:1px solid #f1f5f9;">
    <div style="color:#94a3b8;font-size:11px;">Generated by BWTS Agent Team &middot; ${formatDateShort(inv.email_sent_at || inv.completed_at)} ${formatTime(inv.email_sent_at || inv.completed_at)}</div>
    <div style="color:#94a3b8;font-size:11px;margin-top:3px;">Reference: Alfa Laval PureBallast 3.1 System Manual &middot; ${inv.vessel_name}</div>
    <div style="color:#94a3b8;font-size:11px;margin-top:3px;">Alert IDs: ${(inv.alert_ids ?? []).join(', ')} &middot; Investigation: ${inv.investigation_id}</div>
  </div>
</div>
</body>
</html>`
}

// ─── Report Drawer (blob URL memoized — no scroll reset on re-render) ─────────

function ReportDrawer({ inv, onClose }: { inv: Investigation; onClose: () => void }) {
  // Memoize the HTML string so it doesn't regenerate on every parent re-render
  const html = useMemo(() => buildHtmlReport(inv), [inv.investigation_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize the blob URL — changing it would reload the iframe and reset scroll
  const url = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [html])

  // Revoke blob URL only when drawer unmounts
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <>
      <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-[700px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col"
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

                  {/* Attachment chip */}
                  <button
                    onClick={() => setReportOpen(true)}
                    className="shrink-0 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm"
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

                {/* Email body */}
                {inv.email_narrative && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Message</p>
                    <pre className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto bg-slate-50 rounded-lg p-3 border border-slate-100">
                      {inv.email_narrative}
                    </pre>
                  </div>
                )}
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
