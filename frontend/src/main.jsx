import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { TestProvider } from './context/TestContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TestProvider>
      <App />
    </TestProvider>
  </StrictMode>
)
