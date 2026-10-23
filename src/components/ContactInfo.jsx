import { useState } from 'react'
import Avatar from './Avatar'
import { Close } from './Icons'
import '../styles-settings.css'

// Contact card for a one-to-one chat. Opens only when the profile in the chat header is clicked.
// Pass a user already filtered by visibleUser().
export default function ContactInfo({ u, onClose, isContact, onAdd, onRemove }) {
  const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false); const [err, setErr] = useState('')
  const seen = u.online ? 'online' : u.lastSeen?.toDate
    ? 'last seen ' + u.lastSeen.toDate().toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    : ''
  const run = async fn => {
    setBusy(true); setErr('')
    try { await fn(); setAsk(false) } catch { setErr('Something went wrong. Please try again.') }
    setBusy(false)
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="card contact-card" role="dialog" aria-label="Contact info" onClick={e => e.stopPropagation()}>
        <button type="button" className="icon-btn contact-x" aria-label="Close" onClick={onClose}><Close size={20} /></button>
        <Avatar viewable size={104} u={u} />
        <h2>{u.name || 'Unknown'}</h2>
        {u.username && <div className="muted">@{u.username}</div>}
        {seen && <small className="muted">{seen}</small>}
        <div className="contact-about">
          <small className="muted">About</small>
          <p>{u.about || 'No info shared.'}</p>
        </div>

        {onAdd && (isContact
          ? (ask
            ? (
              <div className="ci-confirm">
                <p>Remove {u.name || 'this person'} from your contacts? Your chat history stays.</p>
                <div className="row2"><button type="button" className="link" disabled={busy} onClick={() => setAsk(false)}>Cancel</button><button type="button" className="ci-danger" disabled={busy} onClick={() => run(onRemove)}>{busy ? 'Removing…' : 'Remove'}</button></div>
              </div>
            )
            : <button type="button" className="ci-btn danger" onClick={() => setAsk(true)}>Remove from contacts</button>)
          : <button type="button" className="ci-btn" disabled={busy} onClick={() => run(onAdd)}>{busy ? 'Adding…' : 'Add to contacts'}</button>)}
        {err && <div className="err" role="alert">{err}</div>}
      </div>
    </div>
  )
}
