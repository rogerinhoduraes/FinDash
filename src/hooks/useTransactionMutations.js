import { useCallback } from 'react'
import { doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const BATCH_LIMIT = 500

/**
 * Shared write-path for transaction category mutations.
 *
 * The read path is abstracted behind hooks, but pages were issuing raw Firestore
 * writes inline (Transacoes, CartaoCredito, Classificacao, Header) with duplicated
 * batch-chunking and inconsistent error handling. This centralizes the writes so
 * there is one place to evolve invariants (batching, future provenance flags, …).
 */
export function useTransactionMutations(uid) {
  const txDoc = useCallback((id) => doc(db, `users/${uid}/transactions`, id), [uid])

  // Update a single transaction's category.
  const setCategory = useCallback(async (id, category) => {
    if (!uid || !id || !category) return
    await updateDoc(txDoc(id), { category })
  }, [uid, txDoc])

  // Update many transactions' category, committing in chunks of 500
  // (Firestore's batch write limit).
  const setCategoryBulk = useCallback(async (ids, category) => {
    if (!uid || !category || !ids?.length) return 0
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db)
      for (const id of ids.slice(i, i + BATCH_LIMIT)) {
        batch.update(txDoc(id), { category })
      }
      await batch.commit()
    }
    return ids.length
  }, [uid, txDoc])

  return { setCategory, setCategoryBulk }
}
