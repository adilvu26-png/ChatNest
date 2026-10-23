import { useState } from 'react'
import Avatar from './Avatar'
import AvatarPicker from './AvatarPicker'
import { addMember, removeMember, makeAdmin, saveGroup } from '../services/extra'

export default function GroupInfo({ chatId, chat, me, names, onClose, onLeft }) {
  const admin = chat.admins.includes(me)
  const [name, setName] = useState(chat.name); const [file, setFile] = useState(null); const [email, setEmail] = useState(''); const [err, setErr] = useState('')
  const run = async fn => { setErr(''); try { await fn() } catch (x) { setErr(x.message || 'Action failed') } }
  const leave = () => run(async () => {
    const rest = chat.members.filter(x => x !== me)
    if (admin && chat.admins.length === 1 && rest.length) await makeAdmin(chatId, rest[0])
    await removeMember(chatId, me); onLeft()
  })
  return (
    <div className="modal" onClick={onClose}>
      <div className="card" onClick={e => e.stopPropagation()}>
        <h2>Group info</h2>
        {admin
          ? <AvatarPicker u={{ name: chat.name, photoURL: chat.photoURL }} file={file} onChange={setFile} />
          : <div className="avatar-picker"><Avatar viewable size={96} u={{ name: chat.name, photoURL: chat.photoURL }} /></div>}
        {admin && <>
          <div className="row2"><input value={name} onChange={e => setName(e.target.value)} /><button onClick={() => run(() => saveGroup(chatId, { name: name.trim() || chat.name, file }))}>Save</button></div>
        </>}
        <div className="members">
          {chat.members.map(m => (
            <div key={m} className="mrow"><span className="grow">{names[m] || '…'}{m === me && ' (you)'}{chat.admins.includes(m) && <small> Admin</small>}</span>
              {admin && m !== me && <>
                {!chat.admins.includes(m) && <button className="link" onClick={() => run(() => makeAdmin(chatId, m))}>Make admin</button>}
                <button className="link" onClick={() => run(() => removeMember(chatId, m))}>Remove</button>
              </>}
            </div>
          ))}
        </div>
        {admin && <div className="row2"><input placeholder="Add member by email" value={email} onChange={e => setEmail(e.target.value)} /><button onClick={() => run(async () => { await addMember(chatId, me, email); setEmail('') })}>Add</button></div>}
        {err && <div className="err">{err}</div>}
        <div className="row2"><button className="link" onClick={leave}>Leave group</button><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
