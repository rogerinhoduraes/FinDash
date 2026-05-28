import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatRelativeTime } from '@/lib/formatters'
import { RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function Configuracoes() {
  const { user } = useAuth()
  const { runs, loading: runsLoading } = useEtlRuns(user?.uid)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [forceLoading, setForceLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveProfile() {
    setSaving(true)
    setMsg('')
    try {
      await updateProfile(auth.currentUser, { displayName })
      await updateDoc(doc(db, `users/${user.uid}/profile`, 'data'), { displayName })
      setMsg('Perfil atualizado!')
    } catch {
      setMsg('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function forceEtl() {
    setForceLoading(true)
    setMsg('')
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch(
        `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/forceEtl`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      )
      setMsg(res.ok ? 'ETL iniciado! Os dados serão atualizados em breve.' : 'Erro ao acionar o ETL.')
    } catch {
      setMsg('Erro de rede ao acionar o ETL.')
    } finally {
      setForceLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil e sincronização de dados</p>
      </div>

      {/* Profile */}
      <Card>
        <h2 className="mb-4 text-base font-semibold">Perfil</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">E-mail</label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nome de exibição</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          {msg && <p className="text-xs text-[#4fd9c8]">{msg}</p>}
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </Card>

      {/* ETL */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Sincronização ETL</h2>
          <Button variant="outline" size="sm" onClick={forceEtl} disabled={forceLoading}>
            {forceLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><RefreshCw className="h-4 w-4" /> Forçar atualização</>
            )}
          </Button>
        </div>

        {runsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma execução encontrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Início</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Banco</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Txs</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border/50">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(run.startedAt, 'dd/MM HH:mm')}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">{run.bank ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {run.status === 'success' ? (
                          <CheckCircle className="h-3 w-3 text-[#4fd9c8]" />
                        ) : (
                          <XCircle className="h-3 w-3 text-[#f05c6e]" />
                        )}
                        <Badge variant={run.status === 'success' ? 'success' : 'danger'} className="text-[10px]">
                          {run.status === 'success' ? 'Sucesso' : 'Erro'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right hidden sm:table-cell text-muted-foreground">
                      {run.counts?.transactions ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
