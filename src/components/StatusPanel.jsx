import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { postStatus, viewStatus, deleteStatus, getNames } from '../services/extra'
import { listenUser } from '../services/chat'
import Avatar from './Avatar'
import FilePicker from './FilePicker'
import { Close, ChevronLeft, ChevronRight, Plus } from './Icons'

const BG = ['#1f6f5c', '#7a3b69', '#b5541c', '#2c4a8a', '#444444']
const pick = () => BG[Math.floor(Math.random() * BG.length)]

// One round profile photo with a ring (coloured = new, grey = all seen).
function Bubble({ uid, label, count = 0, seen, empty, onClick }) {
  const [u, setU] = useState(null)
  useEffect(() => listenUser(uid, setU), [uid])
  return (
    <button type="button" className="story-item" onClick={onClick} title={label}>
      <span className={'ring' + (empty ? ' empty' : seen ? ' seen' : '')}>
        <Avatar u={u} size={58} />
        {empty && <i className="plus"><Plus size={14} /></i>}
        {count > 0 && <em className="cnt">{count}</em>}
      </span>
      <small>{label}</small>
    </button>
  )
}

export default function StatusPanel({ list = [] }) {
  const { user } = useAuth(); const me = user.uid
  const [text, setText] = useState(''); const [bg, setBg] = useState(pick)
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false)
  const [view, setView] = useState(null); const [names, setNames] = useState({})
  const [can, setCan] = useState({ l: false, r: false })
  const strip = useRef(); const input = useRef()

  const seenBy = s => !!s.viewers?.[me]
  const mine = list.filter(s => s.uid === me)
  const others = Object.values(
    list.filter(s => s.uid !== me).reduce((a, s) => ((a[s.uid] = a[s.uid] || []).push(s), a), {})
  ).sort((a, b) => {
    const ua = a.some(s => !seenBy(s)), ub = b.some(s => !seenBy(s))
    if (ua !== ub) return ua ? -1 : 1
    return (b[b.length - 1].createdAt?.seconds || 0) - (a[a.length - 1].createdAt?.seconds || 0)
  })

  // Names are only needed for the "Seen by" line on my own statuses.
  const key = mine.map(s => s.id + Object.keys(s.viewers || {}).length).join()
  useEffect(() => {
    const ids = [...new Set(mine.flatMap(s => Object.keys(s.viewers || {})))]
    if (ids.length) getNames(ids).then(setNames)
  }, [key])

  const cur = view && list.find(s => s.id === view.ids[view.i])
  useEffect(() => { if (cur && cur.uid !== me && !cur.viewers?.[me]) viewStatus(cur.id, me).catch(() => {}) }, [cur?.id])
  useEffect(() => { if (view && !cur) setView(null) }, [view, cur])

  const step = useCallback(d => setView(v => {
    if (!v) return v
    const i = v.i + d
    return i < 0 ? v : i >= v.ids.length ? null : { ...v, i }
  }), [])

  useEffect(() => {
    if (!view) return
    const onKey = e => {
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Escape') setView(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [!!view, step])

  // Show the left / right arrows only when the row actually overflows.
  const measure = useCallback(() => {
    const el = strip.current
    if (!el) return
    setCan({ l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
  }, [])
  useEffect(() => {
    measure()
    const el = strip.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure, others.length, mine.length])
  const scroll = dir => strip.current?.scrollBy({ left: dir * Math.max(120, strip.current.clientWidth * 0.75), behavior: 'smooth' })

  const open = (group, start = 0) => setView({ ids: group.map(s => s.id), i: start })
  const openOthers = g => { const n = g.findIndex(s => !seenBy(s)); open(g, n < 0 ? 0 : n) }

  const post = async e => {
    e.preventDefault(); if (!text.trim() && !file) return
    setBusy(true)
    try { await postStatus(me, user.displayName, { text: text.trim(), bg, file }); setText(''); setFile(null); setBg(pick()) } catch { alert('Could not post status') }
    setBusy(false)
  }

  return (
    <div className="list status-panel">
      <div className="stories-wrap">
        {can.l && <button type="button" className="arrow l" aria-label="Scroll left" onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>}
        <div className="stories" ref={strip} onScroll={measure}>
          <Bubble uid={me} label="My status" empty={!mine.length} seen={mine.length > 0}
            onClick={() => mine.length ? open(mine) : input.current?.focus()} />
          {others.map(g => (
            <Bubble key={g[0].uid} uid={g[0].uid} label={g[0].name || 'Contact'}
              count={g.filter(s => !seenBy(s)).length} seen={g.every(seenBy)}
              onClick={() => openOthers(g)} />
          ))}
        </div>
        {can.r && <button type="button" className="arrow r" aria-label="Scroll right" onClick={() => scroll(1)}><ChevronRight size={20} /></button>}
      </div>
      {!others.length && <div className="pad muted center-text">No updates from your contacts yet.</div>}

      <form className="pad status-form" onSubmit={post}>
        <input ref={input} placeholder="Share a status (disappears after 24 hours)" value={text} onChange={e => setText(e.target.value)} />
        {text && <div className="preview" style={{ background: bg }}>{text}</div>}
        <div className="status-actions">
          <FilePicker className="status-picker" file={file} onChange={setFile} accept="image/*" label="Add a photo" hint="JPG or PNG, up to 5 MB" maxMB={5} disabled={busy} />
          <button disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
        </div>
      </form>

      {!!mine.length && (
        <div className="pad my-status"><b>My status</b>
          {mine.map(s => (
            <div key={s.id} className="mrow">
              <button type="button" className="link grow" onClick={() => open(mine, mine.indexOf(s))}>
                <span className="trunc">{s.text || 'Photo'} · {Object.keys(s.viewers || {}).length} views</span>
              </button>
              <button type="button" className="link" onClick={() => deleteStatus(s.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {cur && (
        <div className="modal story-modal" onClick={() => setView(null)}>
          <div className="story" style={{ background: cur.bg }} onClick={e => e.stopPropagation()}>
            <div className="story-bars" aria-hidden="true">
              {view.ids.map((id, k) => <i key={id} className={k < view.i ? 'done' : k === view.i ? 'cur' : ''} />)}
            </div>
            <div className="story-top">
              <b>{cur.uid === me ? 'My status' : cur.name}</b>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setView(null)}><Close size={20} /></button>
            </div>
            <div className="story-body">
              {cur.imageURL && <img src={cur.imageURL} alt="" />}
              {cur.text && <p>{cur.text}</p>}
            </div>
            {cur.uid === me && <small className="seen-by">Seen by: {Object.keys(cur.viewers || {}).map(id => names[id] || '…').join(', ') || 'nobody yet'}</small>}
            <div className="row2">
              <button type="button" onClick={() => step(-1)} disabled={view.i === 0}>Back</button>
              <button type="button" onClick={() => step(1)}>{view.i === view.ids.length - 1 ? 'Close' : 'Next'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
