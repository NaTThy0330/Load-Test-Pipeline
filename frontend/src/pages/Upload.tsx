import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, FileText, File, CheckCircle2, Activity, X } from 'lucide-react'
import { Button } from '../component/button'
import { uploadFiles } from '../lib/api'
import { useTestContext } from '../context/TestContext'

export function Upload() {
  const navigate = useNavigate()
  const { setApis } = useTestContext()
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [cssFile, setCssFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDrop = (e: React.DragEvent, type: 'pdf' | 'css') => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      if (type === 'pdf' && file.type === 'application/pdf') {
        setPdfFile(file)
      } else if (type === 'css' && file.name.endsWith('.css')) {
        setCssFile(file)
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'css') => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === 'pdf') {
        setPdfFile(file)
      } else {
        setCssFile(file)
      }
    }
  }

  const handleContinue = async () => {
    if (!pdfFile) return
    try {
      setLoading(true)
      setError('')
      const data = await uploadFiles(pdfFile, cssFile)
      setApis(
        (data.apis || []).map((api) => ({
          name: api.name,
          method: api.method || 'GET',
          description: api.description || '',
        }))
      )
      navigate('/api-list')
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes || Number.isNaN(bytes)) return '0 B'
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${kb.toFixed(1)} KB`
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
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">1</div>
                  <span>Upload</span>
                </div>
                <div className="w-8 h-0.5 bg-white/10" />
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">2</div>
                  <span>Confirm</span>
                </div>
                <div className="w-8 h-0.5 bg-white/10" />
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs">3</div>
                  <span>Test</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Upload Your Files</h1>
          <p className="text-xl text-gray-400">Upload your API specification files to begin testing</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">API PDF File</h3>
                <p className="text-gray-400">Upload your API documentation in PDF format</p>
              </div>
              <div className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold">
                Required
              </div>
            </div>

            {!pdfFile ? (
              <div
                onDrop={(e) => handleDrop(e, 'pdf')}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5'
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-2">Drop your PDF file here or</p>
                    <label className="cursor-pointer">
                      <span className="text-blue-400 hover:text-blue-300 font-medium">browse files</span>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileSelect(e, 'pdf')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">PDF files only, max 50MB</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{pdfFile.name}</p>
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-sm text-gray-400">{formatFileSize(pdfFile.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPdfFile(null)}
                  className="text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/50 border border-white/5 backdrop-blur-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">CSS File</h3>
                <p className="text-gray-400">Upload custom styles for your test configuration</p>
              </div>
              <div className="px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-semibold">
                Optional
              </div>
            </div>

            {!cssFile ? (
              <div
                onDrop={(e) => handleDrop(e, 'css')}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  isDragging
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/10 hover:border-purple-500/50 hover:bg-white/5'
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <File className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-2">Drop your CSS file here or</p>
                    <label className="cursor-pointer">
                      <span className="text-purple-400 hover:text-purple-300 font-medium">browse files</span>
                      <input
                        type="file"
                        accept=".css"
                        onChange={(e) => handleFileSelect(e, 'css')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">CSS files only, max 10MB</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                    <File className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{cssFile.name}</p>
                      <CheckCircle2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-sm text-gray-400">{formatFileSize(cssFile.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCssFile(null)}
                  className="text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleContinue}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 text-lg"
              disabled={!pdfFile || loading}
            >
              {loading ? 'Uploading...' : 'Continue'}
              <UploadIcon className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
