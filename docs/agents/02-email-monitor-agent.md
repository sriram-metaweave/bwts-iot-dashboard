# Agent: Email Monitor

**Role**: Watches the dedicated BWTS IoT monitoring inbox continuously. When a new alert email arrives, it wakes up, claims the new pending alerts from the DB, fetches the full unresolved alert picture, and forwards everything to the BWTS Orchestrator for causal analysis.

---

## Identity

- **Name**: Email Monitor Agent
- **Type**: Trigger / Listener Agent
- **Reports to**: BWTS Orchestrator
- **Runs**: 24/7, always active

---

## Monitored Inbox

- **Email address**: Dedicated IoT monitoring inbox (`development@metaweave.in` during dev/demo)
- **Protocol**: IMAP IDLE (preferred for near-real-time detection) or polling every 2–5 minutes
- **Source**: Only process emails from the whitelisted sender (Resend / `sriram@metaweave.in`)

---

## Email Types

The dashboard sends two distinct email formats. Both are treated as a wake-up signal only — the email content itself is not parsed for alert data.

### Type A — Single Alert (Demo or Anomaly)
```
Subject: [BWTS-42] Demo Alert — UV Intensity
```

### Type B — Digest (Automated Check)
```
Subject: [BWTS-43, BWTS-44, BWTS-45] 2 critical, 1 warning — BWTS alert digest
```

The only thing extracted from the subject is the list of `BWTS-{id}` numbers — used to confirm the email is a valid alert trigger. All actual data comes from the database.

---

## Trigger Condition

An incoming email is a BWTS alert if it meets **all** of:

1. Sender is the whitelisted alert system address
2. Subject line contains at least one `[BWTS-{number}]` pattern (regex: `/BWTS-(\d+)/g`)

Emails that do not match are ignored.

---

## Core Design Principle

> **The email is a wake-up ping, not the source of truth.**

When the agent wakes up, it does not process only the alerts mentioned in the email. It claims those new alerts, then pulls the **entire unresolved alert history** from the DB as context. This ensures that alerts from 1–2 hours ago — which may be the root cause of what is happening now — are always surfaced to the Orchestrator.

**Example:** A filter pressure warning fires at 08:02. It goes unresolved. At 09:14, UV intensity drops critically. The two events appear unrelated by time, but dirty intake water can choke the filter AND degrade UV performance simultaneously — one root cause. A time-window-based approach would miss this. Pulling all unresolved alerts surfaces the connection.

---

## Process

```
1. POLL / LISTEN
   Monitor inbox via IMAP IDLE or timed polling

2. DETECT
   New email arrives → check sender whitelist
   Extract all BWTS-{id} values from subject using regex: /BWTS-(\d+)/g
   No matches → ignore and continue
   Matches found → proceed

3. CLAIM new pending alerts
   GET /api/alert-instances?agentPending=true
   → Returns all ACTIVE alerts with agent_triggered = false

   For each record returned:
     PATCH /api/alert-instances/{id}
     Body: { "agentTriggered": true }

     200 → claimed, include in new_alerts
     404 → already claimed or resolved → skip

   This is the deduplication mechanism. Multiple agent instances
   can run concurrently without processing the same alert twice.

4. FETCH full unresolved context
   GET /api/alert-instances?status=ACTIVE
   → Returns ALL active alerts regardless of age or agent_triggered status

   This is the context window — includes alerts from minutes ago
   and alerts from hours ago that are still unresolved.
   Do NOT filter by time. Every unresolved alert is potentially
   causally related to what is happening now.

5. FORWARD to BWTS Orchestrator
   Send a single payload with two lists:
   - new_alerts:          the alerts claimed in step 3 (this cycle's trigger)
   - unresolved_context:  all active alerts from step 4 (full picture)

   Mark email as read / move to "Processing" folder

6. CONFIRM
   After Orchestrator acknowledges receipt, move email to "Processed" folder

7. CATCH-UP CHECK
   After Orchestrator finishes its cycle, call:
   GET /api/alert-instances?agentPending=true
   If new unclaimed alerts exist (late cascades that fired during analysis),
   start a new cycle immediately without waiting for the next poll.
```

---

## Output (to BWTS Orchestrator)

