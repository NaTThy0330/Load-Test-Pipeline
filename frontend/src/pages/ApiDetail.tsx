import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, BarChart3 } from 'lucide-react'
import { Button } from '../component/button'
import { Badge } from '../component/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../component/chart'
import { getApiDetails } from '../lib/api'
import type { ApiDetailPayload, ApiSeriesPoint, SummaryTrendRow, SummaryCounterRow, SummaryRateRow, SummaryGaugeRow } from '../lib/api'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

type ChartPoint = { time: string; value: number }

export function ApiDetail() {
  const navigate = useNavigate()
  const { jobId, apiId } = useParams()
  const [data, setData] = useState<ApiDetailPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!jobId || !apiId) {
      navigate('/upload')
      return
    }
    setLoading(true)
    setError('')
    getApiDetails(jobId, apiId)
      .then((payload) => setData(payload))
      .catch((err: any) => setError(err.message || 'Failed to load API details'))
      .finally(() => setLoading(false))
  }, [jobId, apiId, navigate])

  const durationData = useMemo(
    () => mapSeries(data?.series?.http_req_duration_p95),
    [data]
  )
  const reqRateData = useMemo(
    () => mapSeries(data?.series?.http_reqs),
    [data]
  )
  const errorRateData = useMemo(
    () => mapSeries(data?.series?.http_req_failed),
    [data]
  )
  const vusData = useMemo(
    () => mapSeries(data?.series?.vus),
    [data]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        <div className="text-center">
          <p className="text-xl mb-4">Loading API details...</p>
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        <div className="text-center">
          <p className="text-xl mb-4">API details not found</p>
          {error && <p className="text-red-400">{error}</p>}
        </div>
      </div>
    )
  }

  const { api, summary } = data
  const durationSec = summary.duration_sec || data.series?.duration_sec || 0

  return (
    <div className="min-h-screen pb-12">
      <nav className="border-b border-white/5 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground">K6 LoadTest</span>
            </Link>
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-foreground hover:bg-white/10"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300">
              {api.method || 'GET'}
            </div>
            <Badge variant={summary.slo_pass ? 'default' : 'destructive'}>
              <span className={summary.slo_pass ? 'text-green-400' : 'text-red-400'}>
                {summary.slo_pass ? 'SLO Pass' : 'SLO Fail'}
              </span>
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-foreground break-all">{api.name}</h1>
          <p className="text-muted-foreground mt-2">Detailed metrics and k6 time series for this API.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="SLO" value={summary.slo_pass ? 'Pass' : 'Fail'} />
          <StatCard label="Total Requests" value={summary.total_requests || 0} />
          <StatCard label="Checks Pass" value={`${formatNumber(summary.checks_pass_pct)}%`} />
          <StatCard label="Duration" value={`${durationSec}s`} />
        </div>

        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-foreground">Summary</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            This chapter provides a summary of the test run metrics. The tables contain aggregated values of the metrics for the entire test run.
          </p>

          <div className="space-y-6">
            <SummaryTableTrends rows={data.summary_tables?.trends || []} />
            <SummaryTableCounters rows={data.summary_tables?.counters || []} />
            <SummaryTableRates rows={data.summary_tables?.rates || []} />
            <SummaryTableGauges rows={data.summary_tables?.gauges || []} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="HTTP Request Duration (p95)"
            subtitle="http_req_duration (p95 over time)"
            data={durationData}
            color="var(--color-chart-1)"
            yFormatter={(v) => `${v.toFixed(0)} ms`}
          />
          <ChartCard
            title="Request Rate (Throughput)"
            subtitle="http_reqs (requests/sec over time)"
            data={reqRateData}
            color="var(--color-chart-2)"
            yFormatter={(v) => `${v.toFixed(2)} req/s`}
          />
          <ChartCard
            title="Error Rate"
            subtitle="http_req_failed (% over time)"
            data={errorRateData}
            color="var(--color-chart-4)"
            yFormatter={(v) => `${v.toFixed(2)}%`}
          />
          <ChartCard
            title="VUs (Load Profile)"
            subtitle="vus over time"
            data={vusData}
            color="var(--color-chart-3)"
            yFormatter={(v) => `${v.toFixed(0)}`}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  data,
  color,
  yFormatter,
}: {
  title: string
  subtitle: string
  data: ChartPoint[]
  color: string
  yFormatter: (v: number) => string
}) {
  const hasData = data.length > 0
  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/50 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {hasData ? (
        <ChartContainer
          config={{
            value: {
              label: title,
              color,
            },
          }}
          className="h-[260px]"
        >
          <LineChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={24} />
            <YAxis tickFormatter={yFormatter} width={80} />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
          No data available.
        </div>
      )}
    </div>
  )
}

