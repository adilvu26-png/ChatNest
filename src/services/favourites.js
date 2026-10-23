import { doc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase'

// Favourite chat ids live on the user's own profile document (already writable by the user,
// so no Firestore rule changes are needed).
export const toggleFavourite = (uid, chatId, on) =>
  setDoc(doc(db, 'users', uid), { favourites: on ? arrayUnion(chatId) : arrayRemove(chatId) }, { merge: true })