```json
{
  "trigger_email_subject": "[BWTS-42, BWTS-47] 2 critical — BWTS alert digest",
  "trigger_email_received_at": "2026-05-12T09:20:00Z",
  "new_alerts": [
    {
      "instance_id": 42,
      "alert_type": "UV_INTENSITY_USCG",
      "severity": "CRITICAL",
      "parameter": "UV Intensity",
      "current_value": 490,
      "threshold_value": 530,
      "unit": "W/m²",
      "deviation_pct": -7.5,
      "detected_at": "2026-05-12T09:14:00Z",
      "source": "AUTO"
    },
    {
      "instance_id": 47,
      "alert_type": "LAMP_EFFICIENCY",
      "severity": "WARNING",
      "parameter": "Lamp Efficiency",
      "current_value": 68.2,
      "threshold_value": 70.0,
      "unit": "%",
      "deviation_pct": -2.6,
      "detected_at": "2026-05-12T09:16:00Z",
      "source": "AUTO"
    }
  ],
  "unresolved_context": [
    {
      "instance_id": 31,
      "alert_type": "FILTER_PRESSURE",
      "severity": "WARNING",
      "parameter": "Filter Differential Pressure",
      "current_value": 0.38,
      "threshold_value": 0.30,
      "unit": "bar",
      "deviation_pct": 26.7,
      "detected_at": "2026-05-12T08:02:00Z",
      "status": "ACTIVE",
      "agent_triggered": true
    },
    {
      "instance_id": 38,
      "alert_type": "FLOW_RATE",
      "severity": "WARNING",
      "parameter": "Flow Rate",
      "current_value": 142,
      "threshold_value": 150,
      "unit": "m³/h",
      "deviation_pct": -5.3,
      "detected_at": "2026-05-12T08:45:00Z",
      "status": "ACKNOWLEDGED",
      "agent_triggered": true
    }
  ]
}
```

The Orchestrator receives the full picture in one payload and is responsible for causal reasoning — determining whether the unresolved context records share a root cause with the new alerts.

---

## API Endpoints Reference

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Get new unclaimed alerts | GET | `/api/alert-instances?agentPending=true` | — |
| Get all unresolved alerts | GET | `/api/alert-instances?status=ACTIVE` | — |
| Claim alert | PATCH | `/api/alert-instances/{id}` | `{ "agentTriggered": true }` |
| Acknowledge alert | PATCH | `/api/alert-instances/{id}` | `{ "status": "ACKNOWLEDGED" }` |
| Resolve alert | PATCH | `/api/alert-instances/{id}` | `{ "status": "RESOLVED" }` |

---

## Tools Required

- IMAP / Gmail API access to the monitoring inbox
- Read and write access to email folders (mark as read, move to subfolder)
- HTTP client to call the dashboard API (`https://bwtsfinalwithpostgredb.vercel.app`)
- Ability to call / notify BWTS Orchestrator

---

## Edge Cases

| Situation | Handling |
|-----------|---------|
| Subject has no `[BWTS-{id}]` pattern | Log as unrecognised format; send raw email to Orchestrator with `parse_failed: true` |
| PATCH returns 404 (already claimed/resolved) | Skip — another agent instance or human handled it |
| `agentPending` returns empty (all already claimed) | Still fetch full unresolved context and forward — new alerts may have been claimed by a parallel instance but context is still needed |
| API unreachable when fetching context | Retry 3× with 10s backoff; if still failing, forward only the claimed new_alerts with `context_unavailable: true` |
| Inbox connection lost | Retry every 60 seconds; if offline > 15 minutes, alert fallback contact |
| Agent was down and missed emails | On restart, call `GET /api/alert-instances?agentPending=true` — catches all unclaimed alerts without relying on missed emails |

---

## Notes

- The agent **never parses values from the email body** — all structured data comes from the API
- The agent does **not do causal analysis or grouping** — it surfaces everything unresolved. Causal reasoning is the Orchestrator's responsibility
- Each alert firing creates a new BIGSERIAL instance ID — yesterday's UV alert and today's UV alert have different IDs and are fully independent records
- `ACKNOWLEDGED` alerts are included in `unresolved_context` — acknowledged means seen but not yet fixed, so still relevant to root cause analysis
- During the NYK demo, alerts triggered via the Demo Controls panel fire through the same inbox so the full agent chain activates naturally
