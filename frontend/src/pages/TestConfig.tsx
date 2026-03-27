import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, CheckCircle2, Zap, TrendingUp, Target, ArrowRight, Lock } from 'lucide-react'
import { Button } from '../component/button'
import { createJob, runJob } from '../lib/api'
import { useTestContext } from '../context/TestContext'

const testModes = [
  {
    id: 'loadtest',
    name: 'Load Test',
    icon: Zap,
    description: 'Test system performance under expected load conditions',
    features: ['Parallel execution', 'Real-time metrics', 'SLO compliance', 'Detailed reports'],
    available: true,
    color: 'from-blue-500 to-cyan-500',
    borderColor: 'border-blue-500/30',
    bgColor: 'from-blue-500/10 to-cyan-500/10',
  },
  {
    id: 'stresstest',
    name: 'Stress Test',
    icon: TrendingUp,
    description: 'Push system beyond normal capacity to find breaking points',
    features: ['Progressive load', 'Failure detection', 'Recovery analysis', 'Limit testing'],
    available: false,
    color: 'from-purple-500 to-pink-500',
    borderColor: 'border-purple-500/30',
    bgColor: 'from-purple-500/10 to-pink-500/10',
  },
  {
    id: 'perftest',
    name: 'Performance Test',
    icon: Target,
    description: 'Comprehensive performance analysis and benchmarking',
    features: ['Response times', 'Throughput analysis', 'Resource usage', 'Bottleneck detection'],
    available: false,
    color: 'from-pink-500 to-red-500',
    borderColor: 'border-pink-500/30',
    bgColor: 'from-pink-500/10 to-red-500/10',
  },
]

export function TestConfig() {
  const navigate = useNavigate()
  const { apis, setJob, setResults } = useTestContext()
  const [selectedMode, setSelectedMode] = useState('loadtest')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartTest = async () => {
    if (!apis.length) {
      navigate('/upload')
      return
    }
    try {
      setLoading(true)
      setError('')
      const data = await createJob(apis)
      setJob(data.job)
      setResults(null)
      await runJob(data.job.id)
      navigate('/loading')
    } catch (err: any) {
      setError(err.message || 'Failed to start test')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">K6 LoadTest</span>
            </Link>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Upload</span>
                </div>
                <div className="w-8 h-0.5 bg-green-500" />
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Confirm</span>
                </div>
                <div className="w-8 h-0.5 bg-blue-500" />
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">3</div>
                  <span>Test</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Select Test Mode</h1>
          <p className="text-xl text-gray-400">Choose the type of test you want to run on your APIs</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {testModes.map((mode) => (
            <div
              key={mode.id}
              onClick={() => mode.available && setSelectedMode(mode.id)}
              className={`group relative overflow-hidden cursor-pointer transition-all ${
                !mode.available ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {selectedMode === mode.id && mode.available && (
                <div className={`absolute inset-0 bg-gradient-to-r ${mode.bgColor} blur-xl opacity-50`} />
              )}

              <div className={`relative p-8 rounded-2xl border backdrop-blur-xl transition-all ${
                selectedMode === mode.id && mode.available
                  ? `bg-gradient-to-br ${mode.bgColor} ${mode.borderColor} border-2`
                  : 'bg-gray-900/50 border-white/5 hover:border-white/10'
              }`}>
                {!mode.available && (
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Coming Soon
                  </div>
                )}

                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${mode.color} flex items-center justify-center mb-6 shadow-2xl`}>
                  <mode.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-3">{mode.name}</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">{mode.description}</p>

                <div className="space-y-2">
                  {mode.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 ${mode.available ? 'text-green-400' : 'text-gray-600'}`} />
                      <span className={mode.available ? 'text-gray-300' : 'text-gray-600'}>{feature}</span>
                    </div>
                  ))}
                </div>

                {selectedMode === mode.id && mode.available && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 text-blue-400 font-semibold">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Selected</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectedMode === 'loadtest' && (
          <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl mb-12">
            <h3 className="text-xl font-semibold text-white mb-6">Load Test Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-gray-800/50 border border-white/5">
                <div className="text-sm text-gray-400 mb-2">Virtual Users</div>
                <div className="text-3xl font-bold text-white">1</div>
                <div className="text-sm text-gray-500 mt-1">Concurrent users per API</div>
              </div>

              <div className="p-6 rounded-xl bg-gray-800/50 border border-white/5">
                <div className="text-sm text-gray-400 mb-2">Duration</div>
                <div className="text-3xl font-bold text-white">1 min</div>
                <div className="text-sm text-gray-500 mt-1">Test execution time</div>
              </div>

              <div className="p-6 rounded-xl bg-gray-800/50 border border-white/5">
                <div className="text-sm text-gray-400 mb-2">Ramp-up Time</div>
                <div className="text-3xl font-bold text-white">10s</div>
                <div className="text-sm text-gray-500 mt-1">Time to reach target load</div>
              </div>

              <div className="p-6 rounded-xl bg-gray-800/50 border border-white/5">
                <div className="text-sm text-gray-400 mb-2">Success Threshold</div>
                <div className="text-3xl font-bold text-white">100%</div>
                <div className="text-sm text-gray-500 mt-1">Required success rate</div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-400 mb-1">Default K6 Configuration</div>
                  <div className="text-sm text-gray-400">
                    Using optimized k6 script with parallel execution across all selected APIs.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 backdrop-blur-xl mb-12">
          <h3 className="text-xl font-semibold text-white mb-6">Test Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-400 mb-2">Selected APIs</div>
              <div className="text-3xl font-bold text-white">{apis.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-2">Test Type</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Load Test
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-2">Estimated Time</div>
              <div className="text-3xl font-bold text-white">~1 min</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-2">Total Requests</div>
              <div className="text-3xl font-bold text-white">Depends on API speed</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link to="/api-list">
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              Back to API List
            </Button>
          </Link>
          <Button
            onClick={handleStartTest}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-lg px-8 h-14"
            disabled={loading || selectedMode !== 'loadtest'}
          >
            <Zap className="w-5 h-5 mr-2" />
            {loading ? 'Starting...' : 'Start Load Test'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
