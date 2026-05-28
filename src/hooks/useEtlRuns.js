import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useEtlRuns(uid, maxRuns = 20) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    const q = query(
      collection(db, `users/${uid}/etl_runs`),
      orderBy('startedAt', 'desc'),
      limit(maxRuns)
    )
    const unsub = onSnapshot(q, (snap) => {
      setRuns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return () => unsub()
  }, [uid, maxRuns])

  const latest = runs[0] ?? null
  return { runs, latest, loading }
}
