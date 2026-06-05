'use strict'
// v2

const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp }  = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getMessaging }   = require('firebase-admin/messaging')
const axios = require('axios')
const Joi = require('joi')
const crypto = require('crypto')

// Constant-time string comparison to avoid leaking the secret via timing.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

initializeApp()
const db = getFirestore()

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
// Accept either a calendar day (YYYY-MM-DD) or a full ISO timestamp, so the
// schema keeps validating during the ETL date-format migration.
const dateLike = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}/)

// Per-record contract for the fields the UI actually depends on. unknown(true)
// keeps it forgiving of extra fields while still catching real schema drift
// (e.g. amount arriving as a string, missing ids, malformed dates).
const transactionSchema = Joi.object({
  transaction_id: Joi.string().required(),
  amount: Joi.number().required(),
  date: dateLike.allow(null, ''),
  account_type: Joi.string().valid('BANK', 'CREDIT', 'INVESTMENT'),
  bank: Joi.string().allow(null, ''),
}).unknown(true)

const etlSchema = Joi.object({
  uid: Joi.string().required(),
  run_id: Joi.string().allow(null, ''),
  bank: Joi.string().allow(null, ''),
  status: Joi.string().valid('running', 'success', 'error'),
  error: Joi.string().allow(null, ''),
  accounts: Joi.array().items(Joi.object().unknown(true)).default([]),
  transactions: Joi.array().items(transactionSchema).default([]),
  bills: Joi.array().items(Joi.object().unknown(true)).default([]),
  investments: Joi.array().items(Joi.object().unknown(true)).default([]),
}).unknown(true)

// ---------------------------------------------------------------------------
// Normalization Helpers
// ---------------------------------------------------------------------------
const BANK_CANONICAL = {
  "nubank":           "Nubank",
  "nu pagamentos":    "Nubank",
  "nu financeira":    "Nubank",
  "nuco":             "Nubank",
  "santander":        "Santander",
  "banco santander":  "Santander",
  "inter":            "Inter",
  "banco inter":      "Inter",
  "pagseguro":        "PagSeguro",
  "bradesco":         "Bradesco",
  "itau":             "Itaú",
  "itaú":             "Itaú",
  "caixa":            "Caixa",
  "bb":               "Banco do Brasil",
  "banco do brasil":  "Banco do Brasil",
  "sicoob":           "Sicoob",
  "sicredi":          "Sicredi",
  "c6":               "C6 Bank",
  "xp":               "XP",
  "btg":              "BTG",
  "mercado pago":     "Mercado Pago",
  "picpay":           "PicPay",
  "avenue":           "Avenue",
  "nomad":            "Nomad",
  "wise":             "Wise",
  "revolut":          "Revolut",
  "safra":            "Safra",
  "banrisul":         "Banrisul",
}

function canonicalBank(raw) {
  if (!raw) return 'Desconhecido'
  const key = raw.toLowerCase().trim()
  for (const [alias, name] of Object.entries(BANK_CANONICAL)) {
    if (key.includes(alias)) return name
  }
  return raw
}

