import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import * as S from '../services/chat'
import Avatar from './Avatar'
import GroupInfo from './GroupInfo'
import ContactInfo from './ContactInfo'
import BackButton from './BackButton'
import { addContact, removeContact } from '../services/contacts'
import ChatMenu, { chatMenuItems } from './ChatMenu'
import { clearChat, deleteChat } from '../services/chatActions'
import { privacyOf, visibleUser } from '../services/settings'
import { VoiceRecorder, VoicePlayer, canRecord } from './Voice'
import { fmtSize } from './FilePicker'
import { Mic, Send, Paperclip, Smile, ImageIcon, FileIcon, VideoIcon, Close } from './Icons'

const EMOJI = '😀😂😍🥰😎🤔😢😡👍👎🙏👏🔥🎉❤️💯🙌😅😴🤝👀✨🥳😭🤗'.match(/\p{Extended_Pictographic}(\uFE0F)?/gu)
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// WhatsApp-style ticks: one tick = sent, two overlapping ticks = delivered, blue = read
const Tick = ({ s }) => (
  <svg className={'tick ' + s} width="17" height="11" viewBox="0 0 17 11" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={s === 'read' ? 'Read' : s === 'delivered' ? 'Delivered' : 'Sent'}>
    <path d="M1.5 5.8 4.3 8.6 9.6 1.8" />
    {s !== 'sent' && <path d="M5.9 8.2 6.7 8.6 12 1.8" />}
  </svg>
)
const time = t => t?.toDate ? t.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''

// { uid: emoji } -> { emoji: [uid, ...] }
const groupReactions = r =>
  Object.entries(r || {}).reduce((a, [uid, e]) => ((a[e] = a[e] || []).push(uid), a), {})

function Media({ a }) {
  if (a.isVoice) return <VoicePlayer src={a.url} duration={a.duration} wave={a.wave} />
  if (a.isImage) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer">
        <img className="pic" src={a.url} alt={a.name} />
      </a>
    )
  }
  if (a.isVideo) return <video className="pic" src={a.url} controls preload="metadata" />
  if (a.isAudio) return <audio className="aud" src={a.url} controls preload="metadata" />
  return (
    <a className="file" href={a.url} target="_blank" rel="noreferrer">
      <FileIcon size={18} /> <span>{a.name}</span>
    </a>
  )
}

function SelectedFile({ file, busy, onRemove }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file.type?.startsWith('image/')) { setUrl(null); return }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <div className="selected-file">
      <span className="sf-thumb">
        {url ? <img src={url} alt="" /> : file.type?.startsWith('video/') ? <VideoIcon /> : <FileIcon />}
      </span>
      <span className="sf-info"><b>{file.name}</b><small>{fmtSize(file.size)}</small></span>
      <button type="button" className="icon-btn" aria-label="Remove attachment" onClick={onRemove} disabled={busy}>
        <Close size={18} />
      </button>
    </div>
  )
}

