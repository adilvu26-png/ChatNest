import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Close } from './Icons'

// `viewable` lets people tap the picture to see it full size (like WhatsApp).
// Do not use it inside another <button> (for example the chat list rows).
export default function Avatar({ u, online, size, viewable }) {
  const [open, setOpen] = useState(false)
  const canView = !!viewable && !!u?.photoURL
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.4) } : undefined

  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const press = canView ? {
    role: 'button', tabIndex: 0, title: 'View photo',
    onClick: () => setOpen(true),
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } },
  } : {}

  return (
    <>
      <span className={'avatar' + (canView ? ' viewable' : '')} style={style} {...press}>
        {u?.photoURL ? <img src={u.photoURL} alt="" /> : ((u?.name || '?')[0] || '?').toUpperCase()}
        {online && <i />}
      </span>
      {open && createPortal(
        <div className="lightbox" role="dialog" aria-label="Profile photo" onClick={e => { e.stopPropagation(); setOpen(false) }}>
          <button type="button" className="lb-close" aria-label="Close" onClick={() => setOpen(false)}><Close /></button>
          <img src={u.photoURL} alt={u.name || 'Profile photo'} onClick={e => e.stopPropagation()} />
          {u.name && <div className="lb-name">{u.name}</div>}
        </div>,
        document.body
      )}
    </>
  )
}
