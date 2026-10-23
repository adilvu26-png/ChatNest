import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listenUser, saveProfile } from '../services/chat'
import { setUsername, saveSettings, privacyOf, prefsOf, USERNAME_RE, cleanUsername } from '../services/settings'
import Avatar from './Avatar'
import AvatarPicker from './AvatarPicker'
import ThemeToggle from './ThemeToggle'
import { ChevronLeft, ChevronRight, Close } from './Icons'
import '../styles-settings.css'

const Svg = ({ size = 22, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const GearIcon = ({ size }) => <Svg size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>
const UserI = () => <Svg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
const LockI = () => <Svg><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
const BellI = () => <Svg><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
const KeyI = () => <Svg><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M16 7l3 3" /></Svg>
const PaletteI = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></Svg>
const OutI = () => <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>

const Switch = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={'sw' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></button>
)

function Item({ icon, title, sub, onClick, right }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className="set-item" onClick={onClick}>
      <span className="set-ico">{icon}</span>
      <span className="set-text"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {right || (onClick && <ChevronRight size={18} />)}
    </Tag>
  )
}

const Who = ({ label, hint, value, onChange }) => (
  <label className="set-row">
    <span className="set-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
    <select className="set-select" value={value} onChange={e => onChange(e.target.value)} aria-label={label}>
      <option value="everyone">Everyone</option>
      <option value="nobody">Nobody</option>
    </select>
  </label>
)

const TITLES = { profile: 'Profile', privacy: 'Privacy', notifications: 'Notifications', account: 'Account' }

export default function Settings({ onClose }) {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('main')
  const [d, setD] = useState(null)
  const [name, setName] = useState(''); const [about, setAbout] = useState(''); const [username, setUser] = useState('')
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const init = useRef(false)

  useEffect(() => listenUser(user.uid, v => {
    setD(v)
    if (v && !init.current) { init.current = true; setName(v.name || ''); setAbout(v.about || ''); setUser(v.username || '') }
  }), [user.uid])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') (page === 'main' ? onClose() : go('main')) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const go = p => { setErr(''); setPage(p) }
  const priv = privacyOf(d); const prefs = prefsOf(d)
  const put = patch => { setErr(''); saveSettings(user.uid, patch).catch(() => setErr('Could not save that change. Please try again.')) }
  const setPriv = (k, v) => put({ privacy: { [k]: v } })
  const setPref = (k, v) => put({ prefs: { [k]: v } })

  const saveProf = async e => {
    e.preventDefault(); setErr('')
    const un = cleanUsername(username)
    if (!name.trim()) return setErr('Please enter your name.')
    if (un && !USERNAME_RE.test(un)) return setErr('Username must be 3–20 characters, start with a letter, and use only a–z, 0–9, "." or "_".')
    setBusy(true)
    try {
      await setUsername(user.uid, un)
      await saveProfile(user.uid, { name: name.trim(), about: about.trim(), file })
      setFile(null); go('main')
    } catch (x) { setErr(x?.message || 'Could not save your profile. Please try again.') }
    setBusy(false)
  }

  return (
    <div className="modal set-modal" onClick={onClose}>
      <div className="set-panel" role="dialog" aria-label="Settings" onClick={e => e.stopPropagation()}>
        <div className="set-head">
          {page !== 'main' && <button type="button" className="icon-btn" aria-label="Back" onClick={() => go('main')}><ChevronLeft size={22} /></button>}
          <h2>{TITLES[page] || 'Settings'}</h2>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}><Close size={20} /></button>
        </div>

        <div className="set-body">
          {page === 'main' && <>
            <button type="button" className="set-me" onClick={() => go('profile')}>
              <Avatar u={d || { name: user.displayName }} size={64} />
              <span className="set-text"><b>{d?.name || user.displayName}</b>{d?.username && <small>@{d.username}</small>}<small>{d?.about || 'Hey there! I am using ChatNest.'}</small></span>
              <ChevronRight size={18} />
            </button>
            <Item icon={<UserI />} title="Profile" sub="Photo, name, username, about" onClick={() => go('profile')} />
            <Item icon={<LockI />} title="Privacy" sub="Last seen, profile photo, about, read receipts" onClick={() => go('privacy')} />
            <Item icon={<BellI />} title="Notifications" sub="In-app message pop-ups" onClick={() => go('notifications')} />
            <Item icon={<PaletteI />} title="Appearance" sub="Light or dark theme" right={<ThemeToggle />} />
            <Item icon={<KeyI />} title="Account" sub="Email and log out" onClick={() => go('account')} />
          </>}

          {page === 'profile' && (
            <form className="set-form" onSubmit={saveProf}>
              <AvatarPicker u={d || { name: user.displayName }} file={file} onChange={setFile} />
              <label className="set-field"><span>Name</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={40} required /></label>
              <label className="set-field"><span>Username</span>
                <input value={username} onChange={e => setUser(cleanUsername(e.target.value))} placeholder="e.g. sara.k" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                <small className="muted">Friends can find you with @{username || 'username'}. 3–20 characters: a–z, 0–9, "." and "_".</small></label>
              <label className="set-field"><span>About</span>
                <textarea className="set-area" value={about} onChange={e => setAbout(e.target.value)} placeholder="Say something about yourself" maxLength={140} rows={3} />
                <small className="muted set-count">{about.length}/140</small></label>
              {err && <div className="err" role="alert">{err}</div>}
              <div className="row2"><button type="button" className="link" onClick={() => go('main')}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
            </form>
          )}

          {page === 'privacy' && <>
            <div className="set-note muted">Choose who can see your personal info. Changes save automatically.</div>
            <Who label="Last seen and online" hint="If you hide yours, you won't see other people's either." value={priv.lastSeen} onChange={v => setPriv('lastSeen', v)} />
            <Who label="Profile photo" value={priv.photo} onChange={v => setPriv('photo', v)} />
            <Who label="About" value={priv.about} onChange={v => setPriv('about', v)} />
            <div className="set-row">
              <span className="set-text"><b>Read receipts</b><small>If turned off, blue ticks are hidden for you and for people you chat with.</small></span>
              <Switch on={priv.readReceipts} onChange={v => setPriv('readReceipts', v)} label="Read receipts" />
            </div>
            {err && <div className="err pad" role="alert">{err}</div>}
          </>}

          {page === 'notifications' && <>
            <div className="set-row">
              <span className="set-text"><b>Message pop-ups</b><small>Show a banner when a new message arrives in a chat you are not viewing.</small></span>
              <Switch on={prefs.toasts} onChange={v => setPref('toasts', v)} label="Message pop-ups" />
            </div>
            {err && <div className="err pad" role="alert">{err}</div>}
          </>}

          {page === 'account' && <>
            <Item icon={<UserI />} title="Email" sub={user.email} />
            <Item icon={<KeyI />} title="Username" sub={d?.username ? '@' + d.username : 'Not set'} onClick={() => go('profile')} />
            <button type="button" className="set-logout" onClick={logout}><OutI /> Log out</button>
          </>}
        </div>
      </div>
    </div>
  )
}
