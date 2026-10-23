import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listenActivity, takeSnapshot } from '../services/extra'

const LABEL = { session_start: 'Opened the app', message_sent: 'Sent a message', group_created: 'Created group', member_added: 'Added member', status_posted: 'Posted status', profile_updated: 'Updated profile', snapshot: 'Snapshot' }

export default function ActivityPanel() {
  const { user } = useAuth(); const [ev, setEv] = useState([])
  useEffect(() => listenActivity(user.uid, setEv), [user.uid])
  return (
    <div className="list">
      <div className="pad"><button onClick={() => takeSnapshot(user.uid)}>Take snapshot</button></div>
      {ev.map(e => {
        let d = e.detail
        if (e.type === 'snapshot') try { const s = JSON.parse(d); d = `${s.chats} chats, ${s.groups} groups, ${s.unread} unread, ${s.statuses} statuses` } catch { /* keep raw */ }
        return <div key={e.id} className="pad ev"><b>{LABEL[e.type] || e.type}</b><small>{e.at?.toDate().toLocaleString() || 'just now'}</small>{d && <span className="muted">{d}</span>}</div>
      })}
      {!ev.length && <div className="pad muted">No activity yet.</div>}
    </div>
  )
}
