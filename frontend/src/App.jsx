import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

const metricHelp = {
  reqCount: 'Total number of requests sent to this API during the test.',
  rps: 'Total requests per second for this API. System-wide, not per user.',
  avg: 'Average response time (ms) across all requests for this API.',
  med: 'Median response time (ms) across all requests for this API.',
  p95: '95% of requests completed within this time (ms).',
  p99: '99% of requests completed within this time (ms).',
  min: 'Fastest response time (ms) recorded for this API.',
  max: 'Slowest response time (ms) recorded for this API.',
  error: 'Percentage of failed requests (non-2xx or failed checks).',
  throughput: 'Response data transferred per second (bytes/s).',
  slo: 'Pass/Fail based on p95 SLO threshold.',
}

function App() {
  const [files, setFiles] = useState([])
  const [apis, setApis] = useState([])
  const [uploading, setUploading] = useState(false)
  const [job, setJob] = useState(null)
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  const canCreateJob = apis.length > 0 && !job
  const canRun = job && status !== 'running' && status !== 'done'

  const apiIndex = useMemo(() => {
    if (!results?.apis) return {}
    const map = {}
    results.apis.forEach((api) => {
      map[api.id] = api
    })
    return map
  }, [results])

  const resultRows = results?.results ?? []

  useEffect(() => {
    if (!job?.id) return
    if (status === 'done' || status === 'failed') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${job.id}/status`)
        const data = await res.json()
        if (res.ok) {
          setStatus(data.job.status)
          setProgress(data.progress || 0)
          setEta(data.eta_seconds || 0)
          if (data.job.status === 'done' || data.job.status === 'failed') {
            await fetchResults(job.id)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [job, status])

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      files.forEach((file) => form.append('file', file))
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setApis(data.apis || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateJob = async () => {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create job failed')
      setJob(data.job)
      setStatus(data.job.status)
      setProgress(0)
      setEta(0)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleRun = async () => {
    if (!job?.id) return
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${job.id}/run`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Run failed')
      }
      setStatus('running')
      setProgress(0)
      setEta(0)
    } catch (err) {
      setError(err.message)
    }
  }

  const fetchResults = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${jobId}/results`)
      const data = await res.json()
      if (res.ok) {
        setResults(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f3ef] text-[#1b1a1f]">
      <header className="px-6 py-10 no-print">
        <div className="mx-auto max-w-6xl print-full">
          <p className="text-sm uppercase tracking-[0.2em] text-[#6d5f6a]">
            Sylo Sprint 1 MVP
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Load Testing Dashboard</h1>
          <p className="mt-2 text-[#5b515a]">
            Upload specs, confirm APIs, run a default k6 load test, and review metrics.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 print-full">
        <section className="grid gap-6 md:grid-cols-2 no-print">
          <div className="rounded-2xl border border-[#e6ded7] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">1. Upload Files</h2>
            <p className="mt-1 text-sm text-[#5b515a]">PDF or CSS files used to detect APIs.</p>
            <input
              className="mt-4 w-full rounded-lg border border-[#d7cfc8] bg-[#faf7f4] p-3 text-sm"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <button
              className="mt-4 w-full rounded-lg bg-[#1b1a1f] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#a89ea6]"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
            >
              {uploading ? 'Uploading…' : 'Upload & Detect APIs'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#e6ded7] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">2. Confirm APIs</h2>
            <p className="mt-1 text-sm text-[#5b515a]">
              Detected APIs: <span className="font-semibold">{apis.length}</span>
            </p>
            <div className="mt-4 max-h-48 overflow-auto rounded-lg border border-[#eee4dc] bg-[#faf7f4] p-3 text-sm">
              {apis.length === 0 ? (
                <p className="text-[#8a7f88]">No APIs yet. Upload a file first.</p>
              ) : (
                <ul className="space-y-1">
                  {apis.map((api) => (
                    <li key={api.name} className="flex items-center justify-between">
                      <span className="font-medium">{api.name}</span>
                      <span className="text-xs uppercase text-[#8a7f88]">{api.method}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              className="mt-4 w-full rounded-lg border border-[#1b1a1f] px-4 py-2 text-sm font-semibold text-[#1b1a1f] hover:bg-[#1b1a1f] hover:text-white disabled:cursor-not-allowed disabled:border-[#a89ea6] disabled:text-[#a89ea6]"
              onClick={handleCreateJob}
              disabled={!canCreateJob}
            >
              Create Job
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e6ded7] bg-white p-6 shadow-sm no-print">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">3. Run Test</h2>
              <p className="text-sm text-[#5b515a]">Status: {status || 'idle'}</p>
              {status === 'running' && (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-[#efe6df]">
                    <div
                      className="h-2 rounded-full bg-[#1b1a1f] transition-all"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#8a7f88]">
                    {Math.round(progress * 100)}% • ETA {eta}s
                  </p>
                </div>
              )}
            </div>
            <button
              className="rounded-lg bg-[#1b1a1f] px-6 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-[#a89ea6]"
              onClick={handleRun}
              disabled={!canRun}
            >
              Run Load Test
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {results && (
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Results</h2>
              <button
                className="no-print rounded-lg border border-[#1b1a1f] px-4 py-2 text-sm font-semibold text-[#1b1a1f] hover:bg-[#1b1a1f] hover:text-white"
                onClick={() => window.print()}
              >
                Export PDF
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <StatCard label="Duration" value={`${results.job.duration_sec || 0}s`} />
              <StatCard label="Total Requests" value={results.job.total_requests || 0} />
              <StatCard label="Overall RPS" value={formatNumber(results.job.overall_rps)} />
              <StatCard label="Overall P95" value={`${formatNumber(results.job.overall_p95_ms)} ms`} />
              <StatCard label="Error Rate" value={`${formatNumber(results.job.error_rate_pct)}%`} />
              <StatCard label="Checks Pass" value={`${formatNumber(results.job.checks_pass_pct)}%`} />
              <StatCard label="SLO Compliance" value={results.job.slo_pass ? 'Pass' : 'Fail'} />
              <StatCard label="Total APIs" value={results.summary.total_apis || results.apis.length} />
            </div>
            {results.summary?.notes && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {results.summary.notes}
              </div>
            )}

            <div className="mt-6 overflow-auto rounded-2xl border border-[#e6ded7] bg-white">
              <table className="min-w-[960px] w-full text-left text-sm">
                <thead className="bg-[#f1e9e2] text-xs uppercase tracking-wider text-[#6d5f6a]">
                  <tr>
                    <th className="px-4 py-3">API</th>
                    <th className="px-4 py-3" title={metricHelp.reqCount}>Req Count</th>
                    <th className="px-4 py-3" title={metricHelp.rps}>RPS</th>
                    <th className="px-4 py-3" title={metricHelp.avg}>Average</th>
                    <th className="px-4 py-3" title={metricHelp.med}>Median</th>
                    <th className="px-4 py-3" title={metricHelp.p95}>95% Line</th>
                    <th className="px-4 py-3" title={metricHelp.p99}>99% Line</th>
                    <th className="px-4 py-3" title={metricHelp.min}>Min</th>
                    <th className="px-4 py-3" title={metricHelp.max}>Max</th>
                    <th className="px-4 py-3" title={metricHelp.error}>Error</th>
                    <th className="px-4 py-3" title={metricHelp.throughput}>Throughput</th>
                    <th className="px-4 py-3" title={metricHelp.slo}>SLO Result</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6" colSpan={12}>
                        No results yet.
                      </td>
                    </tr>
                  ) : (
                    resultRows.map((row) => {
                      const api = apiIndex[row.api_id]
                      return (
                        <tr key={row.id} className="border-t border-[#efe6df]">
                          <td className="px-4 py-3 font-medium">{api?.name || row.api_id}</td>
                          <td className="px-4 py-3">{row.req_count ?? 0}</td>
                          <td className="px-4 py-3">{formatNumber(row.rps)}</td>
                          <td className="px-4 py-3">{formatMs(row.avg_ms)}</td>
                          <td className="px-4 py-3">{formatMs(row.med_ms)}</td>
                          <td className="px-4 py-3">{formatMs(row.p95_ms)}</td>
                          <td className="px-4 py-3">{formatMs(row.p99_ms)}</td>
                          <td className="px-4 py-3">{formatMs(row.min_ms)}</td>
                          <td className="px-4 py-3">{formatMs(row.max_ms)}</td>
                          <td className="px-4 py-3">{formatNumber(row.error_rate_pct)}%</td>
                          <td className="px-4 py-3">{formatNumber(row.throughput_bps)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                row.slo_pass
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {row.slo_pass ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#e6ded7] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8a7f88]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}


function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0'
  return Number(value).toFixed(2)
}

function formatMs(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0 ms'
  return `${Number(value).toFixed(2)} ms`
}

export default App
