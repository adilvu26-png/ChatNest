import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { logActivity } from '../services/extra'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }), [])

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    const set = online => setDoc(ref, { online, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {})
    const onVis = () => set(document.visibilityState === 'visible')
    const onUnload = () => set(false)
    set(true); logActivity(user.uid, 'session_start')
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('beforeunload', onUnload); set(false) }
  }, [user])

  const register = async (name, email, password) => {
    const { user: u } = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(u, { displayName: name })
    await setDoc(doc(db, 'users', u.uid), { uid: u.uid, name, email: email.toLowerCase(), about: 'Hey there! I am using Chatly.', createdAt: serverTimestamp() })
  }
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)
  return <Ctx.Provider value={{ user, loading, register, login, logout }}>{children}</Ctx.Provider>
}
