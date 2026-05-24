#!/usr/bin/env node
/**
 * Truncates bwts_alert_instances and resets the ID sequence.
 * Uses cloud-sql-proxy + psql (avoids .env quote-parsing issues with the pg driver).
 *
 * Usage:  node _truncate_alerts.mjs
 * Requires: cloud-sql-proxy and psql to be installed and on PATH.
 */

import { execSync, spawn } from 'child_process'
import { readFileSync } from 'fs'

// --- Load .env (strip surrounding single/double quotes from values) ---
const env = readFileSync('.env', 'utf8')
const cfg = {}
for (const line of env.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (!match) continue
  const key = match[1].trim()
  let val = match[2].trim()
  if ((val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1)
  }
  cfg[key] = val
}

const INSTANCE = cfg.CLOUD_SQL_INSTANCE_CONNECTION_NAME   // e.g. project:region:instance
const DB_USER  = cfg.POSTGRES_USER
const DB_PASS  = cfg.POSTGRES_PASSWORD
const DB_NAME  = cfg.POSTGRES_DB
const PORT     = 5433

console.log(`Connecting to ${INSTANCE} as ${DB_USER}@${DB_NAME} …`)

// --- Start cloud-sql-proxy ---
const proxy = spawn('cloud-sql-proxy', [INSTANCE, `--port=${PORT}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

proxy.stderr.on('data', (d) => {
  const msg = d.toString().trim()
  if (msg.includes('ready for new connections')) console.log('[proxy] Ready.')
})

// Give the proxy 4 seconds to establish
await new Promise((r) => setTimeout(r, 4000))

// --- Run the SQL via psql ---
const sql = [
  `SELECT COUNT(*) AS rows_before FROM bwts_alert_instances;`,
  `TRUNCATE TABLE bwts_alert_instances RESTART IDENTITY;`,
  `SELECT COUNT(*) AS rows_after  FROM bwts_alert_instances;`,
].join('\n')

try {
  const result = execSync(
    `psql -h 127.0.0.1 -p ${PORT} -U ${DB_USER} -d ${DB_NAME} -c "${sql.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, PGPASSWORD: DB_PASS }, encoding: 'utf8' }
  )
  console.log(result)
  console.log('Done — table cleared, sequence reset to 1.')
} catch (err) {
  console.error('psql error:', err.stderr || err.message)
  process.exitCode = 1
} finally {
  proxy.kill('SIGTERM')
}
