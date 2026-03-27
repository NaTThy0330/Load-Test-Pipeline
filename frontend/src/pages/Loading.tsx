import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Zap, Loader2 } from 'lucide-react'
import { Progress } from '../component/progress'
import { getJobResults, getJobStatus } from '../lib/api'
import { useTestContext } from '../context/TestContext'

export function Loading() {
  const navigate = useNavigate()
  const { job, setResults } = useTestContext()
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState(0)
  const [status, setStatus] = useState('running')

  useEffect(() => {
    if (!job?.id) {
      navigate('/upload')
      return
    }

    const interval = setInterval(async () => {
      try {
        const data = await getJobStatus(job.id)
        setStatus(data.job.status)
        setProgress(Math.round((data.progress || 0) * 100))
        setEta(data.eta_seconds || 0)

        if (data.job.status === 'done') {
          const results = await getJobResults(job.id)
          setResults(results)
          clearInterval(interval)
          navigate('/dashboard')
        }
        if (data.job.status === 'failed') {
          clearInterval(interval)
        }
      } catch {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [job, navigate, setResults])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-4xl px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl blur-2xl opacity-50 animate-pulse" />
            <Zap className="w-12 h-12 text-white relative z-10" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Running Load Test</h1>
          <p className="text-xl text-gray-400">Testing your APIs with k6...</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-400">
              {status === 'failed' ? 'Test failed' : 'Executing tests'}
            </span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">Job ID: {job?.id || '—'}</span>
            <span className="text-xs text-gray-500">ETA {eta}s</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Status</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{status}</div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Progress</span>
              <Loader2 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{progress}%</div>
          </div>

          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">ETA</span>
              <Zap className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{eta}s</div>
          </div>
        </div>
      </div>
    </div>
  )
}
