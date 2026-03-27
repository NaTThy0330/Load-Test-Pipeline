import { Link, useNavigate } from 'react-router-dom'
import { Activity, CheckCircle2, Zap } from 'lucide-react'
import { Button } from '../component/button'

export function TestConfig() {
  const navigate = useNavigate()

  const handleStartTest = () => {
    navigate('/loading')
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

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Load Test</h1>
          <p className="text-xl text-gray-400">Default load test configuration for Sprint 1</p>
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2">Load Test (Default)</h3>
              <p className="text-gray-400 mb-4">Ramp-up → steady → ramp-down with default settings.</p>
              <Button onClick={handleStartTest} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                Start Test
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
