export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export type ApiItem = {
  id?: string
  name: string
  method: string
  description?: string
  headers?: string
  query_params?: string
  authorization?: string
  body?: string
}

export type Job = {
  id: string
  status: string
  created_at?: string
  started_at?: string
  finished_at?: string
  stage?: string
  stage_message?: string
  test_type?: string
  duration_sec?: number
  total_requests?: number
  overall_rps?: number
  overall_p95_ms?: number
  overall_p99_ms?: number
  error_rate_pct?: number
  checks_pass_pct?: number
  slo_pass?: boolean
  config_vus?: number
  config_ramp_up_sec?: number
  config_duration_sec?: number
  config_ramp_down_sec?: number
  threshold_p95_ms?: number
  threshold_p99_ms?: number
  threshold_error_rate_pct?: number
  threshold_success_rate_pct?: number
}

export type JobConfig = {
  vus: number
  ramp_up_sec: number
  duration_sec: number
  ramp_down_sec: number
  p95_ms: number
  p99_ms: number
  error_rate_pct: number
  success_rate_pct: number
}

export type Summary = {
  id?: string
  job_id?: string
  total_apis?: number
  notes?: string
}

export type ResultRow = {
  id?: string
  api_id: string
  job_id?: string
  req_count?: number
  rps?: number
  avg_ms?: number
  med_ms?: number
  p95_ms?: number
  p99_ms?: number
  min_ms?: number
  max_ms?: number
  error_rate_pct?: number
  throughput_bps?: number
  slo_pass?: boolean
}

export type ApiSeriesPoint = {
  t: string
  v: number
}

export type ApiSeries = {
  http_req_duration_p95: ApiSeriesPoint[]
  http_reqs: ApiSeriesPoint[]
  http_req_failed: ApiSeriesPoint[]
  vus: ApiSeriesPoint[]
  duration_sec?: number
}

export type ApiSummary = {
  duration_sec: number
  total_requests: number
  checks_pass_pct: number
  slo_pass: boolean
  p95_ms: number
  p99_ms: number
  error_rate_pct: number
  avg_ms: number
  med_ms: number
  min_ms: number
  max_ms: number
  rps: number
  throughput_bps: number
}

export type SummaryTrendRow = {
  metric: string
  avg?: number
  max?: number
  med?: number
  min?: number
  p90?: number
  p95?: number
  p99?: number
}

export type SummaryCounterRow = {
  metric: string
  count: number
  rate: number
}

export type SummaryRateRow = {
  metric: string
  rate: number
}

export type SummaryGaugeRow = {
  metric: string
  value: number
}

export type SummaryTables = {
  trends: SummaryTrendRow[]
  counters: SummaryCounterRow[]
  rates: SummaryRateRow[]
  gauges: SummaryGaugeRow[]
}

export type ApiDetailPayload = {
  job: Job
  api: ApiItem
  result: ResultRow
  summary: ApiSummary
  series: ApiSeries
  summary_tables: SummaryTables
}

export type ResultsPayload = {
  job: Job
  summary: Summary
  apis: ApiItem[]
  results: ResultRow[]
}

export async function uploadFiles(
  pdfFile?: File | null,
  cssFile?: File | null,
  csvFile?: File | null
) {
  const form = new FormData()
  if (pdfFile) form.append('file', pdfFile)
  if (cssFile) form.append('file', cssFile)
  if (csvFile) form.append('file', csvFile)

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data as { apis: ApiItem[]; count: number }
}

export async function createJob(apis: ApiItem[], config?: JobConfig) {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apis, config }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Create job failed')
  return data as { job: Job; apis: ApiItem[] }
}

export async function runJob(jobId: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/run`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Run failed')
  return data
}

export async function getJobStatus(jobId: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/status`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Status failed')
  return data as { job: Job; progress: number; eta_seconds: number }
}

export async function getJobResults(jobId: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/results`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Results failed')
  return data as ResultsPayload
}

export async function getApiDetails(jobId: string, apiId: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/apis/${apiId}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Details failed')
  return data as ApiDetailPayload
}

export async function getJobLogs(jobId: string) {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/logs`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Logs failed')
  return data as { stdout: string; stderr: string }
}
