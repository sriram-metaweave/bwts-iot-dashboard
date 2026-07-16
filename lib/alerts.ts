import { queryOne } from '@/lib/db'

// DB-backed pause switch — toggled from the Alerts tab UI (POST /api/alerts/settings).
// Shared by both the hourly auto-check and the demo-mode alert path so a single
// switch reliably stops emails from either source.
export async function isAlertsPaused(): Promise<boolean> {
  const row = await queryOne<{ eventType: string }>(
    `SELECT "eventType" FROM bwts_iot_events
     WHERE "eventType" IN ('ALERT_EMAIL_PAUSED', 'ALERT_EMAIL_RESUMED')
     ORDER BY timestamp DESC LIMIT 1`
  )
  return row?.eventType === 'ALERT_EMAIL_PAUSED'
}
