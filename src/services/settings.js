import { doc, getDoc, setDoc, runTransaction, collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// ---------- defaults ----------
export const DEFAULT_PRIVACY = { lastSeen: 'everyone', photo: 'everyone', about: 'everyone', readReceipts: true }
export const DEFAULT_PREFS = { toasts: true }
export const privacyOf = u => ({ ...DEFAULT_PRIVACY, ...(u?.privacy || {}) })
export const prefsOf = u => ({ ...DEFAULT_PREFS, ...(u?.prefs || {}) })

// What `me` is allowed to see of `other`'s profile.
// Like WhatsApp: if you hide your own last seen / online, you cannot see other people's either.
// NOTE: this is enforced in the app UI. Profile data is still readable by signed-in users in Firestore.
export function visibleUser(other, me) {
  if (!other) return other
  const p = privacyOf(other); const m = privacyOf(me)
  const hideSeen = p.lastSeen === 'nobody' || m.lastSeen === 'nobody'
  return {
    ...other,
    photoURL: p.photo === 'nobody' ? undefined : other.photoURL,
    about: p.about === 'nobody' ? '' : other.about,
    online: hideSeen ? false : other.online,
    lastSeen: hideSeen ? null : other.lastSeen,
  }
}

// Save privacy / preference changes (merged into the user's own profile document)
export const saveSettings = (uid, patch) => setDoc(doc(db, 'users', uid), patch, { merge: true })

// ---------- usernames ----------
export const USERNAME_RE = /^[a-z][a-z0-9._]{2,19}$/
export const cleanUsername = v => String(v || '').toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._]/g, '').slice(0, 20)

// Claims `raw` for this user (empty string = remove username). Throws if taken or invalid.
export async function setUsername(uid, raw) {
  const name = cleanUsername(raw)
  if (name && !USERNAME_RE.test(name)) throw new Error('Username must be 3–20 characters, start with a letter, and use only a–z, 0–9, "." or "_".')
  const userRef = doc(db, 'users', uid)
  await runTransaction(db, async tx => {
    const old = (await tx.get(userRef)).data()?.username || ''
    if (name === old) return
    if (name) {
      const ref = doc(db, 'usernames', name)
      const s = await tx.get(ref)
      if (s.exists() && s.data().uid !== uid) throw new Error('That username is already taken.')
      tx.set(ref, { uid })
    }
    if (old) tx.delete(doc(db, 'usernames', old))
    tx.set(userRef, { username: name }, { merge: true })
  })
}

export async function findUserByUsername(raw) {
  const name = cleanUsername(raw)
  if (!name) return null
  const s = await getDoc(doc(db, 'usernames', name))
  if (!s.exists()) return null
  const u = await getDoc(doc(db, 'users', s.data().uid))
  return u.exists() ? u.data() : null
}

// Live search: usernames that START WITH the typed text (case-insensitive), excluding yourself.
export async function searchUsernames(raw, selfUid, max = 8) {
  const p = cleanUsername(raw)
  if (!p) return []
  const snap = await getDocs(query(collection(db, 'users'), where('username', '>=', p), where('username', '<=', p + '\uf8ff'), limit(max + 1)))
  return snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== selfUid).slice(0, max)
}
