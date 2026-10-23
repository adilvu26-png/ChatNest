import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { listenChats, listenUser, findUserByEmail, openChat, markDelivered } from '../services/chat'
import Avatar from './Avatar'
import { Close } from './Icons'
import Settings, { GearIcon } from './Settings'
import NewGroup from './NewGroup'
import StatusPanel from './StatusPanel'
import ActivityPanel from './ActivityPanel'
import ThemeToggle from './ThemeToggle'
import { listenStatuses } from '../services/extra'
import { toggleFavourite } from '../services/favourites'
import { visibleUser, cleanUsername } from '../services/settings'
import { lookupPeople } from '../services/contacts'
import ContactsPanel from './ContactsPanel'
import { clearChat, deleteChat, isDeleted } from '../services/chatActions'
import ChatMenu, { chatMenuItems } from './ChatMenu'

import { AI_NAME } from '../services/ai'
import { ChatsIcon, UsersIcon, StatusIcon, ActivityIcon, Star, Sparkle } from './NavIcons'
import '../styles-v2.css'

const ContactsIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
  </svg>
)
const TAB_ICON = { chats: ChatsIcon, contacts: ContactsIcon, groups: UsersIcon, status: StatusIcon, activity: ActivityIcon }

// Time shown on the right of a chat row: clock time today, "Yesterday", or a short date
function when(t) {
  const d = t?.toDate?.(); if (!d) return ''
  const now = new Date(); const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}
const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['fav', 'Favourites'], ['archived', 'Archived']]

// Archived chat ids live on the user's own profile document (same place as favourites).
const setArchived = (uid, chatId, on) =>
  setDoc(doc(db, 'users', uid), { archived: on ? arrayUnion(chatId) : arrayRemove(chatId) }, { merge: true })

const ArchiveIcon = ({ size = 18, undo }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    {undo ? <path d="m9 15 3-3 3 3M12 12v6" /> : <path d="M10 12h4" />}
  </svg>
)

function Row({ chat, me, meDoc, active, fav, archived, onClick, onFav, onArchive, onClear, onDelete }) {
  const other = chat.isGroup ? null : chat.members.find(m => m !== me)
  const [u, setU] = useState(null)
  useEffect(() => (other ? listenUser(other, setU) : undefined), [other])
  const vu = visibleUser(u, meDoc)
  const shown = chat.isGroup ? { name: chat.name, photoURL: chat.photoURL } : vu
  const n = chat.unread?.[me] || 0
  // After "Clear chat" the preview stays empty until a newer message arrives
  const cleared = meDoc?.cleared?.[chat.id] || 0
  const preview = cleared && (chat.lastAt?.toMillis?.() ?? Infinity) <= cleared ? '' : chat.lastMessage
  return (
    <div className={'row-wrap' + (active ? ' active' : '')}>
      <button className={'row' + (active ? ' active' : '') + (n > 0 ? ' unread' : '')} onClick={onClick}>
        <Avatar u={shown} online={!chat.isGroup && vu?.online} />
        <span className="grow">
          <b>{shown?.name || '…'}{fav && <i className="fav-mark" title="Favourite"><Star size={13} filled /></i>}</b>
          <small>{preview || 'No messages yet'}</small>
        </span>
        <span className="meta-col">
          {preview && <small className="when">{when(chat.lastAt)}</small>}
          {n > 0 && <span className="badge">{n > 99 ? '99+' : n}</span>}
        </span>
      </button>
      <ChatMenu className="fav-btn cm-btn" label="Chat options" items={chatMenuItems({ isGroup: chat.isGroup, fav, onFav, archived, onArchive, onClear, onDelete })} />
    </div>
  )
}

