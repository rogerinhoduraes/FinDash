import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useInvestments(uid) {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const q = query(collection(db, `users/${uid}/investments`), orderBy('value', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvestments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { setError(err); setLoading(false) }
    )
    return () => unsub()
  }, [uid])

  return { investments, loading, error }
}
