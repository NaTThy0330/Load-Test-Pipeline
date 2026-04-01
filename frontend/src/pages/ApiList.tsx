import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, CheckCircle2, Globe, Search } from 'lucide-react'
import { Button } from '../component/button'
import { Input } from '../component/input'
import { Checkbox } from '../component/checkbox'
import { useTestContext } from '../context/TestContext'

export function ApiList() {
  const navigate = useNavigate()
  const { apis, setApis, setJob, setResults } = useTestContext()
  const [selectedApis, setSelectedApis] = useState<number[]>(apis.map((_, i) => i))
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filteredApis = useMemo(
    () =>
      apis
        .map((api, index) => ({ ...api, index }))
        .filter(
          (api) =>
            api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (api.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        ),
    [apis, searchQuery]
  )

  const toggleApi = (id: number) => {
    setSelectedApis((prev) =>
      prev.includes(id) ? prev.filter((apiId) => apiId !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedApis.length === filteredApis.length) {
      setSelectedApis([])
    } else {
      setSelectedApis(filteredApis.map((api) => api.index))
    }
  }

  const handleContinue = async () => {
    if (selectedApis.length === 0) return
    try {
      setLoading(true)
      setError('')
      const selected = selectedApis.map((idx) => apis[idx])
      setApis(selected)
      setJob(null)
      setResults(null)
      navigate('/test-config')
    } catch (err: any) {
      setError(err.message || 'Failed to start test')
    } finally {
      setLoading(false)
    }
  }

  if (apis.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-foreground">
        <div className="text-center">
          <p className="text-xl mb-4">No APIs found yet</p>
          <Link to="/upload" className="text-blue-400 hover:text-blue-300">Go to Upload</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-white/5 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Activity className="w-6 h-6 text-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground">K6 LoadTest</span>
            </Link>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-6 h-6 rounded-full bg-green-500 text-foreground flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span>Upload</span>
                </div>
                <div className="w-8 h-0.5 bg-blue-500" />
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-foreground flex items-center justify-center text-xs font-semibold">2</div>
                  <span>Confirm</span>
                </div>
                <div className="w-8 h-0.5 bg-white/10" />
                <div className="flex items-center gap-2 text-muted-foreground/60">
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">3</div>
                  <span>Test</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4">Confirm API Endpoints</h1>
          <p className="text-xl text-muted-foreground">Review and select the APIs you want to test</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 backdrop-blur-xl mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Total APIs Detected</div>
              <div className="text-4xl font-bold text-foreground">{apis.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">APIs Selected</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {selectedApis.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Unique Domains</div>
              <div className="text-4xl font-bold text-foreground">
                {new Set(apis.map((a) => a.name.split('/')[2])).size}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <Input
              placeholder="Search APIs by URL or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-gray-900/50 border-white/10 text-foreground placeholder:text-muted-foreground/70 h-12"
            />
          </div>
          <Button
            onClick={toggleAll}
            variant="outline"
            className="border-white/10 bg-white/5 text-foreground hover:bg-white/10 h-12"
          >
            {selectedApis.length === filteredApis.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        <div className="space-y-4">
          {filteredApis.map((api) => (
            <div
              key={api.index}
              onClick={() => toggleApi(api.index)}
              className={`group p-6 rounded-xl border transition-all cursor-pointer ${
                selectedApis.includes(api.index)
                  ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30'
                  : 'bg-gray-900/50 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={selectedApis.includes(api.index)}
                  onCheckedChange={() => toggleApi(api.index)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      api.method === 'GET'
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                        : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                    }`}>
                      {api.method}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">API #{api.index + 1}</span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <code className="text-sm text-foreground font-mono break-all">{api.name}</code>
                  </div>
                  <p className="text-muted-foreground text-sm">{api.description || '-'}</p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DetailBlock label="Headers" value={formatJson(api.headers)} />
                    <DetailBlock label="Query" value={formatJson(api.query_params)} />
                    <DetailBlock label="Authorization" value={api.authorization || '-'} />
                    {api.method === 'POST' && (
                      <DetailBlock label="Body" value={formatJson(api.body)} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-8">
          <Button
            onClick={handleContinue}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-foreground px-8 py-3 text-lg"
            disabled={selectedApis.length === 0 || loading}
          >
            {loading ? 'Starting...' : 'Start Test'}
          </Button>
        </div>
      </div>

      <Link to="/upload" className="fixed bottom-6 left-6 z-50">
        <Button variant="outline" className="border-white/10 bg-white/5 text-foreground hover:bg-white/10">
          Back to Upload
        </Button>
      </Link>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">{label}</div>
      <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words">{value}</pre>
    </div>
  )
}

function formatJson(value?: string) {
  if (!value) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
