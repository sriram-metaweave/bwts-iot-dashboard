# BWTS IoT Dashboard — API Reference

Base URL: `https://bwts-iot.vercel.app`

All endpoints return `application/json`. Timestamps are ISO 8601 UTC strings. Numeric sensor values are floats.

---

## Table of Contents

1. [Telemetry](#telemetry)
   - [GET /api/telemetry/latest](#get-apitelemetrylatest)
   - [GET /api/telemetry/history](#get-apitelemetryhistory)
   - [GET /api/telemetry/aggregated](#get-apitelemetryaggregated)
   - [GET /api/telemetry/chunked](#get-apitelemetrychunked)
   - [GET /api/telemetry/runtime-analysis](#get-apitelemetryruntime-analysis)
2. [Health Scores](#health-scores)
   - [GET /api/health](#get-apihealth)
   - [GET /api/health/aggregated](#get-apihealthaggregated)
3. [Events](#events)
   - [GET /api/events](#get-apievents)
4. [Stats](#stats)
   - [GET /api/stats](#get-apistats)
5. [Predictions](#predictions)
   - [GET /api/predictions](#get-apipredictions)
6. [Maintenance](#maintenance)
   - [GET /api/maintenance/upcoming](#get-apimaintenanceupcoming)
7. [Alerts](#alerts)
   - [GET /api/alert-instances](#get-apialert-instances)
   - [PATCH /api/alert-instances/:id](#patch-apialert-instancesid)
   - [GET /api/alerts/check](#get-apialertscheck)
   - [GET /api/alerts/settings](#get-apialertssettings)
   - [POST /api/alerts/settings](#post-apialertssettings)
   - [POST /api/alerts/demo](#post-apialertsdemo)
8. [Debug](#debug)
   - [GET /api/debug/lamp-data](#get-apidebuglamp-data)
   - [GET /api/debug/data-check](#get-apidebugdata-check)
9. [Demo](#demo)
   - [POST /api/demo](#post-apidemo)

---

## Telemetry

### GET /api/telemetry/latest

Returns the single most recent telemetry reading from the sensor array.

**Query Parameters**

| Parameter | Type   | Required | Default | Description                            |
|-----------|--------|----------|---------|----------------------------------------|
| `source`  | string | No       | —       | Pass `demo` to receive simulated data  |

**Response** — single object

```json
{
  "timestamp": "2026-01-15T08:03:00Z",
  "UVR_INTENSITY": 612.4,
  "UVR_POWER_OUTPUT": 4820.0,
  "UVR_WATER_TEMP": 18.3,
  "SYS_FLOW_RATE": 1200.5,
  "SYS_PRESSURE": 2.4,
  "AVG_LAMP_EFFICIENCY": 87.2,
  "FAILED_LAMP_COUNT": 0,
  "LAMP_01_STATUS": "ACTIVE",
  "LAMP_01_POWER": 302.1,
  "LAMP_01_RUNTIME": 1240.5,
  "LAMP_01_EFFICIENCY": 91.3,
  "LAMP_02_STATUS": "ACTIVE",
  "LAMP_02_POWER": 298.7,
  "LAMP_02_RUNTIME": 1238.0,
  "LAMP_02_EFFICIENCY": 90.1
  // ... LAMP_03 through LAMP_16 follow the same pattern
}
```

**Error Responses**

| Status | Body                              |
|--------|-----------------------------------|
| 500    | `{ "error": "Failed to fetch data" }` |

---

### GET /api/telemetry/history

Returns raw telemetry readings for a sliding time window ending at the latest available record.

**Query Parameters**

| Parameter | Type   | Required | Default | Description                             |
|-----------|--------|----------|---------|-----------------------------------------|
| `hours`   | number | No       | `24`    | How many hours back from the latest row |

**Response** — array of telemetry objects (ascending timestamp order)

Same field shape as `/api/telemetry/latest`.

**Error Responses**

| Status | Body                                 |
|--------|--------------------------------------|
| 500    | `{ "error": "Failed to fetch history" }` |

---

### GET /api/telemetry/aggregated

Returns time-bucketed (hourly or daily) averages of all telemetry channels. Used for fast initial chart rendering.

**Query Parameters**

| Parameter   | Type   | Required | Default | Description                                              |
|-------------|--------|----------|---------|----------------------------------------------------------|
| `interval`  | string | No       | `day`   | Bucket size: `hour` or `day`                             |
| `hours`     | number | No       | `720`   | Lookback window in hours (ignored when date range given) |
| `startDate` | string | No       | —       | ISO timestamp — overrides `hours` when present           |
| `endDate`   | string | No       | —       | ISO timestamp — overrides `hours` when present           |

**Response** — array of aggregated bucket objects (ascending order)

```json
[
  {
    "timestamp": "2026-01-01T00:00:00Z",
    "UVR_INTENSITY": 608.1,
    "UVR_POWER_OUTPUT": 4790.0,
    "UVR_WATER_TEMP": 17.9,
    "SYS_FLOW_RATE": 1195.3,
    "SYS_PRESSURE": 2.3,
    "AVG_LAMP_EFFICIENCY": 88.0,
    "FAILED_LAMP_COUNT": 0.0,
    "LAMP_01_EFFICIENCY": 91.0,
    "LAMP_01_POWER": 300.0,
    "LAMP_01_RUNTIME": 1100.0,
    // ... LAMP_02 through LAMP_16
    "recordCount": 480
  }
]
```

**Error Responses**

| Status | Body                                               |
|--------|----------------------------------------------------|
| 500    | `{ "error": "Failed to fetch aggregated telemetry data" }` |

---

### GET /api/telemetry/chunked

Returns a paginated page of raw telemetry records within a date range. Intended for progressive background streaming — call repeatedly incrementing `offset` until `hasMore` is `false`.

**Query Parameters**

| Parameter   | Type   | Required | Default | Description                   |
|-------------|--------|----------|---------|-------------------------------|
| `startDate` | string | **Yes**  | —       | ISO timestamp (inclusive)     |
| `endDate`   | string | **Yes**  | —       | ISO timestamp (inclusive)     |
| `offset`    | number | No       | `0`     | Row offset for pagination     |
| `limit`     | number | No       | `500`   | Rows per page (max 500)       |

**Response**

```json
{
  "data": [ /* array of full telemetry objects */ ],
  "pagination": {
    "offset": 0,
    "limit": 500,
    "total": 17531,
    "hasMore": true
  }
}
```

**Error Responses**

| Status | Body                                                  |
|--------|-------------------------------------------------------|
| 400    | `{ "error": "startDate and endDate are required" }`   |
| 500    | `{ "error": "Failed to fetch chunked telemetry data" }` |

---

### GET /api/telemetry/runtime-analysis

Returns raw telemetry ordered chronologically, focused on per-lamp runtime, efficiency, and power — used for the degradation graphs in the Trend Analysis tab.

**Query Parameters**

| Parameter   | Type   | Required | Default     | Description               |
|-------------|--------|----------|-------------|---------------------------|
| `startDate` | string | No       | Full dataset | ISO timestamp (inclusive) |
| `endDate`   | string | No       | Full dataset | ISO timestamp (inclusive) |

**Response** — array of objects (ascending timestamp, max 10 000 rows)

```json
[
  {
    "timestamp": "2025-03-01T06:00:00Z",
    "UVR_INTENSITY": 615.0,
    "UVR_POWER_OUTPUT": 4830.0,
    "LAMP_01_RUNTIME": 420.0,
    "LAMP_01_EFFICIENCY": 94.2,
    "LAMP_01_POWER": 305.0,
    "LAMP_02_RUNTIME": 418.5,
    "LAMP_02_EFFICIENCY": 93.8,
    "LAMP_02_POWER": 303.1
    // ... LAMP_03 through LAMP_16
  }
]
```

**Error Responses**

| Status | Body                                                |
|--------|-----------------------------------------------------|
| 500    | `{ "error": "Failed to fetch runtime analysis data" }` |

---

## Health Scores

### GET /api/health

Returns the most recent pre-computed system health scores.

**Query Parameters**

| Parameter | Type   | Required | Default | Description            |
|-----------|--------|----------|---------|------------------------|
| `limit`   | number | No       | `100`   | Number of rows to return |

**Response** — array ordered by timestamp descending

```json
[
  {
    "id": 1842,
    "timestamp": "2026-01-15T08:00:00Z",
    "overall_score": 84.7,
    "risk_level": "LOW",
    "month": 1,
    "componentsUvHealth": 88.0,
    "componentsPowerEfficiency": 85.5,
    "componentsLampHealth": 82.1,
    "componentsThermalHealth": 83.3
  }
]
```

**Error Responses**

| Status | Body                                      |
|--------|-------------------------------------------|
| 500    | `{ "error": "Failed to fetch health scores" }` |

---

### GET /api/health/aggregated

Returns time-bucketed average health scores. Mirrors the pattern of `/api/telemetry/aggregated`.

**Query Parameters**

| Parameter   | Type   | Required | Default | Description                                 |
|-------------|--------|----------|---------|---------------------------------------------|
| `interval`  | string | No       | `day`   | `hour` or `day`                             |
| `limit`     | number | No       | `1500`  | Max raw rows to include before bucketing    |
| `startDate` | string | No       | —       | ISO timestamp — enables date-range mode     |
| `endDate`   | string | No       | —       | ISO timestamp — enables date-range mode     |

**Response** — array (ascending order)

```json
[
  {
    "timestamp": "2026-01-01T00:00:00Z",
    "overall_score": 85.2,
    "components": {
      "uv_health": 88.4,
      "lamp_health": 83.0,
      "power_efficiency": 86.1,
      "thermal_health": 83.5
    },
    "recordCount": 8
  }
]
```

**Error Responses**

| Status | Body                                              |
|--------|---------------------------------------------------|
| 500    | `{ "error": "Failed to fetch aggregated health data" }` |

---

## Events

### GET /api/events

Returns process lifecycle and alarm events.

**Query Parameters**

| Parameter | Type   | Required | Default | Description                             |
|-----------|--------|----------|---------|-----------------------------------------|
| `limit`   | number | No       | `100`   | Max events to return                    |
| `type`    | string | No       | —       | Filter by `eventType` (exact match)     |

**Common `type` values:** `PROCESS_START`, `PROCESS_STOP`, `ALARM_TRIGGERED`, `ALERT_DIGEST_SENT`, `ALERT_EMAIL_PAUSED`, `ALERT_EMAIL_RESUMED`

**Response** — array ordered by timestamp descending

```json
[
  {
    "timestamp": "2026-01-15T07:45:00Z",
    "event_type": "PROCESS_START",
    "description": "Ballast water treatment process started",
    "data": {
      "operation_type": "BALLASTING",
      "location": "PORT_SIDE",
      "target_flow": 1200
    }
  }
]
```

**Error Responses**

| Status | Body                                  |
|--------|---------------------------------------|
| 500    | `{ "error": "Failed to fetch events" }` |

---

## Stats

### GET /api/stats

Returns a combined snapshot: latest telemetry, latest health, recent 24-hour events, and current-month averages. Designed for dashboard header/overview widgets.

**Query Parameters**

| Parameter | Type   | Required | Default | Description                           |
|-----------|--------|----------|---------|---------------------------------------|
| `source`  | string | No       | —       | Pass `demo` for simulated data        |

**Response**

```json
{
  "latestTelemetry": { /* full telemetry object */ },
  "latestHealth": {
    "timestamp": "2026-01-15T08:00:00Z",
    "overall_score": 84.7,
    "risk_level": "LOW",
    "month": 1,
    "components": {
      "uv_health": 88.0,
      "power_efficiency": 85.5,
      "lamp_health": 82.1,
      "thermal_health": 83.3
    }
  },
  "recentEvents": [
    {
      "event_type": "PROCESS_START",
      "description": "...",
      "timestamp": "2026-01-15T07:45:00Z"
    }
  ],
  "monthlyAvg": {
    "UVR_INTENSITY": 609.3,
    "UVR_POWER_OUTPUT": 4800.0,
    "SYS_FLOW_RATE": 1198.0
  }
}
```

**Error Responses**

| Status | Body                                |
|--------|-------------------------------------|
| 500    | `{ "error": "Failed to fetch stats" }` |

---

## Predictions

### GET /api/predictions

Returns the latest ML predictions for remaining useful life (RUL) and failure probability for all lamp components.

**Query Parameters**

| Parameter | Type   | Required | Default | Description               |
|-----------|--------|----------|---------|---------------------------|
| `limit`   | number | No       | `100`   | Max prediction rows       |

**Response** — array ordered by timestamp descending

```json
[
  {
    "timestamp": "2026-01-15T00:00:00Z",
    "component_id": "LAMP_07",
    "component_type": "UV_LAMP",
    "predictions": {
      "remaining_useful_life_hours": 847.0,
      "failure_probability": 0.12,
      "efficiency_percent": 82.4
    },
    "current_state": {
      "runtime_hours": 2153.0,
      "efficiency_percent": 82.4,
      "status": "WARNING"
    }
  }
]
```

**Error Responses**

| Status | Body                                        |
|--------|---------------------------------------------|
| 500    | `{ "error": "Failed to fetch predictions" }` |

---

## Maintenance

### GET /api/maintenance/upcoming

Returns the next scheduled maintenance task for each component/type combination — only tasks due within the next 120 days, sorted soonest-first.

**Query Parameters** — none

**Response** — array of up to 20 items

```json
[
  {
    "id": 301,
    "component_id": "LAMP_03",
    "component_type": "UV_LAMP",
    "maintenance_type": "LAMP_REPLACEMENT",
    "description": "Replace UV lamp assembly",
    "completed_date": "2025-09-10",
    "due_date": null,
    "next_due_date": "2026-02-05",
    "status": "SCHEDULED",
    "findings": null,
    "days_until": 21
  }
]
```

**Error Responses**

| Status | Body                                          |
|--------|-----------------------------------------------|
| 500    | `{ "error": "Failed to fetch maintenance data" }` |

---

## Alerts

### GET /api/alert-instances

Returns alert instances from `bwts_alert_instances`, with optional filtering.

**Query Parameters**

| Parameter      | Type    | Required | Default | Description                                          |
|----------------|---------|----------|---------|------------------------------------------------------|
| `status`       | string  | No       | —       | Filter by status: `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED` |
| `since`        | string  | No       | —       | ISO timestamp — only alerts detected after this time |
| `agentPending` | boolean | No       | —       | Shortcut for `status=ACTIVE` + `agent_triggered=false` |

**Response** — array (max 100), ordered by `detected_at` descending

```json
[
  {
    "id": 42,
    "alert_type": "UV_INTENSITY_LOW",
    "severity": "WARNING",
    "parameter": "UVR_INTENSITY",
    "current_value": 498.3,
    "threshold_value": 530.0,
    "unit": "W/m²",
    "deviation_pct": -6.0,
    "detected_at": "2026-01-15T09:00:00Z",
    "status": "ACTIVE",
    "acknowledged_at": null,
    "resolved_at": null,
    "agent_triggered": false,
    "source": "AUTO_CHECK"
  }
]
```

**Error Responses**

| Status | Body                                             |
|--------|--------------------------------------------------|
| 500    | `{ "error": "Failed to fetch alert instances" }` |

---

### PATCH /api/alert-instances/:id

Updates the status or agent-trigger flag of a single alert instance.

**Route Parameters**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | number | **Yes**  | Alert instance ID (integer) |

**Request Body** (JSON) — provide one of:

| Field            | Type    | Description                              |
|------------------|---------|------------------------------------------|
| `status`         | string  | `ACKNOWLEDGED` or `RESOLVED`             |
| `agentTriggered` | boolean | `true` — marks the alert as agent-handled |

**Response**

```json
{ "ok": true, "id": 42, "status": "ACKNOWLEDGED" }
```

**Error Responses**

| Status | Body                                            |
|--------|-------------------------------------------------|
| 400    | `{ "error": "Invalid id" }`                     |
| 400    | `{ "error": "Invalid body — provide status or agentTriggered" }` |
| 404    | `{ "error": "Not found or not active" }`        |
| 404    | `{ "error": "Not found or already resolved" }`  |
| 500    | `{ "error": "Failed to update" }`               |

---

### GET /api/alerts/check

Evaluates current sensor readings and predictions against thresholds, creates alert instances for any violations, and fires an email digest if conditions are met. Safe to call idempotently — has a built-in cooldown.

**Query Parameters** — none

**Response (no alerts triggered)**

```json
{ "ok": true, "fired": false, "reason": "no_alerts", "checkedAt": "2026-01-15T09:05:00Z" }
```

**Response (alerts fired)**

```json
{ "ok": true, "fired": true, "alertCount": 2, "checkedAt": "2026-01-15T09:05:00Z" }
```

**Response (skipped)**

```json
{ "ok": true, "skipped": true, "reason": "paused" }
// or
{ "ok": true, "skipped": true, "reason": "cooldown" }
```

**Error Responses**

| Status | Body                      |
|--------|---------------------------|
| 500    | `{ "ok": false, "error": "..." }` |

---

### GET /api/alerts/settings

Returns the current alert email state (active or paused).

**Query Parameters** — none

**Response**

```json
{ "state": "active" }
// or
{ "state": "paused" }
```

---

### POST /api/alerts/settings

Toggles the alert email state. If currently active → pauses; if paused → resumes.

**Request Body** — none required

**Response**

```json
{ "state": "paused" }
// or
{ "state": "active" }
```

---

### POST /api/alerts/demo

Creates a synthetic alert instance and event record for testing the alert pipeline. Has a per-type cooldown to prevent spam.

**Request Body** (JSON)

| Field               | Type   | Required | Description                            |
|---------------------|--------|----------|----------------------------------------|
| `type`              | string | **Yes**  | Alert type identifier (e.g. `UV_INTENSITY_LOW`) |
| `severity`          | string | **Yes**  | `CRITICAL`, `WARNING`, or `INFO`       |
| `parameter`         | string | **Yes**  | Sensor parameter name                  |
| `currentValue`      | number | **Yes**  | Observed sensor value                  |
| `threshold`         | number | **Yes**  | Threshold that was breached            |
| `unit`              | string | **Yes**  | Unit of measurement (e.g. `W/m²`)      |
| `recommendedAction` | string | **Yes**  | Suggested response text                |

**Response (sent)**

```json
{ "ok": true, "sent": true, "instanceId": 77 }
```

**Response (skipped — cooldown)**

```json
{ "ok": true, "skipped": true, "reason": "cooldown" }
```

**Error Responses**

| Status | Body                                           |
|--------|------------------------------------------------|
| 400    | `{ "ok": false, "error": "Missing type or severity" }` |
| 500    | `{ "ok": false, "error": "..." }`              |

---

## Debug

> These endpoints are intended for development and diagnostics only.

### GET /api/debug/lamp-data

Returns a diagnostic snapshot: one sample telemetry row (with lamp fields highlighted), the full data date range, a short runtime-ascending progression, and the latest health score structure.

**Query Parameters** — none

**Response**

```json
{
  "sample": {
    "LAMP_01_STATUS": "ACTIVE",
    "LAMP_01_POWER": 302.1,
    "LAMP_01_RUNTIME": 1240.5,
    "LAMP_01_EFFICIENCY": 91.3,
    "UVR_INTENSITY": 612.4,
    "UVR_POWER_OUTPUT": 4820.0
  },
  "dataRange": {
    "min": "2025-01-01T00:00:00Z",
    "max": "2026-01-15T08:03:00Z"
  },
  "runtimeProgression": [ /* 10 rows with lowest LAMP_01_RUNTIME */ ],
  "healthStructure": { /* latest bwts_iot_health_scores row */ }
}
```

**Error Responses**

| Status | Body                            |
|--------|---------------------------------|
| 500    | `{ "error": "Failed to fetch data" }` |

---

### GET /api/debug/data-check

Returns a summary of dataset coverage and highlights currently failed lamps and high-risk predictions (failure probability ≥ 0.7).

**Query Parameters** — none

**Response**

```json
{
  "telemetry": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2026-01-15T08:03:00Z",
    "count": 17531
  },
  "latest": {
    "failedLampCount": 1,
    "failedLamps": [
      { "lamp": 11, "runtime": 2980.5, "efficiency": 44.1 }
    ]
  },
  "predictions": {
    "highRisk": [
      {
        "component": "LAMP_11",
        "timestamp": "2026-01-15T00:00:00Z",
        "failureProb": 0.84,
        "runtime": 2980.5
      }
    ]
  }
}
```

**Error Responses**

| Status | Body                              |
|--------|-----------------------------------|
| 500    | `{ "error": "Failed to check data" }` |

---

## Demo

### POST /api/demo

Triggers a simulated anomaly or changes the current operation type for demo/presentation purposes. Does not write to the database.

**Request Body** (JSON)

| Field           | Type   | Required | Description                              |
|-----------------|--------|----------|------------------------------------------|
| `action`        | string | **Yes**  | `anomaly` or `setOperation`              |
| `type`          | string | No       | Anomaly type (required when `action=anomaly`) |
| `operationType` | string | No       | Operation type (required when `action=setOperation`) |

**Response**

```json
{ "ok": true }
```

**Error Responses**

| Status | Body                          |
|--------|-------------------------------|
| 400    | `{ "error": "Unknown action" }` |
| 400    | `{ "error": "Invalid request" }` |

---

## Shared Data Shapes

### Telemetry Object Fields

All telemetry endpoints return rows with these fields:

| Field                  | Type   | Description                                 |
|------------------------|--------|---------------------------------------------|
| `timestamp`            | string | UTC timestamp of the reading                |
| `UVR_INTENSITY`        | number | UV dose rate, W/m²                          |
| `UVR_POWER_OUTPUT`     | number | UV system power output, W                   |
| `UVR_WATER_TEMP`       | number | Water temperature at UV chamber, °C         |
| `SYS_FLOW_RATE`        | number | Ballast water flow rate, m³/h               |
| `SYS_PRESSURE`         | number | System pressure, bar                        |
| `AVG_LAMP_EFFICIENCY`  | number | Average efficiency across all 16 lamps, %  |
| `FAILED_LAMP_COUNT`    | number | Count of lamps below critical threshold     |
| `LAMP_NN_STATUS`       | string | Lamp status: `ACTIVE`, `WARNING`, `FAILED`  |
| `LAMP_NN_POWER`        | number | Individual lamp power output, W             |
| `LAMP_NN_RUNTIME`      | number | Cumulative runtime hours                    |
| `LAMP_NN_EFFICIENCY`   | number | Lamp efficiency, %                          |

`NN` ranges from `01` to `16`.

### Compliance Thresholds (reference)

| Threshold          | Value     | Standard      |
|--------------------|-----------|---------------|
| UV Intensity min   | 530 W/m²  | USCG          |
| UV Intensity min   | 252 W/m²  | IMO D-2       |
| UV Intensity target | 650 W/m²  | Optimal       |
| Lamp efficiency — good    | ≥ 90%     | —             |
| Lamp efficiency — warning | 70–89%    | —             |
| Lamp efficiency — critical | < 50%    | —             |
| Lamp runtime warning | 2500 h   | —             |
| Lamp rated lifetime | 3000 h   | —             |
