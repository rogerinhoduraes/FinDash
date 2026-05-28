'use strict'
// v2

const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp }  = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getMessaging }   = require('firebase-admin/messaging')
const axios = require('axios')

initializeApp()
const db = getFirestore()

// ---------------------------------------------------------------------------
// Helper: validate ETL secret from Firestore /config/etl_webhook_secret
// ---------------------------------------------------------------------------
async function validateSecret(req) {
  const incoming = req.headers['x-etl-secret']
  if (!incoming) return false
  const snap = await db.collection('config').doc('etl_webhook_secret').get()
  if (!snap.exists) return false
  return snap.data().value === incoming
}

// ---------------------------------------------------------------------------
// onEtlWebhook — receives data from the Python ETL and writes to Firestore
// POST /etlWebhook
// Headers: X-ETL-Secret: <secret>
// Body: { uid, run_id, bank, accounts[], transactions[], bills[], investments[] }
// ---------------------------------------------------------------------------
exports.etlWebhook = onRequest(
  { cors: false, timeoutSeconds: 120, memory: '512MiB', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const valid = await validateSecret(req)
    if (!valid) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { uid, run_id, bank, accounts = [], transactions = [], bills = [], investments = [] } = req.body

    if (!uid) {
      res.status(400).json({ error: 'uid is required' })
      return
    }

    const runRef = db.collection(`users/${uid}/etl_runs`).doc(run_id ?? db.collection('_').doc().id)

    try {
      // Mark run as in-progress
      await runRef.set({
        startedAt: FieldValue.serverTimestamp(),
        status: 'running',
        bank: bank ?? null,
        counts: { accounts: accounts.length, transactions: transactions.length, bills: bills.length, investments: investments.length },
      }, { merge: true })

      // Batch write accounts
      const BATCH_SIZE = 400
      async function batchWrite(collPath, docs, keyField = 'id') {
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const batch = db.batch()
          docs.slice(i, i + BATCH_SIZE).forEach((doc) => {
            const id = doc[keyField] ?? doc.account_id ?? doc.transaction_id ?? doc.bill_id ?? doc.investment_id
            const ref = db.collection(collPath).doc(String(id ?? db.collection('_').doc().id))
            batch.set(ref, { ...doc, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          })
          await batch.commit()
        }
      }

      await batchWrite(`users/${uid}/accounts`,      accounts,     'account_id')
      await batchWrite(`users/${uid}/transactions`,  transactions, 'transaction_id')
      await batchWrite(`users/${uid}/bills`,         bills,        'bill_id')
      await batchWrite(`users/${uid}/investments`,   investments,  'investment_id')

      // Mark run as success
      await runRef.set({
        status: 'success',
        completedAt: FieldValue.serverTimestamp(),
      }, { merge: true })

      // FCM notification (best-effort)
      try {
        const profileSnap = await db.doc(`users/${uid}/profile/data`).get()
        const fcmToken = profileSnap.exists ? profileSnap.data().fcmToken : null
        if (fcmToken) {
          await getMessaging().send({
            token: fcmToken,
            notification: {
              title: 'FinDash atualizado',
              body: `Dados de ${bank ?? 'todos os bancos'} sincronizados com sucesso.`,
            },
          })
        }
      } catch {
        // FCM failure must not abort the response
      }

      res.status(200).json({
        success: true,
        counts: { accounts: accounts.length, transactions: transactions.length, bills: bills.length, investments: investments.length },
      })
    } catch (err) {
      console.error('etlWebhook error:', err)
      await runRef.set({ status: 'error', error: err.message, completedAt: FieldValue.serverTimestamp() }, { merge: true })
      res.status(500).json({ error: 'Internal error', message: err.message })
    }
  }
)

// ---------------------------------------------------------------------------
// forceEtl — triggers the Python ETL from the Configuracoes page
// POST /forceEtl
// Headers: Authorization: Bearer <Firebase ID token>
// ---------------------------------------------------------------------------
exports.forceEtl = onRequest(
  { cors: true, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    // Verify Firebase ID token
    const authHeader = req.headers.authorization ?? ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!idToken) {
      res.status(401).json({ error: 'Missing auth token' })
      return
    }

    try {
      const { getAuth } = require('firebase-admin/auth')
      await getAuth().verifyIdToken(idToken)
    } catch {
      res.status(401).json({ error: 'Invalid auth token' })
      return
    }

    const etlUrl = process.env.PYTHON_ETL_URL
    if (!etlUrl) {
      res.status(202).json({ message: 'PYTHON_ETL_URL not configured — trigger manually.' })
      return
    }

    try {
      await axios.post(etlUrl, {}, { timeout: 20000 })
      res.status(202).json({ message: 'ETL triggered successfully.' })
    } catch (err) {
      console.error('forceEtl trigger error:', err.message)
      res.status(500).json({ error: 'Failed to trigger ETL', message: err.message })
    }
  }
)