export default function ChatWindow({ chatId }) {
  const { user } = useAuth()
  const me = user.uid
  const nav = useNavigate()

  const direct = chatId.includes('_')
  const other = direct ? chatId.split('_').find(x => x !== me) : null

  const [msgs, setMsgs] = useState([])
  const msgsRef = useRef([])
  msgsRef.current = msgs
  const reacting = useRef(new Set())
  const [chat, setChat] = useState(null)
  const [u, setU] = useState(null)
  const [text, setText] = useState('')
  const [reply, setReply] = useState(null)
  const [edit, setEdit] = useState(null)
  const [q, setQ] = useState('')
  const [emoji, setEmoji] = useState(false)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(false)
  const [names, setNames] = useState({})
  const [meDoc, setMeDoc] = useState(null)
  const [cinfo, setCinfo] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Selected file waits for the Send button
  const [selectedFile, setSelectedFile] = useState(null)
  const [menu, setMenu] = useState(false)          // attach menu
  const [recording, setRecording] = useState(false) // voice note bar
  const [reactFor, setReactFor] = useState(null)    // id of the message whose reaction bar is open

  const others = chat ? chat.members.filter(x => x !== me) : other ? [other] : []

  useEffect(() => {
    if (chat?.isGroup) S.getNames(chat.members).then(setNames)
  }, [chat?.members?.join()])

  const end = useRef()
  const tt = useRef()
  const mediaRef = useRef()
  const docRef = useRef()

  useEffect(
    () => S.listenMessages(chatId, m => {
      setMsgs(m)
      S.markRead(chatId, me, m)
    }),
    [chatId, me]
  )

  useEffect(
    () => onSnapshot(doc(db, 'chats', chatId), s => setChat(s.data())),
    [chatId]
  )

  useEffect(
    () => (other ? S.listenUser(other, setU) : undefined),
    [other]
  )

  useEffect(() => S.listenUser(me, setMeDoc), [me])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  // Selecting a file ONLY attaches it. Nothing is uploaded until Send.
  const onFile = e => {
    const f = e.target.files[0]
    e.target.value = '' // allow picking the same file again later
    if (!f) return

    if (f.size > 10 * 1024 * 1024) {
      alert('File is larger than 10 MB')
      return
    }
    setSelectedFile(f)
  }

  const removeSelectedFile = () => {
    if (busy) return
    setSelectedFile(null)
  }

  const typing = e => {
    setText(e.target.value)
    S.setTyping(chatId, me, true)

    clearTimeout(tt.current)
    tt.current = setTimeout(() => S.setTyping(chatId, me, false), 1500)
  }

  const replyRef = () =>
    reply ? { id: reply.id, text: reply.text || S.attLabel(reply.attachment), from: reply.from } : null

  const send = async e => {
    e.preventDefault()

    const t = text.trim()

    // Allow sending either text OR an attached file
    if (!t && !selectedFile) return

    setBusy(true)

    try {
      if (edit) {
        await S.editMessage(chatId, edit.id, t)
        setEdit(null)
        setText('')
        return
      }

      let attachment = null

      // Upload happens ONLY after Send is pressed
      if (selectedFile) {
        attachment = await S.uploadChatFile(chatId, selectedFile)
      }

      await S.sendMessage(chatId, me, direct ? other : others, t, replyRef(), attachment)

      setText('')
      setReply(null)
      setSelectedFile(null)
    } catch (x) {
      console.error(x)
      alert(x.message || 'Message failed to send')
    } finally {
      setBusy(false)
    }
  }

  // ---- voice notes
  const startRecording = () => {
    if (!canRecord()) {
      alert('Voice messages need a browser with microphone support, opened over https or localhost.')
      return
    }
    setEmoji(false)
    setRecording(true)
  }

  const stopRecording = msg => {
    setRecording(false)
    if (typeof msg === 'string') alert(msg)
  }

  const sendVoice = async (file, duration, wave) => {
    setRecording(false)
    setBusy(true)
    try {
      const attachment = await S.uploadChatFile(chatId, file, { isVoice: true, duration, wave })
      await S.sendMessage(chatId, me, direct ? other : others, '', replyRef(), attachment)
      setReply(null)
    } catch (x) {
      console.error(x)
      alert(x.message || 'Voice message failed to send')
    } finally {
      setBusy(false)
    }
  }

  // ---- reactions
  // One reaction per person: tapping your current reaction removes it, tapping another one replaces it.
  // Taps on the same message are ignored while the previous change is still being saved.
  const react = async (m, e) => {
    setReactFor(null)
    if (reacting.current.has(m.id)) return
    const current = msgsRef.current.find(x => x.id === m.id)?.reactions?.[me]
    reacting.current.add(m.id)
    try {
      await S.reactToMessage(chatId, m.id, me, current === e ? null : e)
    } catch (x) {
      console.error(x)
    } finally {
      reacting.current.delete(m.id)
    }
  }
  const who = uid =>
    uid === me ? 'You' : chat?.isGroup ? (names[uid] || 'Someone') : (u?.name || 'Them')

  const openInfo = () => (chat?.isGroup ? setInfo(true) : u && setCinfo(true))

  // Respect privacy settings (last seen, photo, about, read receipts)
  const vu = visibleUser(u, meDoc)
  const receipts = privacyOf(meDoc).readReceipts && privacyOf(u).readReceipts

  const status = vu?.online
    ? 'online'
    : vu?.lastSeen
      ? 'last seen ' + vu.lastSeen.toDate().toLocaleString([], {
          hour: '2-digit',
          minute: '2-digit',
          day: 'numeric',
          month: 'short'
        })
      : ''

  const byId = Object.fromEntries(msgs.map(m => [m.id, m]))
  const hasContent = !!text.trim() || !!selectedFile

  // Messages before the user's "Clear chat" time are hidden (wait for the profile to load first)
  const clearedAt = meDoc?.cleared?.[chatId] || 0

  const visible = msgs.filter(
    m =>
      meDoc !== null &&
      (!clearedAt || (m.at?.toMillis?.() ?? Infinity) > clearedAt) &&
      !m.deletedFor?.includes(me) &&
      (!q || m.text?.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <section className="win">

      {info && chat && (
        <GroupInfo
          chatId={chatId}
          chat={chat}
          me={me}
          names={names}
          onClose={() => setInfo(false)}
          onLeft={() => nav('/chat')}
        />
      )}

      {cinfo && vu && <ContactInfo u={vu} onClose={() => setCinfo(false)} isContact={!!meDoc?.contacts?.includes(other)} onAdd={() => addContact(me, other)} onRemove={() => removeContact(me, other)} />}

      <header>
        <BackButton onClick={() => nav('/chat')} />

        {/* Clicking the profile (photo + name) opens the contact / group info */}
        {/* Only the photo and the name are clickable. The rest of the bar does nothing. */}
        <div className="hdr-profile">
          <button
            type="button"
            className="hdr-avatar"
            aria-label={chat?.isGroup ? 'View group photo and info' : 'View profile photo and info'}
            onClick={openInfo}
          >
            <Avatar u={chat?.isGroup ? { name: chat.name, photoURL: chat.photoURL } : vu} />
          </button>

          <span className="grow">
            <button type="button" className="hdr-name" onClick={openInfo}>
              <b>{chat?.isGroup ? chat.name : u?.name}</b>
            </button>

            <small>
              {others.some(x => chat?.typing?.[x])
                ? (
                    chat?.isGroup
                      ? (names[others.find(x => chat.typing[x])] || 'Someone') + ' is typing…'
                      : 'typing…'
                  )
                : chat?.isGroup
                  ? chat.members.length + ' members'
                  : status}
            </small>
          </span>
        </div>

        {chat && (
          <ChatMenu
            items={chatMenuItems({
              isGroup: chat.isGroup,
              onSearch: () => setSearchOpen(true),
              onClear: () => clearChat(me, chatId, chat.lastAt?.toMillis?.() ?? Date.now()),
              onDelete: async () => { await deleteChat(me, chatId, chat.lastAt?.toMillis?.() ?? Date.now()); nav('/chat') },
            })}
          />
        )}
      </header>

      {searchOpen && (
        <div className="searchbar">
          <input
            autoFocus
            type="search"
            placeholder="Search messages"
            aria-label="Search messages"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setSearchOpen(false), setQ(''))}
          />
          {q && <span className="muted found">{visible.length} found</span>}
          <button type="button" className="icon-btn" aria-label="Close search" onClick={() => { setSearchOpen(false); setQ('') }}><Close size={18} /></button>
        </div>
      )}

      <div className="msgs">
        {visible.map((m, i) => {
          const mine = m.from === me
          const groups = groupReactions(m.reactions)

          return (
            <div key={m.id} className={'msg ' + (mine ? 'mine' : 'theirs')}>

              {chat?.isGroup && !mine && (
                <b className="sender">{names[m.from]}</b>
              )}

              {m.replyTo && (
                <div className="quote">
                  {byId[m.replyTo.id]?.deletedAll
                    ? 'Message deleted'
                    : m.replyTo.text}
                </div>
              )}

              {m.attachment && !m.deletedAll && <Media a={m.attachment} />}

              {(m.text || m.deletedAll) && (
                <p className={m.deletedAll ? 'gone' : ''}>
                  {m.deletedAll ? 'This message was deleted' : m.text}
                </p>
              )}

              <span className="meta">
                {m.edited && !m.deletedAll && 'edited '}
                {time(m.at)}{' '}
                {mine && !m.deletedAll && <Tick s={m.status === 'read' && !receipts ? 'delivered' : m.status} />}
              </span>

              {!m.deletedAll && Object.keys(groups).length > 0 && (
                <div className="reactions">
                  {Object.entries(groups).map(([e, uids]) => (
                    <button
                      type="button"
                      key={e}
                      className={'chip' + (uids.includes(me) ? ' on' : '')}
                      title={uids.map(who).join(', ')}
                      onClick={() => react(m, e)}
                    >
                      {e}{uids.length > 1 && <small>{uids.length}</small>}
                    </button>
                  ))}
                </div>
              )}

              {!m.deletedAll && (
                <button
                  type="button"
                  className="react-btn"
                  aria-label="React to message"
                  onClick={() => setReactFor(reactFor === m.id ? null : m.id)}
                >
                  <Smile size={16} />
                </button>
              )}

              {reactFor === m.id && !m.deletedAll && (
                <>
                  <div className="menu-backdrop" onClick={() => setReactFor(null)} />
                  <div className={'react-bar' + (i === 0 ? ' down' : '')} role="menu">
                    {QUICK.map(e => (
                      <button
                        type="button"
                        key={e}
                        role="menuitem"
                        className={m.reactions?.[me] === e ? 'on' : ''}
                        onClick={() => react(m, e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!m.deletedAll && (
                <span className="actions">
                  <button onClick={() => setReply(m)}>Reply</button>

                  {mine && m.text && (
                    <button
                      onClick={() => {
                        setEdit(m)
                        setText(m.text)
                      }}
                    >
                      Edit
                    </button>
                  )}

                  <button onClick={() => S.deleteForMe(chatId, m.id, me)}>
                    Delete for me
                  </button>

                  {mine && (
                    <button onClick={() => S.deleteForAll(chatId, m.id)}>
                      Delete for everyone
                    </button>
                  )}
                </span>
              )}
            </div>
          )
        })}

        <div ref={end} />
      </div>

      {(reply || edit) && (
        <div className="banner">
          {edit ? 'Editing message' : 'Replying to: ' + (reply.text || S.attLabel(reply.attachment))}

          <button
            className="link"
            onClick={() => {
              setReply(null)
              setEdit(null)
              setText('')
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && !recording && (
        <SelectedFile file={selectedFile} busy={busy} onRemove={removeSelectedFile} />
      )}

      {emoji && !recording && (
        <div className="emoji">
          {EMOJI.map(e => (
            <button type="button" key={e} onClick={() => setText(t => t + e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      {recording ? (
        <div className="composer rec">
          <VoiceRecorder onCancel={stopRecording} onSend={sendVoice} />
        </div>
      ) : (
        <form className="composer" onSubmit={send}>

          <button
            type="button"
            className="ghost"
            aria-label="Emoji"
            onClick={() => setEmoji(v => !v)}
          >
            <Smile />
          </button>

          <div className="attach">
            <button
              type="button"
              className="ghost"
              aria-label="Attach file"
              aria-expanded={menu}
              disabled={busy || !!edit}
              onClick={() => setMenu(v => !v)}
            >
              <Paperclip />
            </button>

            {menu && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(false)} />
                <div className="menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); mediaRef.current?.click() }}>
                    <span className="mi" style={{ background: '#7c4dff' }}><ImageIcon size={18} /></span>
                    Photo or video
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenu(false); docRef.current?.click() }}>
                    <span className="mi" style={{ background: '#1e88e5' }}><FileIcon size={18} /></span>
                    Document
                  </button>
                </div>
              </>
            )}

            <input ref={mediaRef} type="file" accept="image/*,video/*" hidden disabled={busy} onChange={onFile} />
            <input ref={docRef} type="file" hidden disabled={busy} onChange={onFile} />
          </div>

          <input
            value={text}
            onChange={typing}
            placeholder={selectedFile ? 'Add a message (optional)' : 'Type a message'}
          />

          {edit ? (
            <button className="pill-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          ) : hasContent ? (
            <button className="send-round" disabled={busy} aria-label="Send">
              {busy ? '…' : <Send />}
            </button>
          ) : (
            <button
              type="button"
              className="send-round"
              disabled={busy}
              aria-label="Record voice message"
              title="Record voice message"
              onClick={startRecording}
            >
              {busy ? '…' : <Mic />}
            </button>
          )}

        </form>
      )}
    </section>
  )
}
