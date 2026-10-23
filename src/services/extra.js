import { db } from '../firebase'
import {
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  orderBy,
  limit,
  Timestamp,
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

const userByEmail = async email =>
  (
    await getDocs(
      query(
        collection(db, 'users'),
        where('email', '==', email.trim().toLowerCase())
      )
    )
  ).docs[0]?.data() || null

export async function getNames(uids) {
  const out = {}

  await Promise.all(
    uids.map(async u => {
      out[u] =
        (await getDoc(doc(db, 'users', u))).data()?.name || 'Unknown'
    })
  )

  return out
}

// ---- Activity log + snapshots

export const logActivity = (uid, type, detail = '') =>
  addDoc(collection(db, 'users', uid, 'activity'), {
    type,
    detail,
    at: serverTimestamp(),
  }).catch(() => {})

export const listenActivity = (me, cb) =>
  onSnapshot(
    query(
      collection(db, 'users', me, 'activity'),
      orderBy('at', 'desc'),
      limit(50)
    ),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })))
  )

export async function takeSnapshot(me) {
  const chats = (
    await getDocs(
      query(collection(db, 'chats'), where('members', 'array-contains', me))
    )
  ).docs.map(d => d.data())

  const st = await getDocs(
    query(collection(db, 'statuses'), where('uid', '==', me))
  )

  await logActivity(
    me,
    'snapshot',
    JSON.stringify({
      chats: chats.filter(c => !c.isGroup).length,
      groups: chats.filter(c => c.isGroup).length,
      unread: chats.reduce(
        (n, c) => n + (c.unread?.[me] || 0),
        0
      ),
      statuses: st.size,
    })
  )
}

// ---- Groups

export async function createGroup(me, name, emails) {
  const found = []
  const missing = []

  for (const e of emails) {
    const u = await userByEmail(e)

    if (u) {
      found.push(u.uid)
    } else {
      missing.push(e)
    }
  }

  const r = await addDoc(collection(db, 'chats'), {
    isGroup: true,
    name,
    photoURL: '',
    members: [...new Set([me, ...found])],
    admins: [me],
    createdBy: me,
    lastMessage: 'Group created',
    lastAt: serverTimestamp(),
    typing: {},
    unread: {},
  })

  logActivity(me, 'group_created', name)

  return { id: r.id, missing }
}

export async function addMember(chatId, me, email) {
  const u = await userByEmail(email)

  if (!u) {
    throw new Error('No user with that email')
  }

  await updateDoc(doc(db, 'chats', chatId), {
    members: arrayUnion(u.uid),
  })

  logActivity(me, 'member_added', email)
}

export const removeMember = (chatId, uid) =>
  updateDoc(doc(db, 'chats', chatId), {
    members: arrayRemove(uid),
    admins: arrayRemove(uid),
  })

export const makeAdmin = (chatId, uid) =>
  updateDoc(doc(db, 'chats', chatId), {
    admins: arrayUnion(uid),
  })

export async function saveGroup(chatId, { name, file }) {
  const d = { name }

  if (file) {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('Group image is larger than 3 MB')
    }

    const uploaded = await uploadToCloudinary(file)
    d.photoURL = uploaded.secure_url
  }

  await updateDoc(doc(db, 'chats', chatId), d)
}

// ---- Status (24h, audience = people you have a one-to-one chat with)

export async function postStatus(me, name, { text, bg, file }) {
  const chats = (
    await getDocs(
      query(collection(db, 'chats'), where('members', 'array-contains', me))
    )
  ).docs.map(d => d.data())

  const audience = [
    ...new Set(
      chats
        .filter(c => !c.isGroup)
        .flatMap(c => c.members)
        .filter(x => x !== me)
    ),
  ]

  let imageURL = ''

  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Status image is larger than 5 MB')
    }

    const uploaded = await uploadToCloudinary(file)
    imageURL = uploaded.secure_url
  }

  await addDoc(collection(db, 'statuses'), {
    uid: me,
    name,
    text,
    bg,
    imageURL,
    audience,
    viewers: {},
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 864e5),
  })

  logActivity(
    me,
    'status_posted',
    text.slice(0, 40) || 'photo'
  )
}

export function listenStatuses(me, cb) {
  let a = []
  let b = []

  const emit = () =>
    cb(
      [...a, ...b]
        .filter(s => s.expiresAt?.toMillis() > Date.now())
        .sort(
          (x, y) =>
            (x.createdAt?.seconds || 0) -
            (y.createdAt?.seconds || 0)
        )
    )

  const map = s =>
    s.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }))

  const u1 = onSnapshot(
    query(
      collection(db, 'statuses'),
      where('audience', 'array-contains', me)
    ),
    s => {
      a = map(s)
      emit()
    }
  )

  const u2 = onSnapshot(
    query(
      collection(db, 'statuses'),
      where('uid', '==', me)
    ),
    s => {
      b = map(s)
      emit()
    }
  )

  return () => {
    u1()
    u2()
  }
}

export const viewStatus = (id, me) =>
  updateDoc(doc(db, 'statuses', id), {
    [`viewers.${me}`]: serverTimestamp(),
  })

export const deleteStatus = id =>
  deleteDoc(doc(db, 'statuses', id))
