import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Download } from 'lucide-react'
import { Button } from '../component/button'
import { Badge } from '../component/badge'
import { getJobResults } from '../lib/api'
import { useTestContext } from '../context/TestContext'

export function Dashboard() {
  const navigate = useNavigate()
  const { job, results, setResults } = useTestContext()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!job?.id) {
      navigate('/upload')
      return
    }
    if (!results) {
      getJobResults(job.id)
        .then((data) => setResults(data))
        .catch((err) => setError(err.message || 'Failed to load results'))
    }
  }, [job, results, setResults, navigate])

  const apiIndex = useMemo(() => {
    if (!results?.apis) return {}
    const map: Record<string, string> = {}
    results.apis.forEach((api, idx) => {
      if (api.id) map[api.id] = api.name
      else map[String(idx)] = api.name
    })
    return map
  }, [results])

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl mb-4">Loading results...</p>
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  const summary = results.job
  const rows = results.results || []

  return (
    <div className="min-h-screen pb-12">
      <nav className="border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">K6 LoadTest</span>
            </Link>
            <Button onClick={() => window.print()} className="bg-white/10 text-white hover:bg-white/20">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">Results</h1>
          <p className="text-gray-400">Latest run summary and per‑API metrics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Duration" value={`${summary.duration_sec || 0}s`} />
          <Stat label="Total Requests" value={summary.total_requests || 0} />
          <Stat label="Overall RPS" value={formatNumber(summary.overall_rps)} />
          <Stat label="Overall P95" value={`${formatNumber(summary.overall_p95_ms)} ms`} />
          <Stat label="Error Rate" value={`${formatNumber(summary.error_rate_pct)}%`} />
          <Stat label="Checks Pass" value={`${formatNumber(summary.checks_pass_pct)}%`} />
          <Stat label="SLO Compliance" value={summary.slo_pass ? 'Pass' : 'Fail'} />
          <Stat label="Total APIs" value={results.summary?.total_apis || results.apis.length} />
        </div>

        {results.summary?.notes && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {results.summary.notes}
          </div>
        )}

        <div className="overflow-auto rounded-2xl border border-white/5 bg-gray-900/50">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3">API</th>
                <th className="px-4 py-3">Req Count</th>
                <th className="px-4 py-3">RPS</th>
                <th className="px-4 py-3">Average</th>
                <th className="px-4 py-3">Median</th>
                <th className="px-4 py-3">95% Line</th>
                <th className="px-4 py-3">99% Line</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Max</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Throughput</th>
                <th className="px-4 py-3">SLO</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6" colSpan={12}>
                    No results found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-xs text-white break-all">
                      {apiIndex[row.api_id] || row.api_id}
                    </td>
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
                      <Badge variant={row.slo_pass ? 'default' : 'destructive'}>
                        {row.slo_pass ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function formatNumber(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0'
  return Number(value).toFixed(2)
}

function formatMs(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0 ms'
  return `${Number(value).toFixed(2)} ms`
}
