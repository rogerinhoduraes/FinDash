import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Header'
import { MobileNav } from './MobileNav'
import { useAuth } from '@/hooks/useAuth'
import { useExcludedCategories } from '@/hooks/useExcludedCategories'
import { useAutoClassify } from '@/hooks/useAutoClassify'

export function AppLayout() {
  const { user } = useAuth()
  // Keep the excluded-categories store synced app-wide so every page's
  // useTransactions filters consistently.
  useExcludedCategories(user?.uid)
  // Mounted once for the whole app: applies saved classification rules to
  // freshly-synced transactions automatically, regardless of current page.
  useAutoClassify(user?.uid)

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="scroll">
          <div className="page">
            <Outlet />
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
