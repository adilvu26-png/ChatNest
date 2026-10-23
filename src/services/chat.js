import { db } from '../firebase'
import { updateProfile } from 'firebase/auth'
import { logActivity } from './extra'
import { auth } from '../firebase'
import {
  doc, setDoc, getDoc, addDoc, updateDoc, collection, query, where, orderBy, getDocs,
  onSnapshot, serverTimestamp, increment, arrayUnion, deleteField, writeBatch,
} from 'firebase/firestore'
const CLOUDINARY_CLOUD_NAME = 'c3dbwwya'
const CLOUDINARY_UPLOAD_PRESET = 'chatnest_media'

async function uploadToCloudinary(file) {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Cloudinary upload error:', data)
    throw new Error(data.error?.message || 'Cloudinary upload failed')
  }

  return data
}

export const chatIdFor = (a, b) => [a, b].sort().join('_')

export async function findUserByEmail(email) {
  const s = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase())))
  return s.docs.map(d => d.data())[0] || null
}

export async function openChat(me, other) {
  const id = chatIdFor(me, other)
  const ref = doc(db, 'chats', id)
  let exists = false
  try { exists = (await getDoc(ref)).exists() } catch { /* not readable yet = does not exist */ }
  if (!exists) await setDoc(ref, { members: [me, other], lastMessage: '', lastAt: serverTimestamp(), typing: {}, unread: {} })
  return id
}

export const listenChats = (me, cb) =>
  onSnapshot(query(collection(db, 'chats'), where('members', 'array-contains', me)), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0))))

export const listenMessages = (chatId, cb) =>
  onSnapshot(query(collection(db, 'chats', chatId, 'messages'), orderBy('at')), s =>
    cb(s.docs.map(d => ({ id: d.id, ...d.data() }))))

export const listenUser = (uid, cb) => onSnapshot(doc(db, 'users', uid), s => cb(s.data()))

// Short label for a message that only has an attachment (chat list, reply preview).
export const attLabel = a =>
  !a ? '' : a.isVoice ? '🎤 Voice message' : a.isImage ? '📷 Photo' : a.isVideo ? '🎥 Video' : a.isAudio ? '🎵 Audio' : '📎 ' + a.name

export async function sendMessage(chatId, me, other, text, replyTo = null, attachment = null) {
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    from: me, text, attachment, at: serverTimestamp(), status: 'sent', replyTo, edited: false, deletedAll: false, deletedFor: [], reactions: {},
  })
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text || attLabel(attachment), lastAt: serverTimestamp(), ...Object.fromEntries([].concat(other).map(o => [`unread.${o}`, increment(1)])), [`typing.${me}`]: false,
  })
  logActivity(me, 'message_sent', chatId)
}

export const setTyping = (chatId, me, v) => updateDoc(doc(db, 'chats', chatId), { [`typing.${me}`]: v }).catch(() => {})

export async function markDelivered(chatId, me) {
  const s = await getDocs(query(collection(db, 'chats', chatId, 'messages'), where('status', '==', 'sent')))
  const b = writeBatch(db); let n = 0
  s.docs.forEach(d => { if (d.data().from !== me) { b.update(d.ref, { status: 'delivered' }); n++ } })
  if (n) await b.commit()
}

export async function markRead(chatId, me, msgs) {
  const b = writeBatch(db); let n = 0
  msgs.forEach(m => { if (m.from !== me && m.status !== 'read') { b.update(doc(db, 'chats', chatId, 'messages', m.id), { status: 'read' }); n++ } })
  if (n) await b.commit()
  await updateDoc(doc(db, 'chats', chatId), { [`unread.${me}`]: 0 }).catch(() => {})
}

export const editMessage = (chatId, id, text) => updateDoc(doc(db, 'chats', chatId, 'messages', id), { text, edited: true })
export const deleteForMe = (chatId, id, me) => updateDoc(doc(db, 'chats', chatId, 'messages', id), { deletedFor: arrayUnion(me) })
export const deleteForAll = (chatId, id) => updateDoc(doc(db, 'chats', chatId, 'messages', id), { deletedAll: true, text: '' })
// One emoji reaction per person per message. Pass emoji = null to remove yours.
export const reactToMessage = (chatId, id, me, emoji) =>
  updateDoc(doc(db, 'chats', chatId, 'messages', id), { [`reactions.${me}`]: emoji || deleteField() })

// `extra` carries voice-note details: { isVoice, duration, wave }
export async function uploadChatFile(chatId, file, extra = {}) {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File is larger than 10 MB')
  }

  const data = await uploadToCloudinary(file)
  const type = file.type || ''

  return {
    url: data.secure_url,
    name: file.name,
    type,
    isImage: type.startsWith('image/'),
    isVideo: type.startsWith('video/'),
    isAudio: type.startsWith('audio/'),
    ...extra,
  }
}

export async function saveProfile(uid, { name, about, file }) {
  const data = { name, about }

  if (file) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('Profile image is larger than 3 MB')
    }

    const uploaded = await uploadToCloudinary(file)
    data.photoURL = uploaded.secure_url
  }

  await setDoc(doc(db, 'users', uid), data, { merge: true })

  await updateProfile(auth.currentUser, {
    displayName: name,
    ...(data.photoURL ? { photoURL: data.photoURL } : {}),
  })

  logActivity(uid, 'profile_updated')
}

export { getNames } from './extra'
