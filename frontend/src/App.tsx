import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { Upload } from './pages/Upload'
import { ApiList } from './pages/ApiList'
import { ApiDetail } from './pages/ApiDetail'
import { TestConfig } from './pages/TestConfig'
import { Loading } from './pages/Loading'
import { Dashboard } from './pages/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/api-list" element={<ApiList />} />
        <Route path="/jobs/:jobId/apis/:apiId" element={<ApiDetail />} />
        <Route path="/test-config" element={<TestConfig />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
