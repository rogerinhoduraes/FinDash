import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useTransactions(uid, options = {}) {
  const { maxDocs = 500, bankFilter, categoryFilter, startDate, endDate } = options
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    const constraints = [orderBy('date', 'desc'), limit(maxDocs)]
    if (bankFilter)     constraints.push(where('bank', '==', bankFilter))
    if (categoryFilter) constraints.push(where('category', '==', categoryFilter))
    if (startDate)      constraints.push(where('date', '>=', startDate))
    if (endDate)        constraints.push(where('date', '<=', endDate))

    const q = query(collection(db, `users/${uid}/transactions`), ...constraints)
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { setError(err); setLoading(false) }
    )
    return () => unsub()
  }, [uid, maxDocs, bankFilter, categoryFilter, startDate, endDate])

  return { transactions, loading, error }
}
