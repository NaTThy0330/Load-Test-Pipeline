import { createContext, useContext, useMemo, useState } from 'react'
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

export function TestProvider({ children }: { children: React.ReactNode }) {
  const [apis, setApis] = useState<ApiItem[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [results, setResults] = useState<ResultsPayload | null>(null)

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
