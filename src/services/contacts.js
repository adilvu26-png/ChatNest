import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase'
import { findUserByEmail } from './chat'
import { searchUsernames } from './settings'

// Contacts are a list of user ids on your own profile document (no rule changes needed).
export const addContact = (uid, otherUid) =>
  setDoc(doc(db, 'users', uid), { contacts: arrayUnion(otherUid) }, { merge: true })

// Removing a contact keeps the existing chat history in your Chats list.
export const removeContact = (uid, otherUid) =>
  setDoc(doc(db, 'users', uid), { contacts: arrayRemove(otherUid) }, { merge: true })

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A full email = exact match. Anything else = username starts-with search. Never returns yourself.
export async function lookupPeople(text, selfUid) {
  const t = text.trim()
  if (EMAIL.test(t)) {
    const u = await findUserByEmail(t)
    return u && u.uid !== selfUid ? [u] : []
  }
  return searchUsernames(t, selfUid)
}

export async function loadUsers(uids) {
  const snaps = await Promise.all(uids.map(id => getDoc(doc(db, 'users', id))))
  return snaps.filter(s => s.exists()).map(s => ({ uid: s.id, ...s.data() }))
}
