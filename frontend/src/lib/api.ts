export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export type ApiItem = {
  id?: string
  name: string
  method: string
  description?: string
}

export type Job = {
  id: string
  status: string
  created_at?: string
  started_at?: string
  finished_at?: string
  test_type?: string
  duration_sec?: number
  total_requests?: number
  overall_rps?: number
  overall_p95_ms?: number
  error_rate_pct?: number
  checks_pass_pct?: number
  slo_pass?: boolean
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

export type ResultsPayload = {
  job: Job
  summary: Summary
  apis: ApiItem[]
  results: ResultRow[]
}

export async function uploadFiles(pdfFile?: File | null, cssFile?: File | null) {
  const form = new FormData()
  if (pdfFile) form.append('file', pdfFile)
  if (cssFile) form.append('file', cssFile)

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data as { apis: ApiItem[]; count: number }
}

export async function createJob(apis: ApiItem[]) {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apis }),
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
