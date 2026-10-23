import { useEffect, useRef, useState } from 'react'
import { ImageIcon, FileIcon, Close } from './Icons'

export const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB'

const accepts = (f, accept) => !accept || accept.split(',').some(a => {
  a = a.trim()
  return a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a || f.name.toLowerCase().endsWith(a)
})

// A friendly file chooser: click or drag a file onto it, see a preview, remove it.
export default function FilePicker({ file, onChange, accept = 'image/*', label = 'Choose a file', hint = '', maxMB, disabled, className = '' }) {
  const ref = useRef()
  const [drag, setDrag] = useState(false)
  const [err, setErr] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file || !file.type?.startsWith('image/')) { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const take = f => {
    setErr('')
    if (!f) return
    if (!accepts(f, accept)) return setErr('That file type is not supported here.')
    if (maxMB && f.size > maxMB * 1048576) return setErr(`File is larger than ${maxMB} MB.`)
    onChange(f)
  }

  return (
    <div className={className}>
      <div
        className={'picker' + (drag ? ' drag' : '') + (file ? ' has' : '')}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) take(e.dataTransfer.files?.[0]) }}
      >
        <button type="button" className="picker-main" disabled={disabled} onClick={() => ref.current?.click()}>
          <span className="picker-ico">{preview ? <img src={preview} alt="" /> : accept.startsWith('image') ? <ImageIcon /> : <FileIcon />}</span>
          <span className="picker-text">
            <b>{file ? file.name : label}</b>
            <small>{file ? fmtSize(file.size) : hint || 'Click to browse or drop a file here'}</small>
          </span>
        </button>
        {file && <button type="button" className="icon-btn" aria-label="Remove file" disabled={disabled} onClick={() => { setErr(''); onChange(null) }}><Close size={18} /></button>}
        <input ref={ref} type="file" accept={accept} hidden onChange={e => { take(e.target.files[0]); e.target.value = '' }} />
      </div>
      {err && <div className="err picker-err">{err}</div>}
    </div>
  )
}
