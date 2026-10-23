import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { openChat } from '../services/chat'
import { addContact, removeContact, lookupPeople, loadUsers } from '../services/contacts'
import { visibleUser } from '../services/settings'
import Avatar from './Avatar'
import ChatMenu from './ChatMenu'
import { Close } from './Icons'

// Contacts tab: search people to add, see your contacts, message or remove them.
export default function ContactsPanel({ meDoc }) {
  const { user } = useAuth(); const nav = useNavigate()
  const contacts = meDoc?.contacts || []
  const [q, setQ] = useState(''); const [res, setRes] = useState([])
  const [searching, setSearching] = useState(false); const [done, setDone] = useState(false)
  const [msg, setMsg] = useState(''); const [cache, setCache] = useState({})

  // Load profiles for contacts we have not loaded yet
  const key = contacts.join()
  useEffect(() => {
    const missing = contacts.filter(id => !cache[id])
    if (!missing.length) return
    let dead = false
    loadUsers(missing).then(list => { if (!dead) setCache(c => ({ ...c, ...Object.fromEntries(list.map(u => [u.uid, u])) })) }).catch(() => {})
    return () => { dead = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live search (starts after 2 characters)
  useEffect(() => {
    const t = q.trim(); setMsg('')
    if (t.replace(/^@/, '').length < 2) { setRes([]); setDone(false); setSearching(false); return }
    let dead = false
    setSearching(true); setDone(false)
    const id = setTimeout(async () => {
      try { const r = await lookupPeople(t, user.uid); if (!dead) { setRes(r); setDone(true) } }
      catch { if (!dead) { setRes([]); setMsg('Search failed. Check your connection and try again.') } }
      if (!dead) setSearching(false)
    }, 300)
    return () => { dead = true; clearTimeout(id) }
  }, [q, user.uid])

  const message = async u => {
    try { const id = await openChat(user.uid, u.uid); nav('/chat/' + id); setQ('') }
    catch { setMsg('Could not open that chat. Please try again.') }
  }
  const add = async u => {
    try { setCache(c => ({ ...c, [u.uid]: u })); await addContact(user.uid, u.uid) }
    catch { setMsg('Could not add that contact. Please try again.') }
  }

  const list = contacts.map(id => cache[id]).filter(Boolean).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const sub = u => (u.username ? '@' + u.username : '') + (u.about && u.username ? ' · ' : '') + (u.about || '')

  return (
    <div className="contacts-panel">
      <form className="search-box" onSubmit={e => e.preventDefault()}>
        <input placeholder="Add contact by @username or email" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Escape' && setQ('')} aria-label="Find a person to add" />
        {q && <button type="button" className="search-x" aria-label="Clear search" onClick={() => setQ('')}><Close size={16} /></button>}
      </form>
      {msg && <div className="err pad" role="alert">{msg}</div>}

      {q.trim() ? (
        <div className="list search-results">
          {res.map(u => {
            const v = visibleUser(u, meDoc); const has = contacts.includes(u.uid)
            return (
              <div key={u.uid} className="row-wrap">
                <button type="button" className="row" onClick={() => message(u)}>
                  <Avatar u={v} />
                  <span className="grow"><b>{u.name || 'Unknown'}</b><small>{u.username ? '@' + u.username : u.email}</small></span>
                </button>
                {has ? <span className="added">In contacts</span> : <button type="button" className="mini-btn" onClick={() => add(u)}>Add</button>}
              </div>
            )
          })}
          {searching && <div className="pad muted">Searching…</div>}
          {!searching && done && !res.length && <div className="pad muted">No one found. They may not have set a username yet, so try their full email address.</div>}
          {!searching && !done && <div className="pad muted">Type at least 2 letters of a username, or a full email address.</div>}
        </div>
      ) : (
        <div className="list">
          <div className="sect">My contacts{contacts.length > 0 && <span> · {contacts.length}</span>}</div>
          {list.map(u => {
            const v = visibleUser(u, meDoc)
            return (
              <div key={u.uid} className="row-wrap">
                <button type="button" className="row" onClick={() => message(u)}>
                  <Avatar u={v} online={v?.online} />
                  <span className="grow"><b>{u.name || 'Unknown'}</b><small>{sub(v) || 'Hey there! I am using ChatNest.'}</small></span>
                </button>
                <ChatMenu className="fav-btn cm-btn" label="Contact options" items={[
                  { label: 'Message', onClick: () => message(u) },
                  { label: 'Remove contact', danger: true,
                    confirm: { title: 'Remove contact?', body: (u.name || 'This person') + ' will be removed from your contacts. Your chat history stays in your Chats list.', button: 'Remove' },
                    onClick: () => removeContact(user.uid, u.uid) },
                ]} />
              </div>
            )
          })}
          {!contacts.length && <div className="pad muted">No contacts yet. Search above by @username or email and tap Add.</div>}
          {contacts.length > 0 && !list.length && <div className="pad muted">Loading contacts…</div>}
        </div>
      )}
    </div>
  )
}
