import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ApiItem, Job, ResultsPayload } from '../lib/api'

type TestState = {
  apis: ApiItem[]
  setApis: (apis: ApiItem[]) => void
  job: Job | null
  setJob: (job: Job | null) => void
  results: ResultsPayload | null
  setResults: (results: ResultsPayload | null) => void
}

const TestContext = createContext<TestState | null>(null)

const STORAGE_KEY = 'k6_test_state_v1'

function loadState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { apis?: ApiItem[]; job?: Job | null; results?: ResultsPayload | null }
  } catch {
    return null
  }
}

export function TestProvider({ children }: { children: React.ReactNode }) {
  const initial = loadState()
  const [apis, setApis] = useState<ApiItem[]>(() => initial?.apis || [])
  const [job, setJob] = useState<Job | null>(() => initial?.job || null)
  const [results, setResults] = useState<ResultsPayload | null>(() => initial?.results || null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = { apis, job, results }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [apis, job, results])

  const value = useMemo(
    () => ({ apis, setApis, job, setJob, results, setResults }),
    [apis, job, results]
  )

  return <TestContext.Provider value={value}>{children}</TestContext.Provider>
}

export function useTestContext() {
  const ctx = useContext(TestContext)
  if (!ctx) throw new Error('useTestContext must be used within TestProvider')
  return ctx
}
