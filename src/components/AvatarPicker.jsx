import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Avatar from './Avatar'
import { Camera } from './Icons'

const V = 280   // crop box size (px)
const D = 250   // circle diameter inside the box (px)
const OUT = 512 // exported picture size (px)

function Cropper({ file, onCancel, onDone }) {
  const [url, setUrl] = useState('')
  const [nat, setNat] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const imgRef = useRef()
  const drag = useRef(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const base = nat ? D / Math.min(nat.w, nat.h) : 1 // smallest scale that still fills the circle
  const scale = base * zoom

  const clamp = (p, z = zoom) => {
    if (!nat) return p
    const s = base * z
    const mx = Math.max(0, (nat.w * s - D) / 2)
    const my = Math.max(0, (nat.h * s - D) / 2)
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
  }
  const changeZoom = z => {
    z = Math.min(3, Math.max(1, z))
    setZoom(z); setPos(p => clamp(p, z))
  }

  const down = e => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
  }
  const move = e => {
    const d = drag.current
    if (d) setPos(clamp({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }))
  }
  const up = () => { drag.current = null }

  const save = () => {
    if (!nat) return
    const c = document.createElement('canvas')
    c.width = c.height = OUT
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    const sw = D / scale
    const sx = Math.min(nat.w - sw, Math.max(0, nat.w / 2 - pos.x / scale - sw / 2))
    const sy = Math.min(nat.h - sw, Math.max(0, nat.h / 2 - pos.y / scale - sw / 2))
    ctx.drawImage(imgRef.current, sx, sy, sw, sw, 0, 0, OUT, OUT)
    c.toBlob(b => b && onDone(new File([b], 'avatar.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  }

  return createPortal(
    <div className="modal top" onClick={e => { e.stopPropagation(); onCancel() }}>
      <div className="card crop-card" onClick={e => e.stopPropagation()}>
        <h2>Adjust photo</h2>
        <div className="crop-view" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onWheel={e => changeZoom(zoom - e.deltaY * 0.002)}>
          {url && (
            <img ref={imgRef} src={url} alt="" draggable={false}
              onLoad={e => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
              style={nat ? {
                width: nat.w * scale, height: nat.h * scale,
                left: '50%', top: '50%',
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
              } : { opacity: 0 }} />
          )}
          <span className="crop-mask" />
        </div>
        <label className="crop-zoom">
          <small>Zoom</small>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => changeZoom(+e.target.value)} aria-label="Zoom" />
        </label>
        <small className="muted">Drag to reposition. The circle is what everyone will see.</small>
        <div className="row2">
          <button type="button" className="link" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={save} disabled={!nat}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Round photo with a camera button. Picking a file opens the cropper;
// `onChange` receives the cropped, square JPEG ready to upload.
export default function AvatarPicker({ u, file, onChange, size = 112 }) {
  const ref = useRef()
  const [raw, setRaw] = useState(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pick = () => ref.current?.click()
  const onFile = e => {
    const f = e.target.files[0]
    e.target.value = ''
    setErr('')
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('Please choose an image.')
    if (f.size > 15 * 1048576) return setErr('Image is larger than 15 MB.')
    setRaw(f)
  }

  return (
    <div className="avatar-picker">
      <div className="ap-wrap">
        <Avatar u={preview ? { ...u, photoURL: preview } : u} size={size} />
        <button type="button" className="ap-cam" onClick={pick} aria-label="Change photo"><Camera size={18} /></button>
      </div>
      <button type="button" className="pill" onClick={pick}><Camera size={16} />{file || u?.photoURL ? 'Change photo' : 'Choose photo'}</button>
      {err && <div className="err">{err}</div>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={onFile} />
      {raw && <Cropper file={raw} onCancel={() => setRaw(null)} onDone={f => { onChange(f); setRaw(null) }} />}
    </div>
  )
}
