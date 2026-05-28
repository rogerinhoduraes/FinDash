import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useBills(uid) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const q = query(collection(db, `users/${uid}/bills`), orderBy('due_date', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { setError(err); setLoading(false) }
    )
    return () => unsub()
  }, [uid])

  return { bills, loading, error }
}
