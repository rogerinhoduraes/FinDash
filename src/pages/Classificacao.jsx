import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTransactions } from '@/hooks/useTransactions'
import { useClassificationRules } from '@/hooks/useClassificationRules'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { formatDate, getBankMeta, translateCategory } from '@/lib/formatters'
import { doc, writeBatch, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CATEGORIES, compareCategories, merchantKey, needsClassification } from '@/lib/categories'
import { Dialog } from '@/components/ui/dialog'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { SectionHead } from '@/components/ui/SectionHead'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 20

export default function Classificacao() {
  const { user } = useAuth()
  const uid = user?.uid
  const { transactions, loading: txLoading } = useTransactions(uid, { maxDocs: 10000 })
  const { rules, loading: rulesLoading, saveRule, updateRule, deleteRule } = useClassificationRules(uid)
  const { customCategories, loading: catsLoading, addCategory, removeCategory } = useCustomCategories(uid)

  const [tab, setTab] = useState('transactions')
  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('')
  const [source, setSource] = useState('all')
  const [onlyUncategorized, setOnlyUncategorized] = useState(false)
  const [page, setPage] = useState(0)

  const [editingId, setEditingId]   = useState(null)
  const [optimistic, setOptimistic] = useState({})   // { [txId]: category }
  const [pendingRule, setPendingRule] = useState(null) // { pattern, category, similarCount }
  const [toast, setToast]           = useState(null)  // { msg, ok }
  const [saving, setSaving]         = useState(false)
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [ruleDraft, setRuleDraft]   = useState({ pattern: '', category: '' })
  const [expandedCats, setExpandedCats] = useState(() => new Set()) // empty = all collapsed
  const [addModalCat, setAddModalCat] = useState(null) // category key the "add rule" modal targets
  const [modalSearch, setModalSearch] = useState('')
  const [modalSelected, setModalSelected] = useState(() => new Set())

  const loading = txLoading || rulesLoading

  const allCategories = useMemo(() => [
    ...CATEGORIES,
    ...customCategories.map(c => ({ key: c.key, pt: c.label, custom: true })),
  ].sort(compareCategories), [customCategories])

  const uncategorizedCount = useMemo(() =>
    transactions.filter(t => needsClassification(optimistic[t.id] ?? t.category)).length,
    [transactions, optimistic])

  const filtered = useMemo(() => {
    let list = transactions
    if (onlyUncategorized) list = list.filter(t => needsClassification(optimistic[t.id] ?? t.category))
    if (search) list = list.filter(t => (t.description ?? '').toLowerCase().includes(search.toLowerCase()))
    if (bankFilter) list = list.filter(t => t.bank === bankFilter)
    if (source === 'credit')   list = list.filter(t => t.account_type === 'CREDIT')
    if (source === 'checking') list = list.filter(t => t.account_type !== 'CREDIT')
    return list
  }, [transactions, optimistic, onlyUncategorized, search, bankFilter, source])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const banks = useMemo(() => {
    const s = new Set(); transactions.forEach(t => t.bank && s.add(t.bank)); return [...s].sort()
  }, [transactions])

  // Saved rules grouped by their target category, sorted A–Z by PT label.
  const rulesByCategory = useMemo(() => {
    const map = {}
    rules.forEach(r => {
      const cat = r.category || 'Others'
      ;(map[cat] ??= []).push(r)
    })
    return Object.entries(map)
      .map(([category, items]) => ({
        category,
        label: translateCategory(category),
        items: items.slice().sort((a, b) => (a.pattern ?? '').localeCompare(b.pattern ?? '', 'pt')),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }))
  }, [rules])

  // Transactions shown in the "add rule" modal: not already in the target
  // category, matching the search box, newest first, capped for perf.
  const modalTxs = useMemo(() => {
    if (!addModalCat) return []
    const q = modalSearch.trim().toLowerCase()
    return transactions
      .filter(t => (optimistic[t.id] ?? t.category) !== addModalCat)
      .filter(t => !q || (t.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [transactions, addModalCat, modalSearch, optimistic])

  const toggleCat = useCallback((cat) => {
    setExpandedCats(prev => {
      const n = new Set(prev)
      if (n.has(cat)) n.delete(cat)
      else n.add(cat)
      return n
    })
  }, [])

  const handleUpdateTx = async (txId, category) => {
    setEditingId(null)
    const current = optimistic[txId] ?? transactions.find(t => t.id === txId)?.category
    if (category === current) return

    setOptimistic(prev => ({ ...prev, [txId]: category }))
    try {
      const tx = transactions.find(t => t.id === txId)
      await updateDoc(doc(db, `users/${uid}/transactions`, txId), { category })
      
      // If manually classifying, suggest a rule based on the merchant fingerprint.
      const key = merchantKey(tx.description)
      const similar = transactions.filter(t => needsClassification(t.category) && merchantKey(t.description) === key)
      if (similar.length > 2) {
        setPendingRule({ pattern: key, category, similarCount: similar.length })
      }
    } catch {
      setOptimistic(prev => { const n = { ...prev }; delete n[txId]; return n })
    }
  }

  const applyPendingRule = async () => {
    const { pattern, category } = pendingRule
    setSaving(true)
    try {
      // 1. Save the rule itself
      await saveRule({ pattern, category })
      // 2. Batch update similar unclassified transactions
      const batch = writeBatch(db)
      const key = pattern.toLowerCase()
      const matches = transactions.filter(t => 
        needsClassification(t.category) && 
        (t.description ?? '').toLowerCase().includes(key)
      )
      matches.forEach(m => {
        batch.update(doc(db, `users/${uid}/transactions`, m.id), { category })
        setOptimistic(prev => ({ ...prev, [m.id]: category }))
      })
      await batch.commit()
      setToast({ msg: `Regra aplicada a ${matches.length} transações.`, ok: true })
      setPendingRule(null)
    } catch {
      setToast({ msg: 'Erro ao aplicar regra.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const handleApplyRuleBatch = async (ruleId) => {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return
    setSaving(true)
    try {
      const batch = writeBatch(db)
      const pattern = rule.pattern.toLowerCase()
      const matches = transactions.filter(t => 
        needsClassification(t.category) && 
        (t.description ?? '').toLowerCase().includes(pattern)
      )
      if (matches.length === 0) {
        setToast({ msg: 'Nenhuma transação pendente encontrada para esta regra.', ok: true })
        return
      }
      matches.forEach(m => {
        batch.update(doc(db, `users/${uid}/transactions`, m.id), { category: rule.category })
        setOptimistic(prev => ({ ...prev, [m.id]: rule.category }))
      })
      await batch.commit()
      setToast({ msg: `Sucesso! ${matches.length} transações classificadas.`, ok: true })
    } catch {
      setToast({ msg: 'Falha ao processar lote.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransactionsToRule = async () => {
    if (modalSelected.size === 0) return
    setSaving(true)
    try {
      const batch = writeBatch(db)
      modalSelected.forEach(id => {
        batch.update(doc(db, `users/${uid}/transactions`, id), { category: addModalCat })
        setOptimistic(prev => ({ ...prev, [id]: addModalCat }))
      })
      await batch.commit()
      setToast({ msg: `${modalSelected.size} transações classificadas.`, ok: true })
      setAddModalCat(null)
      setModalSelected(new Set())
    } catch {
      setToast({ msg: 'Erro ao classificar transações.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="grid gap-6">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-12 w-48" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead 
        title="Classificação" 
        sub={`${uncategorizedCount} pendentes`}
        right={
          <div className="tabs-mini">
            <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Transações</button>
            <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>Regras ({rules.length})</button>
            <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categorias</button>
          </div>
        }
      />

      {tab === 'transactions' && (
        <>
          <div className="card p-4">
            <div className="filter-grid" style={{ gridTemplateColumns: '1fr auto auto auto auto' }}>
              <div className="search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                <input className="fd-input" placeholder="Buscar por descrição…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
              </div>
              <select className="fd-select" value={bankFilter} onChange={(e) => { setBankFilter(e.target.value); setPage(0) }}>
                <option value="">Todos bancos</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select className="fd-select" value={source} onChange={(e) => { setSource(e.target.value); setPage(0) }}>
                <option value="all">Todas fontes</option>
                <option value="checking">Conta corrente</option>
                <option value="credit">Cartão</option>
              </select>
              <label className="flex items-center gap-2 px-3 h-10 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] cursor-pointer select-none">
                <input type="checkbox" checked={onlyUncategorized} onChange={(e) => { setOnlyUncategorized(e.target.checked); setPage(0) }} />
                <span className="text-xs font-medium">Só pendentes</span>
              </label>
              <button className="btn px-4" onClick={() => { setSearch(''); setBankFilter(''); setSource('all'); setOnlyUncategorized(false); setPage(0) }}>Limpar</button>
            </div>
          </div>

          <div className="card p-2">
            <table className="tbl">
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th className="num">Valor</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground">Nenhuma transação pendente. Bom trabalho!</td></tr>
                ) : rows.map(t => {
                  const displayCat = optimistic[t.id] ?? t.category
                  const isPending = needsClassification(displayCat)
                  const meta = getBankMeta(t.bank)
                  return (
                    <tr key={t.id} className={isPending ? 'highlight' : ''}>
                      <td className="mono faint text-[11px] whitespace-nowrap">{t.date ? formatDate(t.date, 'dd/MM/yy') : '—'}</td>
                      <td className="font-medium max-w-[200px] truncate">
                        {t.description}
                        {t.installment_number && t.installment_total && (
                          <span className="ml-2 text-[10px] text-muted-foreground font-mono bg-[var(--surface-3)] px-1 rounded">
                            {t.installment_number}/{t.installment_total}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingId === t.id ? (
                          <select className="fd-select h-7 py-0 px-2 text-[11px]" autoFocus onBlur={() => setEditingId(null)}
                            value={displayCat ?? 'Others'} onChange={(e) => handleUpdateTx(t.id, e.target.value)}>
                            {allCategories.map(c => <option key={c.key} value={c.key}>{c.pt}</option>)}
                          </select>
                        ) : (
                          <span className={`cat cursor-pointer group ${isPending ? 'pending' : ''}`} onClick={() => setEditingId(t.id)}>
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 mr-1.5" />
                            {translateCategory(displayCat)}
                            <span className="ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity">✎</span>
                          </span>
                        )}
                      </td>
                      <td className="text-[11px] font-medium"><div className="flex items-center gap-1.5"><BankDot bank={t.bank} size={7} />{meta.label}</div></td>
                      <td className="num"><Money value={Math.abs(t.amount)} style={{ fontWeight: 700, color: t.amount > 0 ? 'var(--pos)' : 'var(--text)' }} showSymbol={false} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="flex justify-between items-center p-3.5 border-t border-[var(--border)]">
              <span className="text-[11px] text-muted-foreground">{filtered.length} resultados · pág {page+1} de {pages}</span>
              <div className="flex gap-2">
                <button className="btn h-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button>
                <button className="btn h-8" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Próxima</button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'rules' && (
        <div className="grid gap-6">
          <div className="card p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold">Regras de Automação</h3>
              <p className="text-xs text-muted-foreground">Padrões de texto que classificam transações automaticamente.</p>
            </div>
            <button className="btn primary" onClick={() => { setEditingRuleId('new'); setRuleDraft({ pattern: '', category: 'Food and Groceries' }) }}>Nova Regra</button>
          </div>

          <div className="grid gap-3">
            {rulesByCategory.map(({ category, label, items }) => {
              const isExpanded = expandedCats.has(category)
              return (
                <div key={category} className="card p-0 overflow-hidden">
                  <div className={`flex justify-between items-center p-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors ${isExpanded ? 'bg-[var(--surface-2)] border-b border-[var(--border)]' : ''}`}
                    onClick={() => toggleCat(category)}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[var(--surface-3)] flex items-center justify-center font-bold text-xs">{items.length}</div>
                      <div>
                        <div className="font-bold text-sm">{label}</div>
                        <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{category}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button className="btn h-8 px-3 text-[11px] font-bold bg-[var(--accent-dim)] text-[var(--accent-text)] border-none"
                        onClick={(e) => { e.stopPropagation(); setAddModalCat(category); setModalSearch(items[0]?.pattern ?? ''); setModalSelected(new Set()) }}>+ Adicionar</button>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                        className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="divide-y divide-[var(--border)]">
                      {items.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-3 px-5 hover:bg-[var(--surface-3)] transition-colors group">
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="h-2 w-2 rounded-full bg-[var(--accent)] opacity-40 shrink-0" />
                            <code className="text-sm font-bold truncate">{r.pattern}</code>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="btn h-7 px-2.5 text-[11px]" title="Aplicar em transações pendentes" onClick={() => handleApplyRuleBatch(r.id)}>⚡ Flash</button>
                            <button className="btn h-7 px-2.5 text-[11px]" onClick={() => { setEditingRuleId(r.id); setRuleDraft({ pattern: r.pattern, category: r.category }) }}>Editar</button>
                            <button className="btn h-7 px-2.5 text-[11px] text-[var(--neg)]" onClick={() => { if(confirm('Excluir regra?')) deleteRule(r.id) }}>Excluir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <SectionHead title="Nova Categoria" />
            <div className="flex gap-2 mt-4">
              <input className="fd-input h-11" placeholder="Ex: Investimentos, Presentes…" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button className="btn primary px-6 h-11" disabled={!newCatName.trim() || saving} onClick={async () => {
                setSaving(true); try { await addCategory(newCatName); setNewCatName(''); setToast({ msg: 'Categoria criada!', ok: true }) } catch { setToast({ msg: 'Erro ao criar.', ok: false }) } finally { setSaving(false) }
              }}>Criar</button>
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">Categorias personalizadas aparecem em todos os seletores do sistema. Elas são vinculadas à sua conta.</p>
          </div>

          <div className="card">
            <SectionHead title="Suas Categorias" sub={customCategories.length} />
            <div className="grid gap-2 mt-4">
              {customCategories.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm italic">Nenhuma categoria personalizada criada.</div>
              ) : customCategories.map(c => (
                <div key={c.key} className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="font-semibold text-sm">{c.label}</span>
                  <button className="btn h-7 px-2.5 text-[11px] text-[var(--neg)]" onClick={async () => { if(confirm(`Excluir "${c.label}"?`)) { try { await removeCategory(c.id); setToast({ msg: 'Excluída.', ok: true }) } catch { setToast({ msg: 'Erro ao excluir.', ok: false }) } } }}>Excluir</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rule Suggestion Toast/Dialog */}
      {pendingRule && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4">
          <div className="card shadow-2xl border-2 border-[var(--accent)] animate-bounce-in p-5 bg-[var(--surface)]">
            <h4 className="font-bold text-sm mb-1">Criar regra automática?</h4>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Detectamos <span className="text-[var(--text)] font-bold">{pendingRule.similarCount} transações</span> semelhantes a <code className="bg-[var(--surface-3)] px-1 rounded">{pendingRule.pattern}</code> sem categoria. Deseja automatizar isso?
            </p>
            <div className="flex gap-2">
              <button className="btn primary flex-1" disabled={saving} onClick={applyPendingRule}>{saving ? 'Aplicando…' : 'Sim, classificar todas'}</button>
              <button className="btn flex-1" onClick={() => setPendingRule(null)}>Agora não</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[300] px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 animate-fade-in ${toast.ok ? 'bg-emerald-900/90 border-emerald-500 text-emerald-100' : 'bg-red-900/90 border-red-500 text-red-100'}`}>
          <div className={`h-2 w-2 rounded-full ${toast.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-sm font-bold">{toast.msg}</span>
          <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      {/* Edit Rule Modal */}
      <Dialog open={!!editingRuleId} onOpenChange={() => setEditingRuleId(null)}>
        <div className="grid gap-6 p-1">
          <div>
            <h3 className="text-xl font-bold">{editingRuleId === 'new' ? 'Nova Regra' : 'Editar Regra'}</h3>
            <p className="text-sm text-muted-foreground">Defina o padrão de texto e a categoria destino.</p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Padrão de Texto (Merchant)</label>
              <input className="fd-input" value={ruleDraft.pattern} onChange={(e) => setRuleDraft(p => ({ ...p, pattern: e.target.value }))} placeholder="Ex: Uber, Netflix, Mercado Livre…" />
            </div>
            <div className="grid gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoria Alvo</label>
              <select className="fd-select" value={ruleDraft.category} onChange={(e) => setRuleDraft(p => ({ ...p, category: e.target.value }))}>
                {allCategories.map(c => <option key={c.key} value={c.key}>{c.pt}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn flex-1 h-11" onClick={() => setEditingRuleId(null)}>Cancelar</button>
            <button className="btn primary flex-1 h-11" disabled={!ruleDraft.pattern.trim() || saving} onClick={async () => {
              setSaving(true)
              try {
                if (editingRuleId === 'new') await saveRule(ruleDraft)
                else await updateRule(editingRuleId, ruleDraft)
                setEditingRuleId(null)
                setToast({ msg: 'Regra salva!', ok: true })
              } catch {
                setToast({ msg: 'Erro ao salvar.', ok: false })
              } finally {
                setSaving(false)
              }
            }}>{saving ? 'Salvando…' : 'Salvar Regra'}</button>
          </div>
        </div>
      </Dialog>

      {/* Add Transactions to Rule Modal */}
      <Dialog open={!!addModalCat} onOpenChange={() => setAddModalCat(null)}>
        <div className="grid gap-5 p-1 max-h-[85vh] overflow-hidden flex flex-col">
          <div className="shrink-0">
            <h3 className="text-xl font-bold">Classificar em Lote</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">Alvo:</span>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent-text)] text-xs font-bold uppercase">{translateCategory(addModalCat)}</span>
            </div>
          </div>
          
          <div className="search-wrap shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input className="fd-input" placeholder="Filtrar transações para classificar…" value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} />
          </div>

          <div className="overflow-y-auto pr-1 flex-1">
            <div className="grid gap-2">
              {modalTxs.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground text-sm">Nenhuma transação disponível para este critério.</div>
              ) : modalTxs.map(t => {
                const isSelected = modalSelected.has(t.id)
                return (
                  <div key={t.id} 
                    className={`flex justify-between items-center p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-[var(--accent-dim)] border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--surface-2)]'}`}
                    onClick={() => {
                      setModalSelected(prev => {
                        const n = new Set(prev)
                        if (n.has(t.id)) n.delete(t.id)
                        else n.add(t.id)
                        return n
                      })
                    }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface-3)]'}`}>
                        {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M20 6 9 17l-5-5"/></svg>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{t.description}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          {t.date?.split('-').reverse().slice(0, 2).join('/')} · {translateCategory(t.category)}
                        </div>
                      </div>
                    </div>
                    <Money value={Math.abs(t.amount)} style={{ fontSize: '13px', fontWeight: 700 }} showSymbol={false} />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-[var(--border)] shrink-0">
            <button className="btn flex-1 h-11" onClick={() => setAddModalCat(null)}>Cancelar</button>
            <button className="btn primary flex-1 h-11" disabled={modalSelected.size === 0 || saving} onClick={handleAddTransactionsToRule}>
              {saving ? 'Processando…' : `Classificar ${modalSelected.size} selecionadas`}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
