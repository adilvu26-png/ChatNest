import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
const e = import.meta.env
const app = initializeApp({
  apiKey: e.VITE_FB_API_KEY, authDomain: e.VITE_FB_AUTH_DOMAIN, projectId: e.VITE_FB_PROJECT_ID,
  storageBucket: e.VITE_FB_STORAGE_BUCKET, messagingSenderId: e.VITE_FB_MESSAGING_SENDER_ID, appId: e.VITE_FB_APP_ID,
})
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
