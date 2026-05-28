import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import useFinanceStore from './store/useFinanceStore'

// Apply saved theme before React renders to avoid flash
const saved = JSON.parse(localStorage.getItem('findash-prefs') || '{}')
const theme = saved?.state?.theme ?? 'dark'
document.documentElement.classList.toggle('dark', theme === 'dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
