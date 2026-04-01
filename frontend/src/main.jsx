import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { TestProvider } from './context/TestContext'

document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TestProvider>
      <App />
    </TestProvider>
  </StrictMode>
)
