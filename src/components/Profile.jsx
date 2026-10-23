import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listenUser, saveProfile } from '../services/chat'
import AvatarPicker from './AvatarPicker'

export default function Profile({ onClose }) {
  const { user } = useAuth()
  const [u, setU] = useState(null); const [name, setName] = useState(''); const [about, setAbout] = useState('')
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => listenUser(user.uid, d => { setU(d); setName(n => n || d?.name || ''); setAbout(a => a || d?.about || '') }), [user.uid])
  const save = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await saveProfile(user.uid, { name: name.trim(), about: about.trim(), file }); onClose() }
    catch (x) { setErr(x?.message || 'Could not save your profile. Please try again.') }
    setBusy(false)
  }
  return (
    <div className="modal" onClick={onClose}>
      <form className="card" onClick={e => e.stopPropagation()} onSubmit={save}>
        <h2>Your profile</h2>
        <AvatarPicker u={u || { name: user.displayName }} file={file} onChange={setFile} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Display name" required />
        <input value={about} onChange={e => setAbout(e.target.value)} placeholder="About" maxLength={100} />
        {err && <div className="err">{err}</div>}
        <div className="row2"><button type="button" className="link" onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  )
}