function mapSeries(series?: ApiSeriesPoint[]): ChartPoint[] {
  if (!series || series.length === 0) return []
  return series.map((point) => ({
    time: formatTime(point.t),
    value: Number(point.v ?? 0),
  }))
}

function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatNumber(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0'
  return Number(value).toFixed(2)
}

function formatMs(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '0 ms'
  return `${Number(value).toFixed(2)} ms`
}

function formatDurationMs(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  const ms = Number(value)
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(0)} ns`
  if (ms < 1) return `${(ms * 1_000).toFixed(0)} µs`
  if (ms < 1000) return `${ms.toFixed(0)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatBytes(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  const units = ['B', 'kB', 'MB', 'GB']
  let v = Number(value)
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(2)} ${units[i]}`
}

function formatRate(metric: string, value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  if (metric.startsWith('data_')) return `${formatBytes(value)}/s`
  return `${Number(value).toFixed(2)}/s`
}

function formatTrend(metric: string, value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  const durationMetrics = [
    'http_req_blocked',
    'http_req_connecting',
    'http_req_duration',
    'http_req_receiving',
    'http_req_sending',
    'http_req_tls_handshaking',
    'http_req_waiting',
    'iteration_duration',
  ]
  if (durationMetrics.includes(metric)) {
    return formatDurationMs(value)
  }
  return `${Number(value).toFixed(2)}`
}

function SummaryTableTrends({ rows }: { rows: SummaryTrendRow[] }) {
  if (!rows.length) return null
  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold text-foreground bg-white/5">Trends</div>
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Metric</th>
            <th className="px-4 py-3 text-left">Avg</th>
            <th className="px-4 py-3 text-left">Max</th>
            <th className="px-4 py-3 text-left">Med</th>
            <th className="px-4 py-3 text-left">Min</th>
            <th className="px-4 py-3 text-left">P90</th>
            <th className="px-4 py-3 text-left">P95</th>
            <th className="px-4 py-3 text-left">P99</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} className="border-t border-white/5">
              <td className="px-4 py-3 text-muted-foreground">{row.metric}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.avg)}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.max)}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.med)}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.min)}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.p90)}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.p95)}</td>
              <td className="px-4 py-3 text-foreground">{formatTrend(row.metric, row.p99)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryTableCounters({ rows }: { rows: SummaryCounterRow[] }) {
  if (!rows.length) return null
  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold text-foreground bg-white/5">Counters</div>
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Metric</th>
            <th className="px-4 py-3 text-left">Count</th>
            <th className="px-4 py-3 text-left">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} className="border-t border-white/5">
              <td className="px-4 py-3 text-muted-foreground">{row.metric}</td>
              <td className="px-4 py-3 text-foreground">
                {row.metric.startsWith('data_') ? formatBytes(row.count) : row.count.toFixed(0)}
              </td>
              <td className="px-4 py-3 text-foreground">{formatRate(row.metric, row.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryTableRates({ rows }: { rows: SummaryRateRow[] }) {
  if (!rows.length) return null
  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold text-foreground bg-white/5">Rates</div>
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Metric</th>
            <th className="px-4 py-3 text-left">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} className="border-t border-white/5">
              <td className="px-4 py-3 text-muted-foreground">{row.metric}</td>
              <td className="px-4 py-3 text-foreground">{formatRate(row.metric, row.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryTableGauges({ rows }: { rows: SummaryGaugeRow[] }) {
  if (!rows.length) return null
  return (
    <div className="rounded-2xl border border-white/5 bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold text-foreground bg-white/5">Gauges</div>
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Metric</th>
            <th className="px-4 py-3 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric} className="border-t border-white/5">
              <td className="px-4 py-3 text-muted-foreground">{row.metric}</td>
              <td className="px-4 py-3 text-foreground">{row.value.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
