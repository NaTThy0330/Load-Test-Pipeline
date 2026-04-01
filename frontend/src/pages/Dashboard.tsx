import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Download, BarChart3 } from 'lucide-react'
import { Button } from '../component/button'
import { Badge } from '../component/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../component/tooltip'
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
      <div className="min-h-screen flex items-center justify-center text-foreground">
        <div className="text-center">
          <p className="text-xl mb-4">Loading results...</p>
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  const summary = results.job
  const rows = results.results || []
  const totalApis = rows.length || results.apis.length
  const passCount = rows.filter((row) => row.slo_pass).length
  const sloPercent = totalApis > 0 ? Math.round((passCount / totalApis) * 100) : 0
  const sloTooltip =
    summary.threshold_p95_ms && summary.threshold_p99_ms && summary.threshold_error_rate_pct !== undefined
      ? `SLO compliance across APIs. Thresholds: p95 < ${summary.threshold_p95_ms}ms, p99 < ${summary.threshold_p99_ms}ms, error rate < ${summary.threshold_error_rate_pct}%, success rate > ${summary.threshold_success_rate_pct ?? 0}%.`
      : 'SLO compliance across APIs based on default thresholds.'
  const checksPassIsNA =
    summary.checks_pass_pct === 0 &&
    (summary.total_requests || 0) > 0 &&
    (summary.error_rate_pct || 0) === 0
  const checksTooltip = checksPassIsNA
    ? 'Checks metric not reported by k6 for this run.'
    : 'Percentage of defined checks that passed status 200 by metric checks'

  return (
    <div className="min-h-screen pb-12 print-root">
      <nav className="border-b border-white/5 backdrop-blur-xl bg-background/80 print-hidden">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground">K6 LoadTest</span>
            </Link>
            <Button onClick={() => window.print()} className="bg-white/10 text-foreground hover:bg-white/20">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-3">Test Results</h1>
          <p className="text-muted-foreground">Latest run summary and per‑API metrics</p>
        </div>
        
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Summary
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">

          <Stat
            label="Duration"
            tooltip="Total test execution time, including ramp‑up and ramp‑down by metric iteration"
            value={`${summary.duration_sec || 0}s`}
          />
          <Stat
            label="Total Requests"
            tooltip="Total number of requests sent across all APIs during the test by metric http_reqs"
            value={summary.total_requests || 0}
          />
          <Stat
            label="Overall RPS"
            tooltip="Total requests per second across all APIs by metric http_reqs"
            value={formatNumber(summary.overall_rps)}
            valueClassName="font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
            cardClassName="border-cyan-400/30 bg-cyan-400/10"
          />
          <Stat
            label="Overall P95"
            tooltip="p95 response time across all APIs combined by metric http_req_duration"
            value={`${formatNumber(summary.overall_p95_ms)} ms`}
            valueClassName="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
            cardClassName="border-purple-400/30 bg-purple-400/10"
          />
          <Stat
            label="Error Rate"
            tooltip="Percentage of failed requests across all APIs. Failed means non‑2xx or network error by metric http_req_failed"
            value={`${formatNumber(summary.error_rate_pct)}%`}
            valueClassName="text-2xl font-bold text-green-400"
            cardClassName="border-green-400/30 bg-green-400/10"
          />
          <Stat
            label="Checks Pass"
            tooltip={checksTooltip}
            value={checksPassIsNA ? 'N/A' : `${formatNumber(summary.checks_pass_pct)}%`}
          />
          <Stat
            label="SLO Compliance"
            tooltip={sloTooltip}
            value={`${sloPercent}%`}
            valueClassName="text-2xl font-bold text-green-400"
            cardClassName="border-green-400/30 bg-green-400/10"
          />
          <Stat
            label="Total APIs"
            tooltip="Number of APIs included in this run."
            value={results.summary?.total_apis || results.apis.length}
            valueClassName="text-2xl font-bold text-orange-400"
            cardClassName="border-orange-400/30 bg-orange-400/10"
          />
        </div>

        {results.summary?.notes && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            {results.summary.notes}
          </div>
        )}

          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            API Performance Metrics
          </h2>

        <div className="overflow-auto rounded-2xl border border-white/5 bg-gray-900/50 print-table-wrap">

          <table className="min-w-[960px] w-full text-left text-sm print-table">
            <colgroup>
              <col className="print-col-api" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-sm" />
              <col className="print-col-md" />
              <col className="print-col-xs" />
            </colgroup>
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="API" tooltip="The API endpoint tested for this row." /> 
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Req Count" tooltip="Total number of requests sent to this API." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="RPS" tooltip="Requests per second for this API (system‑wide)." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Average" tooltip="Latency Average response time per request (ms)." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Median" tooltip="Latency Median (p50) response time per request (ms)." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="95% Line" tooltip="Latency p95 response time. 95% of requests were faster than this." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="99% Line" tooltip="Latency p99 response time. 99% of requests were faster than this." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Min" tooltip="Fastest Latency response time recorded (ms)." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Max" tooltip="Slowest Latency response time recorded (ms)." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Error" tooltip="Percentage of failed requests for this API." />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="Throughput" tooltip="Response data transferred per second (bytes/s)."
                  />
                </th>
                <th className="px-4 py-3">
                  <HeaderWithTooltip label="SLO" tooltip="Pass/Fail based on your SLO threshold for this API." />
                </th>
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
                    {(() => {
                      const fullName = apiIndex[row.api_id] || row.api_id
                      const shortName = formatApiShortName(fullName)
                      return (
                        <td className="px-4 py-3 font-mono text-xs text-foreground break-all" title={fullName}>
                          <span className="screen-only">{fullName}</span>
                          <span className="print-only">{shortName}</span>
                        </td>
                      )
                    })()}
                    <td className="px-4 py-3">{row.req_count ?? 0}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-cyan-400">{formatNumber(row.rps)}</td>
                    <td className="px-4 py-3">{formatMs(row.avg_ms)}</td>
                    <td className="px-4 py-3">{formatMs(row.med_ms)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-purple-400">{formatMs(row.p95_ms)}</td>
                    <td className="px-4 py-3">{formatMs(row.p99_ms)}</td>
                    <td className="px-4 py-3">{formatMs(row.min_ms)}</td>
                    <td className="px-4 py-3 text-sm text-orange-400">{formatMs(row.max_ms)}</td>
                    <td className="px-4 py-3">{formatNumber(row.error_rate_pct)}%</td>
                    <td className="px-4 py-3">{formatNumber(row.throughput_bps)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.slo_pass ? 'default' : 'destructive'}>
                        <span className={row.slo_pass ? 'text-green-400' : 'text-red-400'}>
                          {row.slo_pass ? 'Pass' : 'Fail'}
                        </span>
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Link to="/upload" className="fixed bottom-6 left-6 z-50 print-hidden">
        <Button variant="outline" className="border-white/10 bg-white/5 text-foreground hover:bg-white/10">
          Back to Upload
        </Button>
      </Link>
    </div>
  )
}

function Stat({
  label,
  value,
  tooltip,
  valueClassName,
  cardClassName,
}: {
  label: string
  value: string | number
  tooltip?: string
  valueClassName?: string
  cardClassName?: string
}) {
  return (
    <div
      className={`p-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 ${
        cardClassName || ''
      }`}
    >
      <div className="text-xs text-muted-foreground mb-1">
        {tooltip ? <HeaderWithTooltip label={label} tooltip={tooltip} /> : label}
      </div>
      <div className={valueClassName || 'text-2xl font-bold text-foreground'}>{value}</div>
    </div>
  )
}

function HeaderWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted decoration-white/40 underline-offset-4">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
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

function formatApiShortName(value: string) {
  const trimmed = value?.trim()
  if (!trimmed) return ''

  const candidate = (() => {
    try {
      const url = new URL(trimmed)
      return url.pathname || trimmed
    } catch {
      return trimmed
    }
  })()

  const parts = candidate.split('/').filter(Boolean)
  if (parts.length === 0) return trimmed
  return parts[parts.length - 1]
}