function getMerchantKey(description) {
  if (!description) return ''
  let d = description.toLowerCase()
    .replace(/^(pg\s*\*|pag\s*\*|p\s*\*|compra\s+|pagto\s+|pgto\s+|venda\s+|transf\s+|pix\s+enviado\s+|pix\s+recebido\s+)/g, '')
    .replace(/(\s+\d{2}\/\d{2}|\s+\d{4}|\s+[a-z]{2})$/g, '')
    .replace(/[\*\-\/#@]/g, ' ')
  
  const words = d.trim().split(/\s+/)
  const noise = ['sao', 'pau', 'sp', 'rj', 'mg', 'bh', 'osasco', 'curitiba', 'brasilia', 'br']
  const meaningful = []
  
  for (const w of words) {
    const cleanW = w.replace(/[^a-z0-9]/g, '')
    if (cleanW.length >= 3 && !/^\d+$/.test(cleanW) && !noise.includes(cleanW)) {
      meaningful.push(cleanW)
      if (meaningful.length >= 2) break
    }
  }
  if (meaningful.length === 0) return d.replace(/[^a-z0-9\s]/g, '').trim().slice(0, 25).trim()
  return meaningful.join(' ')
}

function normalizeTx(tx) {
  const updates = {}
  
  const newBank = canonicalBank(tx.bank)
  if (tx.bank !== newBank) updates.bank = newBank

  if (!tx.merchant_key || tx.merchant_key.length < 3) {
    const key = getMerchantKey(tx.description)
    if (key && key !== tx.merchant_key) updates.merchant_key = key
  }

  if (!tx.installment_number || !tx.installment_total) {
    const match = (tx.description || '').match(/(\d+)\s*\/\s*(\d+)/)
    if (match) {
      updates.installment_number = parseInt(match[1], 10)
      updates.installment_total  = parseInt(match[2], 10)
    }
  }

  return Object.keys(updates).length > 0 ? updates : null
}

// ---------------------------------------------------------------------------
// Helper: validate ETL secret, bound to the claimed uid, with brute-force lock
// ---------------------------------------------------------------------------
const LOCK_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 10

// Returns true if the global failure counter is currently tripped. This guards
// the single shared credential regardless of source IP (which is spoofable via
// X-Forwarded-For behind Cloud Run), so attempts can't be spread across IPs.
async function isGloballyLocked(globalRef) {
  const snap = await globalRef.get()
  if (!snap.exists) return false
  const { failures, lastFailure } = snap.data() || {}
  const last = lastFailure?.toDate?.()
  const isRecent = last instanceof Date && last.getTime() > Date.now() - LOCK_WINDOW_MS
  return (failures ?? 0) >= MAX_FAILURES && isRecent
}

// Validates the x-etl-secret header for a specific uid.
//   1. Per-uid secret (config/etl_webhook_secret.secrets[uid]) is preferred —
//      this BINDS the credential to the user, so a leaked secret can only write
//      that user's data.
//   2. Falls back to the legacy global secret (.value), but only if the claimed
//      uid is present in .allowed_uids (when that allowlist exists).
async function validateSecret(req, claimedUid) {
  const incoming = req.headers['x-etl-secret']
  const globalRef = db.doc('_security/etl_brute_force')

  if (await isGloballyLocked(globalRef)) return false
  if (!incoming || !claimedUid) {
    await globalRef.set({ failures: FieldValue.increment(1), lastFailure: FieldValue.serverTimestamp() }, { merge: true })
    return false
  }

  const snap = await db.collection('config').doc('etl_webhook_secret').get()
  if (!snap.exists) return false
  const cfg = snap.data() || {}

  let expected = null
  if (cfg.secrets && typeof cfg.secrets[claimedUid] === 'string') {
    // Preferred path: secret bound to this uid.
    expected = cfg.secrets[claimedUid]
  } else if (cfg.value) {
    // Legacy shared secret — only honored if the uid is explicitly allowed
    // (or no allowlist has been configured yet, for backward compatibility).
    const allow = Array.isArray(cfg.allowed_uids) ? cfg.allowed_uids : null
    if (!allow || allow.includes(claimedUid)) expected = cfg.value
  }

  const isValid = expected != null && safeEqual(expected, incoming)

  if (!isValid) {
    await globalRef.set({ failures: FieldValue.increment(1), lastFailure: FieldValue.serverTimestamp() }, { merge: true })
  } else {
    await globalRef.delete().catch(() => {})
  }

  return isValid
}

// ---------------------------------------------------------------------------
// Helper: per-user cooldown for expensive/maintenance endpoints
// ---------------------------------------------------------------------------
// Returns { ok: true } if the action may run (and stamps the cooldown), or
// { ok: false, retryAfter } if the user invoked it within the window. Prevents
// a single authenticated user from hammering full-collection sweeps / dispatches.
async function checkCooldown(key, uid, windowMs) {
  const ref = db.doc(`_security/cooldowns/${key}/${uid}`)
  const snap = await ref.get()
  if (snap.exists) {
    const last = snap.data()?.lastRun?.toDate?.()
    if (last instanceof Date && last.getTime() > Date.now() - windowMs) {
      return { ok: false, retryAfter: Math.ceil((windowMs - (Date.now() - last.getTime())) / 1000) }
    }
  }
  await ref.set({ lastRun: FieldValue.serverTimestamp() }, { merge: true })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// onEtlWebhook — receives data from the Python ETL and writes to Firestore
// ---------------------------------------------------------------------------
exports.etlWebhook = onRequest(
  { cors: false, timeoutSeconds: 120, memory: '512MiB', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    // Authorize against the uid the payload claims to write, so a leaked
    // secret can't be used to write another user's data.
    const claimedUid = req.body?.uid
    const valid = await validateSecret(req, claimedUid)
    if (!valid) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { error: schemaErr, value: data } = etlSchema.validate(req.body)
    if (schemaErr) {
      res.status(400).json({ error: 'Invalid payload schema', details: schemaErr.details })
      return
    }

    const { uid, run_id, bank, accounts, transactions, bills, investments } = data
    const runRef = db.collection(`users/${uid}/etl_runs`).doc(run_id ?? db.collection('_').doc().id)

    try {
      await runRef.set({
        startedAt: FieldValue.serverTimestamp(),
        status: 'running',
        bank: bank ?? null,
        counts: { accounts: accounts.length, transactions: transactions.length, bills: bills.length, investments: investments.length },
      }, { merge: true })

      const BATCH_SIZE = 400
      async function batchWrite(collPath, docs, keyField) {
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const batch = db.batch()
          const chunk = docs.slice(i, i + BATCH_SIZE)
          
          for (const docData of chunk) {
            const id = docData[keyField] || docData.id
            if (!id) continue

            const ref = db.collection(collPath).doc(String(id))
            
            if (collPath.includes('transactions')) {
              const snap = await ref.get()
              if (snap.exists) {
                const existing = snap.data()
                const incomingCat = docData.category || 'Outros'
                const isIncomingGeneric = ['Outros', 'Others', 'Other'].includes(incomingCat)
                const isExistingSpecific = existing.category && !['Outros', 'Others', 'Other'].includes(existing.category)
                
                if (isIncomingGeneric && isExistingSpecific) {
                  delete docData.category
                }
              }
            }

            batch.set(ref, { ...docData, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
          }
          await batch.commit()
        }
      }

      await batchWrite(`users/${uid}/accounts`,      accounts,     'account_id')
      await batchWrite(`users/${uid}/transactions`,  transactions, 'transaction_id')
      await batchWrite(`users/${uid}/bills`,         bills,        'bill_id')
      await batchWrite(`users/${uid}/investments`,   investments,  'investment_id')

      await runRef.set({ status: 'success', completedAt: FieldValue.serverTimestamp() }, { merge: true })

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
      } catch {}

      res.status(200).json({ success: true, counts: { accounts: accounts.length, transactions: transactions.length, bills: bills.length, investments: investments.length } })
    } catch (err) {
      console.error('etlWebhook error:', err)
      await runRef.set({ status: 'error', error: err.message, completedAt: FieldValue.serverTimestamp() }, { merge: true })
      res.status(500).json({ error: 'Internal error' })
    }
  }
)

// ---------------------------------------------------------------------------
// forceEtl — triggers the Python ETL from the Configuracoes page
// ---------------------------------------------------------------------------
exports.forceEtl = onRequest(
  { cors: true, timeoutSeconds: 30, invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const authHeader = req.headers.authorization ?? ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!idToken) {
      res.status(401).json({ error: 'Missing auth token' })
      return
    }

    let callerUid
    try {
      const { getAuth } = require('firebase-admin/auth')
      const decoded = await getAuth().verifyIdToken(idToken)
      callerUid = decoded.uid
    } catch {
      res.status(401).json({ error: 'Invalid auth token' })
      return
    }

    // Throttle: a user-triggered ETL run takes ~2 min; don't let it be spammed.
    const cd = await checkCooldown('forceEtl', callerUid, 2 * 60 * 1000)
    if (!cd.ok) {
      res.status(429).json({ error: 'ETL já acionado recentemente. Aguarde um pouco.', retryAfter: cd.retryAfter })
      return
    }

    const token    = process.env.GITHUB_TOKEN
    const repo     = process.env.GITHUB_REPO     || 'rogerinhoduraes/FinDash'
    const workflow = process.env.GITHUB_WORKFLOW  || 'etl.yml'
    const branch   = process.env.GITHUB_BRANCH   || 'main'

    if (!token) {
      res.status(202).json({ message: 'ETL agendado. Próxima execução automática em breve.' })
      return
    }

    try {
      await axios.post(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
        { ref: branch },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          timeout: 15000,
        }
      )
      res.status(202).json({ message: 'ETL iniciado! Os dados serão atualizados em ~2 minutos.' })
    } catch (err) {
      console.error('forceEtl GitHub dispatch error:', err.message)
      res.status(500).json({ error: 'Falha ao acionar ETL' })
    }
  }
)

// ---------------------------------------------------------------------------
// normalizeDatabase — sweeps the database and applies latest normalization
// ---------------------------------------------------------------------------
exports.normalizeDatabase = onRequest(
  { cors: true, timeoutSeconds: 540, memory: '1GiB', invoker: 'public' },
  async (req, res) => {
    const authHeader = req.headers.authorization ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    let uid
    try {
      const { getAuth } = require('firebase-admin/auth')
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7))
      uid = decoded.uid
    } catch {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    // Throttle: this sweeps the user's entire transactions/accounts/bills
    // collections on a 540s/1GiB function — cap how often it can be invoked.
    const cd = await checkCooldown('normalizeDatabase', uid, 10 * 60 * 1000)
    if (!cd.ok) {
      res.status(429).json({ error: 'Normalização já executada recentemente.', retryAfter: cd.retryAfter })
      return
    }

    console.info(`[Maintenance] Starting normalization for user ${uid}`)

    let txCount = 0
    let accCount = 0
    let billCount = 0

    try {
      // 1. Transactions
      const txsSnap = await db.collection(`users/${uid}/transactions`).get()
      let txBatch = db.batch()
      let txInBatch = 0
      
      for (const doc of txsSnap.docs) {
        const updates = normalizeTx(doc.data())
        if (updates) {
          txBatch.update(doc.ref, { ...updates, updatedAt: FieldValue.serverTimestamp() })
          txCount++
          txInBatch++
        }
        if (txInBatch >= 450) {
          await txBatch.commit()
          txBatch = db.batch() // Re-initialize after commit
          txInBatch = 0
        }
      }
      if (txInBatch > 0) await txBatch.commit()

      // 2. Accounts
      const accsSnap = await db.collection(`users/${uid}/accounts`).get()
      for (const doc of accsSnap.docs) {
        const data = doc.data()
        const newBank = canonicalBank(data.bank_name || data.bank)
        if (data.bank_name !== newBank || data.bank !== newBank) {
          await doc.ref.update({ bank_name: newBank, bank: newBank, updatedAt: FieldValue.serverTimestamp() })
          accCount++
        }
      }

      // 3. Bills
      const billsSnap = await db.collection(`users/${uid}/bills`).get()
      for (const doc of billsSnap.docs) {
        const data = doc.data()
        const newBank = canonicalBank(data.bank)
        if (data.bank !== newBank) {
          await doc.ref.update({ bank: newBank, updatedAt: FieldValue.serverTimestamp() })
          billCount++
        }
      }

      res.status(200).json({
        success: true,
        message: 'Normalization completed',
        stats: { transactions: txCount, accounts: accCount, bills: billCount }
      })
    } catch (err) {
      console.error('[Maintenance] Normalization failed:', err)
      res.status(500).json({ error: 'Normalization failed' })
    }
  }
)
