import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        await ensureUserProfile(fbUser)
        setUser(fbUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function ensureUserProfile(fbUser) {
    const ref = doc(db, 'users', fbUser.uid, 'profile', 'data')
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: fbUser.displayName ?? '',
        email: fbUser.email,
        photoURL: fbUser.photoURL ?? '',
        createdAt: serverTimestamp(),
      })
    }
  }

  async function signIn(email, password) {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(translateError(e.code))
      throw e
    }
  }

  async function signUp(email, password, displayName) {
    setError(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName) await updateProfile(cred.user, { displayName })
      await ensureUserProfile(cred.user)
    } catch (e) {
      setError(translateError(e.code))
      throw e
    }
  }

  async function signInGoogle() {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError(translateError(e.code))
        throw e
      }
    }
  }

  async function signOut() {
    await fbSignOut(auth)
  }

  async function resetPassword(email) {
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (e) {
      setError(translateError(e.code))
      throw e
    }
  }

  return { user, loading, error, signIn, signUp, signInGoogle, signOut, resetPassword }
}

function translateError(code) {
  const map = {
    'auth/user-not-found':   'E-mail não encontrado.',
    'auth/wrong-password':   'Senha incorreta.',
    'auth/email-already-in-use': 'E-mail já cadastrado.',
    'auth/weak-password':    'Senha muito fraca (mínimo 6 caracteres).',
    'auth/invalid-email':    'E-mail inválido.',
    'auth/too-many-requests':'Muitas tentativas. Aguarde e tente novamente.',
    'auth/network-request-failed': 'Erro de rede. Verifique sua conexão.',
  }
  return map[code] ?? 'Erro de autenticação. Tente novamente.'
}
