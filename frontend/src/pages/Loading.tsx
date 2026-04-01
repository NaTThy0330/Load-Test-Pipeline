import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Zap, Loader2, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react'
import { Progress } from '../component/progress'
import { getJobLogs, getJobResults, getJobStatus } from '../lib/api'
import { useTestContext } from '../context/TestContext'

const testPhases = [
  { name: 'Initializing test environment', max: 10 },
  { name: 'Starting k6 workers', max: 25 },
  { name: 'Ramping up virtual users', max: 45 },
  { name: 'Executing load tests', max: 70 },
  { name: 'Collecting metrics', max: 90 },
  { name: 'Processing results', max: 100 },
]

export function Loading() {
  const navigate = useNavigate()
  const { job, apis, setResults } = useTestContext()
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState(0)
  const [status, setStatus] = useState('running')
  const [currentPhase, setCurrentPhase] = useState(0)
  const [failureMessage, setFailureMessage] = useState('')
  const [failureStage, setFailureStage] = useState('')
  const [logs, setLogs] = useState<{ stdout: string; stderr: string } | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')

  useEffect(() => {
    if (!job?.id) {
      navigate('/upload')
      return
    }

    const interval = setInterval(async () => {
      try {
        const data = await getJobStatus(job.id)
        setStatus(data.job.status)
        const nextProgress = Math.round((data.progress || 0) * 100)
        setProgress(nextProgress)
        setEta(data.eta_seconds || 0)
        const phaseIndex = testPhases.findIndex((phase) => nextProgress <= phase.max)
        setCurrentPhase(phaseIndex === -1 ? testPhases.length - 1 : phaseIndex)

        if (data.job.status === 'done') {
          const results = await getJobResults(job.id)
          setResults(results)
          clearInterval(interval)
          navigate('/dashboard')
        }
        if (data.job.status === 'failed') {
          setFailureMessage(data.job.stage_message || 'Test failed')
          setFailureStage(data.job.stage || '')
          clearInterval(interval)
        }
      } catch {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [job, navigate, setResults])

  const completedPhases = testPhases
    .map((phase, index) => (progress >= phase.max ? index : -1))
    .filter((index) => index >= 0)

  const requestsEstimate = Math.max(0, Math.floor((progress / 100) * 1000))
  const apisEstimate = apis.length
    ? Math.min(Math.floor((progress / 100) * apis.length) + 1, apis.length)
    : 0
  const rpsEstimate = Math.min(parseFloat(((progress / 100) * 10).toFixed(2)), 10)

  const handleLoadLogs = async () => {
    if (!job?.id) return
    try {
      setLogsLoading(true)
      setLogsError('')
      const data = await getJobLogs(job.id)
      setLogs(data)
    } catch (err: any) {
      setLogsError(err.message || 'Failed to load logs')
    } finally {
      setLogsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-4xl px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-2xl opacity-50 animate-pulse" />
            <Zap className="w-12 h-12 text-foreground relative z-10" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3">Running Load Test</h1>
          <p className="text-xl text-muted-foreground">Testing your APIs with k6...</p>
        </div>

        {status === 'failed' && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-300 mb-1">Test failed</div>
                <div className="text-sm text-red-200 whitespace-pre-wrap">
                  {failureStage ? `[${failureStage}] ` : ''}
                  {failureMessage}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleLoadLogs}
                    className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
                    disabled={logsLoading}
                  >
                    {logsLoading ? 'Loading logs...' : logs ? 'Reload logs' : 'View logs'}
                  </button>
                  {logsError && <span className="text-xs text-red-200">{logsError}</span>}
                </div>
              </div>
            </div>
            {logs && (logs.stdout || logs.stderr) && (
              <div className="mt-4 space-y-3">
                {logs.stderr && (
                  <div>
                    <div className="text-xs font-semibold text-red-200 mb-1">stderr</div>
                    <pre className="max-h-60 overflow-auto rounded-lg border border-red-500/20 bg-black/40 p-3 text-xs text-red-100 whitespace-pre-wrap">
                      {logs.stderr}
                    </pre>
                  </div>
                )}
                {logs.stdout && (
                  <div>
                    <div className="text-xs font-semibold text-red-200 mb-1">stdout</div>
                    <pre className="max-h-60 overflow-auto rounded-lg border border-red-500/20 bg-black/40 p-3 text-xs text-red-100 whitespace-pre-wrap">
                      {logs.stdout}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-muted-foreground">
              {status === 'failed' ? 'Test failed' : testPhases[currentPhase]?.name}
            </span>
            <span className="text-sm font-semibold text-blue-400">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground/70">
              Phase {currentPhase + 1} of {testPhases.length}
            </span>
            <span className="text-xs text-muted-foreground/70">
              ETA {eta >= 60 ? `${Math.ceil(eta / 60)} min` : `${eta}s`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Requests Completed</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-foreground">{requestsEstimate.toLocaleString()}</div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">APIs Tested</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {apisEstimate}{apis.length ? ` / ${apis.length}` : ''}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Current RPS</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {rpsEstimate}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">Test Phases</h3>
          <div className="space-y-3">
            {testPhases.map((phase, index) => (
              <div key={phase.name} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    completedPhases.includes(index)
                      ? 'bg-green-500 text-foreground'
                      : index === currentPhase
                      ? 'bg-blue-500 text-foreground'
                      : 'bg-gray-800 text-muted-foreground/60'
                  }`}
                >
                  {completedPhases.includes(index) ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : index === currentPhase ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium transition-colors ${
                      completedPhases.includes(index)
                        ? 'text-green-400'
                        : index === currentPhase
                        ? 'text-foreground'
                        : 'text-muted-foreground/60'
                    }`}
                  >
                    {phase.name}
                  </div>
                </div>
                {completedPhases.includes(index) && (
                  <span className="text-xs text-green-400 font-semibold">Completed</span>
                )}
                {index === currentPhase && (
                  <span className="text-xs text-blue-400 font-semibold">In Progress</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 mt-0.5 animate-spin" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-blue-400 mb-1">Processing in Background</div>
              <div className="text-sm text-muted-foreground">
                Your test is running in parallel across multiple workers. Results will be available once all APIs complete testing.
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/test-config')}
        className="fixed bottom-6 left-6 z-50 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground hover:bg-white/10"
      >
        Back to Test Config
      </button>
    </div>
  )
}