export default function Sidebar({ activeId }) {
  const { user } = useAuth(); const nav = useNavigate()
  const [chats, setChats] = useState([]); const [q, setQ] = useState(''); const [msg, setMsg] = useState('')
  const [mine, setMine] = useState(null); const [statuses, setStatuses] = useState([]); const [prof, setProf] = useState(false); const [grp, setGrp] = useState(false); const [tab, setTab] = useState('chats'); const [toasts, setToasts] = useState([]); const [filter, setFilter] = useState('all'); const [res, setRes] = useState([]); const [searching, setSearching] = useState(false); const [done, setDone] = useState(false)
  const prev = useRef(null); const active = useRef(activeId); active.current = activeId
  const mineRef = useRef(null); mineRef.current = mine

  useEffect(() => listenUser(user.uid, setMine), [user.uid])
  useEffect(() => listenStatuses(user.uid, setStatuses), [user.uid])

  useEffect(() => listenChats(user.uid, async c => {
    setChats(c)
    c.forEach(x => (x.unread?.[user.uid] || 0) > 0 && markDelivered(x.id, user.uid))
    if (prev.current) for (const x of c) {
      const n = x.unread?.[user.uid] || 0
      if (n > (prev.current[x.id] || 0) && x.id !== active.current && mineRef.current?.prefs?.toasts !== false) {
        const other = x.members.find(m => m !== user.uid)
        const title = x.isGroup ? x.name : (await getDoc(doc(db, 'users', other))).data()?.name || 'New message'
        const t = { id: Date.now() + x.id, chatId: x.id, title, body: x.lastMessage }
        setToasts(a => [...a, t]); setTimeout(() => setToasts(a => a.filter(y => y.id !== t.id)), 5000)
      }
    }
    prev.current = Object.fromEntries(c.map(x => [x.id, x.unread?.[user.uid] || 0]))
  }), [user.uid])

  // Chats the user deleted stay hidden until a newer message arrives
  const alive = chats.filter(c => !isDeleted(mine, c))
  const direct = alive.filter(c => !c.isGroup); const groups = alive.filter(c => c.isGroup)
  const unreadOf = a => a.reduce((n, c) => n + (c.unread?.[user.uid] || 0), 0)
  // New = statuses from other people that I have not opened yet
  const newStatus = statuses.filter(s => s.uid !== user.uid && !s.viewers?.[user.uid]).length

  // Filters (All / Unread / Favourites / Archived) apply to the Chats and Groups lists.
  // Archived chats are hidden from every filter except "Archived".
  const favs = mine?.favourites || []
  const arch = mine?.archived || []
  const isUnread = c => (c.unread?.[user.uid] || 0) > 0
  const applyFilter = a => {
    if (filter === 'archived') return a.filter(c => arch.includes(c.id))
    const live = a.filter(c => !arch.includes(c.id))
    return filter === 'unread' ? live.filter(isUnread) : filter === 'fav' ? live.filter(c => favs.includes(c.id)) : live
  }
  const unreadChats = (tab === 'groups' ? groups : direct).filter(c => isUnread(c) && !arch.includes(c.id)).length
  const archivedCount = (tab === 'groups' ? groups : direct).filter(c => arch.includes(c.id)).length
  const emptyText = what => filter === 'unread' ? 'No unread ' + what + '.' : filter === 'fav' ? 'No favourites yet. Tap the star on a chat to add it.' : filter === 'archived' ? 'No archived ' + what + '. Use the archive button on a chat to hide it here.' : 'No ' + what + ' yet.'
  const renderRows = a => applyFilter(a).map(c => <Row key={c.id} chat={c} me={user.uid} meDoc={mine} active={c.id === activeId} fav={favs.includes(c.id)} archived={arch.includes(c.id)} onClick={() => nav('/chat/' + c.id)} onFav={() => toggleFavourite(user.uid, c.id, !favs.includes(c.id))} onArchive={() => setArchived(user.uid, c.id, !arch.includes(c.id))} onClear={() => clearChat(user.uid, c.id, c.lastAt?.toMillis?.() ?? Date.now())} onDelete={async () => { await deleteChat(user.uid, c.id, c.lastAt?.toMillis?.() ?? Date.now()); if (c.id === activeId) nav('/chat') }} />)
  const filterBar = (
    <div className="filters" role="group" aria-label="Filter chats">
      {FILTERS.map(([k, l]) => <button key={k} type="button" className={'fchip' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}{k === 'unread' && unreadChats > 0 && <span className="fcount">{unreadChats}</span>}{k === 'archived' && archivedCount > 0 && <span className="fcount fcount-mute">{archivedCount}</span>}</button>)}
    </div>
  )

  const total = chats.reduce((n, c) => n + (c.unread?.[user.uid] || 0), 0)
  useEffect(() => { document.title = total ? `(${total}) Chatly` : 'Chatly' }, [total])

  // Live search: runs shortly after you stop typing
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

  const openUser = async u => {
    try { const id = await openChat(user.uid, u.uid); nav('/chat/' + id); setQ(''); setRes([]) }
    catch { setMsg('Could not open that chat. Please try again.') }
  }

  // Enter: open the match straight away when it is clear who the person is
  const search = async e => {
    e.preventDefault()
    const t = q.trim(); if (!t) return
    setMsg(''); setSearching(true)
    try {
      const r = await lookupPeople(t, user.uid); setRes(r); setDone(true)
      const exact = r.find(u => u.username === cleanUsername(t))
      if (r.length === 1) await openUser(r[0]); else if (exact) await openUser(exact)
    } catch { setMsg('Search failed. Check your connection and try again.') }
    setSearching(false)
  }

  return (
    <aside className="side">
      {prof && <Settings onClose={() => setProf(false)} />}
      {grp && <NewGroup onClose={() => setGrp(false)} />}
      <header><button className="link me" onClick={() => setProf(true)}><Avatar u={mine || { name: user.displayName }} size={34} /><b>{mine?.name || user.displayName}</b></button><span className="hdr-actions"><ThemeToggle /><button type="button" className="icon-btn" aria-label="Settings" title="Settings" onClick={() => setProf(true)}><GearIcon size={20} /></button></span></header>
      <nav className="tabs" aria-label="Sections">{[['chats', 'Chats', unreadOf(direct)], ['contacts', 'Contacts', 0], ['groups', 'Groups', unreadOf(groups)], ['status', 'Status', newStatus], ['activity', 'Activity', 0]].map(([k, l, n]) => { const Ico = TAB_ICON[k]; return <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}><span className="tab-ico"><Ico size={22} /></span><span className="tab-label">{l}</span>{n > 0 && <span className="tab-badge">{n > 99 ? '99+' : n}</span>}</button> })}</nav>
      {tab === 'chats' && <>
        <form className="search-box" onSubmit={search}><input placeholder="Search by @username or email" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Escape' && setQ('')} aria-label="Find a person" />{q && <button type="button" className="search-x" aria-label="Clear search" onClick={() => setQ('')}><Close size={16} /></button>}</form>
        {msg && <div className="err pad">{msg}</div>}
        {q.trim() ? (
          <div className="list search-results">
            {res.map(u => { const v = visibleUser(u, mine); return (
              <button key={u.uid} type="button" className="row" onClick={() => openUser(u)}>
                <Avatar u={v} />
                <span className="grow"><b>{u.name || 'Unknown'}</b><small>{u.username ? '@' + u.username : u.email}</small></span>
              </button>
            ) })}
            {searching && <div className="pad muted">Searching…</div>}
            {!searching && done && !res.length && <div className="pad muted">No one found. They may not have set a username yet, so try their full email address.</div>}
            {!searching && !done && <div className="pad muted">Type at least 2 letters of a username, or a full email address.</div>}
          </div>
        ) : <>
        {filterBar}
        <div className="list">
          {filter === 'all' && (
            <div className={'row-wrap' + (activeId === 'ai' ? ' active' : '')}>
              <button className={'row ai-row' + (activeId === 'ai' ? ' active' : '')} onClick={() => nav('/chat/ai')}>
                <span className="avatar ai-avatar"><Sparkle size={20} /></span>
                <span className="grow"><b>{AI_NAME}</b><small>Ask me anything</small></span>
                <span className="ai-tag">AI</span>
              </button>
            </div>
          )}
          {renderRows(direct)}
          {!applyFilter(direct).length && <div className="pad muted">{emptyText('chats')}</div>}
        </div>
        </>}
      </>}
      {tab === 'groups' && <>
        <div className="pad"><button className="wide" onClick={() => setGrp(true)}>+ New group</button></div>
        {filterBar}
        <div className="list">
          {renderRows(groups)}
          {!applyFilter(groups).length && <div className="pad muted">{emptyText('groups')}</div>}
        </div>
      </>}
      {tab === 'contacts' && <ContactsPanel meDoc={mine} />}

      {tab === 'status' && <StatusPanel list={statuses} />}
      {tab === 'activity' && <ActivityPanel />}
      <div className="toasts">{toasts.map(t => <button key={t.id} className="toast" onClick={() => nav('/chat/' + t.chatId)}><b>{t.title}</b><span>{t.body}</span></button>)}</div>
    </aside>
  )
}
