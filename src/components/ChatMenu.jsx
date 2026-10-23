import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../styles-chat-actions.css'

const Dots = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
  </svg>
)

// Shared menu items for a chat. Leave out onArchive to hide the archive entry.
export const chatMenuItems = ({ isGroup, archived, fav, onFav, onArchive, onSearch, onClear, onDelete }) => [
  onSearch && { label: 'Search messages', onClick: onSearch },
  onFav && { label: fav ? 'Remove from favourites' : 'Add to favourites', onClick: onFav },
  onArchive && { label: archived ? 'Unarchive chat' : 'Archive chat', onClick: onArchive },
  onClear && {
    label: 'Clear chat',
    confirm: { title: 'Clear this chat?', body: 'All messages will be removed for you. ' + (isGroup ? 'Other members keep their copy.' : 'The other person keeps their copy.'), button: 'Clear chat' },
    onClick: onClear,
  },
  onDelete && !isGroup && {
    label: 'Delete chat', danger: true,
    confirm: { title: 'Delete this chat?', body: 'The chat is removed from your list and its messages are cleared for you. The other person keeps their copy, and the chat comes back if they message you again.', button: 'Delete chat' },
    onClick: onDelete,
  },
].filter(Boolean)

// Three-dots button + popup menu. Items needing confirmation open a dialog first.
export default function ChatMenu({ items, className = 'icon-btn', label = 'Chat options' }) {
  const btn = useRef(null)
  const [pos, setPos] = useState(null)
  const [ask, setAsk] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const onKey = e => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [pos])

  if (!items.length) return null

  const open = e => {
    e.stopPropagation()
    const r = btn.current.getBoundingClientRect()
    const right = Math.max(8, window.innerWidth - r.right)
    setPos(r.bottom > window.innerHeight - 40 - items.length * 48
      ? { bottom: window.innerHeight - r.top + 4, right }
      : { top: r.bottom + 4, right })
  }

  const pick = it => {
    setPos(null)
    if (it.confirm) { setErr(''); setAsk(it) } else it.onClick()
  }

  const confirm = async () => {
    setBusy(true); setErr('')
    try { await ask.onClick(); setAsk(null) }
    catch { setErr('That did not work. Please try again.') }
    setBusy(false)
  }

  return (
    <>
      <button ref={btn} type="button" className={className} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={!!pos} onClick={open}><Dots /></button>

      {pos && createPortal(
        <>
          <div className="cm-backdrop" onClick={e => { e.stopPropagation(); setPos(null) }} />
          <div className="cm-menu" role="menu" style={pos}>
            {items.map(it => (
              <button key={it.label} type="button" role="menuitem" className={'cm-item' + (it.danger ? ' danger' : '')} onClick={e => { e.stopPropagation(); pick(it) }}>{it.label}</button>
            ))}
          </div>
        </>,
        document.body
      )}

      {ask && createPortal(
        <div className="modal top" onClick={e => { e.stopPropagation(); !busy && setAsk(null) }}>
          <div className="card cm-confirm" role="alertdialog" aria-label={ask.confirm.title} onClick={e => e.stopPropagation()}>
            <h2>{ask.confirm.title}</h2>
            <p>{ask.confirm.body}</p>
            {err && <div className="err" role="alert">{err}</div>}
            <div className="row2">
              <button type="button" className="link" disabled={busy} onClick={() => setAsk(null)}>Cancel</button>
              <button type="button" className={ask.danger ? 'cm-danger' : ''} disabled={busy} onClick={confirm}>{busy ? 'Please wait…' : ask.confirm.button}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
