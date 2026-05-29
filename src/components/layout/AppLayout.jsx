import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Header'
import { MobileNav } from './MobileNav'

export function AppLayout() {
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
