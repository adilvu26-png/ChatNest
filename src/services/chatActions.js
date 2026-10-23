import { doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'

// Clear / delete only affect the signed-in user's own view (like WhatsApp):
// the other person keeps their messages. We remember "cleared up to <time>" on the user's own
// profile document, so no Firestore rule changes are needed.
const resetUnread = (uid, chatId) =>
  updateDoc(doc(db, 'chats', chatId), { [`unread.${uid}`]: 0 }).catch(() => {})

// upToMs = time of the newest message at the moment of clearing (chat.lastAt)
export async function clearChat(uid, chatId, upToMs) {
  await setDoc(doc(db, 'users', uid), { cleared: { [chatId]: upToMs } }, { merge: true })
  await resetUnread(uid, chatId)
}

// Clears the messages and removes the chat from the list. It comes back if a new message arrives.
export async function deleteChat(uid, chatId, upToMs) {
  await setDoc(doc(db, 'users', uid), { cleared: { [chatId]: upToMs }, deletedChats: arrayUnion(chatId) }, { merge: true })
  await resetUnread(uid, chatId)
}

// Is this chat currently deleted for the user? (deleted and nothing newer has arrived)
export const isDeleted = (meDoc, chat) =>
  !!meDoc?.deletedChats?.includes(chat.id) &&
  (chat.lastAt?.toMillis?.() ?? Infinity) <= (meDoc?.cleared?.[chat.id] || 0)
