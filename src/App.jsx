import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'

const Login          = lazy(() => import('@/pages/Login'))
const Dashboard      = lazy(() => import('@/pages/Dashboard'))
const Contas         = lazy(() => import('@/pages/Contas'))
const Transacoes     = lazy(() => import('@/pages/Transacoes'))
const Faturas        = lazy(() => import('@/pages/Faturas'))
const Investimentos  = lazy(() => import('@/pages/Investimentos'))
const Configuracoes  = lazy(() => import('@/pages/Configuracoes'))

function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-60 w-full" />
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/contas"        element={<Contas />} />
              <Route path="/transacoes"    element={<Transacoes />} />
              <Route path="/faturas"       element={<Faturas />} />
              <Route path="/investimentos" element={<Investimentos />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
          </Route>
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
