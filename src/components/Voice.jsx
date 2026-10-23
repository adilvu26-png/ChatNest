import { useEffect, useRef, useState } from 'react'
import { Trash, Send, Play, Pause } from './Icons'

const MAX_SECONDS = 300
const BARS = 40

const fmt = s => {
  s = Math.max(0, Math.round(s || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

// Prefer MP4/AAC (plays everywhere, including Safari), then WebM/Ogg.
const pickMime = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(t => MediaRecorder.isTypeSupported(t)) || ''
}

const downsample = (peaks, n) => {
  if (!peaks.length) return Array(n).fill(0.2)
  const out = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * peaks.length / n)
    const b = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n))
    out.push(Math.max(...peaks.slice(a, b)))
  }
  const m = Math.max(...out) || 1
  return out.map(v => Math.round(Math.max(0.12, v / m) * 100) / 100)
}

const stopAll = s => {
  clearInterval(s.tick)
  try { if (s.rec && s.rec.state !== 'inactive') s.rec.stop() } catch { /* already stopped */ }
  s.stream?.getTracks().forEach(t => t.stop())
  try { s.ctx?.close()?.catch(() => {}) } catch { /* already closed */ }
}

export const canRecord = () => !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

/** Recording bar. Starts recording on mount. */
export function VoiceRecorder({ onCancel, onSend }) {
  const [secs, setSecs] = useState(0)
  const [bars, setBars] = useState([])
  const st = useRef({})
  const sending = useRef(false)
  const sendRef = useRef()

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (dead) { stream.getTracks().forEach(t => t.stop()); return }
        const mime = pickMime()
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
        const chunks = []
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }

        const AC = window.AudioContext || window.webkitAudioContext
        const ctx = new AC()
        const an = ctx.createAnalyser()
        an.fftSize = 256
        ctx.createMediaStreamSource(stream).connect(an)
        const buf = new Uint8Array(an.fftSize)
        const peaks = []
        const t0 = Date.now()

        const tick = setInterval(() => {
          an.getByteTimeDomainData(buf)
          let sum = 0
          for (const v of buf) { const d = (v - 128) / 128; sum += d * d }
          const rms = Math.sqrt(sum / buf.length)
          peaks.push(rms)
          setBars(b => [...b.slice(-(BARS - 1)), Math.max(0.1, Math.min(1, rms * 4))])
          const ms = Date.now() - t0
          setSecs(Math.floor(ms / 1000))
          if (ms >= MAX_SECONDS * 1000) { clearInterval(tick); sendRef.current?.() }
        }, 100)

        st.current = { stream, rec, chunks, ctx, tick, peaks, t0 }
        rec.start()
      } catch (err) {
        if (!dead) onCancel(err?.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the browser address bar and try again.' : 'Could not start recording.')
      }
    })()
    return () => { dead = true; stopAll(st.current) }
  }, [])

  const send = async () => {
    const s = st.current
    if (!s.rec || sending.current) return
    sending.current = true
    const ms = Date.now() - s.t0
    if (ms < 800) { onCancel(); return } // accidental tap
    await new Promise(res => { s.rec.onstop = res; s.rec.stop() })
    const type = (s.rec.mimeType || 'audio/webm').split(';')[0]
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([new Blob(s.chunks, { type })], `voice-${Date.now()}.${ext}`, { type })
    onSend(file, Math.max(1, Math.round(ms / 1000)), downsample(s.peaks, BARS))
  }
  sendRef.current = send

  return (
    <div className="recorder">
      <button type="button" className="ghost danger" aria-label="Discard recording" onClick={() => onCancel()}><Trash /></button>
      <span className="rec-dot" />
      <span className="rec-time">{fmt(secs)}</span>
      <span className="rec-bars" aria-hidden="true">{bars.map((v, i) => <i key={i} style={{ height: Math.round(v * 100) + '%' }} />)}</span>
      <button type="button" className="send-round" aria-label="Send voice message" onClick={send}><Send /></button>
    </div>
  )
}

const FALLBACK = Array.from({ length: BARS }, (_, i) => Math.round((0.25 + Math.abs(Math.sin(i * 1.7)) * 0.6) * 100) / 100)

/** Voice message bubble: play/pause, waveform with progress, duration. */
export function VoicePlayer({ src, duration = 0, wave }) {
  const a = useRef()
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(duration || 0)
  const bars = wave?.length ? wave : FALLBACK
  const ratio = dur ? Math.min(1, t / dur) : 0

  const toggle = () => {
    const el = a.current
    if (!el) return
    if (el.paused) {
      document.querySelectorAll('audio').forEach(x => { if (x !== el) x.pause() })
      el.play().catch(() => {})
    } else el.pause()
  }
  const seek = e => {
    const el = a.current
    if (!el || !dur) return
    const r = e.currentTarget.getBoundingClientRect()
    try { el.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur } catch { /* not seekable yet */ }
  }

  return (
    <div className="voice">
      <audio ref={a} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setT(0) }}
        onTimeUpdate={e => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={e => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setDur(d) }} />
      <button type="button" className="voice-btn" onClick={toggle} aria-label={playing ? 'Pause voice message' : 'Play voice message'}>
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <span className="voice-wave" onClick={seek}>
        {bars.map((v, i) => <i key={i} className={i / bars.length < ratio ? 'on' : ''} style={{ height: Math.round(v * 100) + '%' }} />)}
      </span>
      <span className="voice-time">{fmt(playing || t > 0 ? t : dur)}</span>
    </div>
  )
}
