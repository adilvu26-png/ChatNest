import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createGroup } from '../services/extra'

export default function NewGroup({ onClose }) {
  const { user } = useAuth(); const nav = useNavigate()
  const [name, setName] = useState(''); const [emails, setEmails] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const go = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const { id, missing } = await createGroup(user.uid, name.trim(), emails.split(/[,\s]+/).filter(Boolean))
      if (missing.length) alert('No account found for: ' + missing.join(', '))
      onClose(); nav('/chat/' + id)
    } catch { setErr('Could not create the group.') }
    setBusy(false)
  }
  return (
    <div className="modal" onClick={onClose}>
      <form className="card" onClick={e => e.stopPropagation()} onSubmit={go}>
        <h2>New group</h2>
        <input placeholder="Group name" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Member emails, separated by commas" value={emails} onChange={e => setEmails(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <div className="row2"><button type="button" className="link" onClick={onClose}>Cancel</button><button disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button></div>
      </form>
    </div>
  )
}
